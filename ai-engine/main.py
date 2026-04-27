"""
JusticeQueue AI Engine — FastAPI entry point
"""
from __future__ import annotations

import io
import logging
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from processor import DocumentProcessor, LegalBertScorer, SignatureDetector
from optimizer import CaseOptimizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("ai-engine")

app = FastAPI(
    title="JusticeQueue AI Engine",
    description="Legal document analysis: extraction, scoring, signature detection, optimization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load singletons
_bert_scorer: LegalBertScorer | None = None
_sig_detector: SignatureDetector | None = None
_doc_processor: DocumentProcessor | None = None
_optimizer: CaseOptimizer | None = None


def get_bert_scorer() -> LegalBertScorer:
    global _bert_scorer
    if _bert_scorer is None:
        log.info("Loading Legal-BERT model …")
        _bert_scorer = LegalBertScorer()
    return _bert_scorer


def get_sig_detector() -> SignatureDetector:
    global _sig_detector
    if _sig_detector is None:
        _sig_detector = SignatureDetector()
    return _sig_detector


def get_doc_processor() -> DocumentProcessor:
    global _doc_processor
    if _doc_processor is None:
        _doc_processor = DocumentProcessor()
    return _doc_processor


def get_optimizer() -> CaseOptimizer:
    global _optimizer
    if _optimizer is None:
        _optimizer = CaseOptimizer()
    return _optimizer


# ─── Schemas ────────────────────────────────────────────────────────────────

class CaseInput(BaseModel):
    id: str
    urgency_score: float
    complexity_score: float
    page_count: int = 1
    case_type: str = "Unknown"


class OptimizeRequest(BaseModel):
    cases: List[CaseInput]


# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-engine"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    log.info(f"Analyzing: {file.filename}")
    content = await file.read()

    try:
        # 1. Text extraction
        doc_proc = get_doc_processor()
        doc_data = doc_proc.extract(content)
        log.info(f"Extracted {doc_data['page_count']} pages, {doc_data['word_count']} words")

        # 2. Legal-BERT scoring
        scorer = get_bert_scorer()
        urgency = scorer.score_urgency(doc_data["text"])
        complexity = scorer.score_complexity(doc_data["text"])
        log.info(f"Scores — urgency={urgency:.1f}, complexity={complexity:.1f}")

        # 3. Signature detection (YOLO stub via OpenCV)
        sig_det = get_sig_detector()
        sig_result = sig_det.detect(content)
        log.info(f"Signature detected={sig_result['detected']}, confidence={sig_result['confidence']:.2f}")

        return {
            "status": "complete",
            "filename": file.filename,
            "page_count": doc_data["page_count"],
            "word_count": doc_data["word_count"],
            "extracted_text": doc_data["text"][:3000],  # truncate for transport
            "keywords": doc_data["keywords"],
            "case_type": doc_data["case_type"],
            "urgency_score": urgency,
            "complexity_score": complexity,
            "signature_detected": sig_result["detected"],
            "signature_confidence": sig_result["confidence"],
            "signature_regions": sig_result["regions"],
        }

    except Exception as exc:
        log.error(f"Analysis failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/optimize")
async def optimize(request: OptimizeRequest):
    log.info(f"Optimizing {len(request.cases)} cases via OR-Tools …")
    try:
        optimizer = get_optimizer()
        result = optimizer.optimize(
            [c.model_dump() for c in request.cases]
        )
        return {"status": "complete", "optimized": result}
    except Exception as exc:
        log.error(f"Optimization failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
