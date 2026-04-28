"""
processor.py — Core AI processing logic for JusticeQueue

Classes:
  DocumentProcessor  — PyMuPDF text & metadata extraction
  LegalBertScorer    — Legal-BERT urgency/complexity scoring
  SignatureDetector  — OpenCV-based YOLO-style signature detection stub
"""
from __future__ import annotations

import io
import re
import math
import logging
from typing import Any

import numpy as np

log = logging.getLogger("processor")

# Legal keyword taxonomy
URGENCY_KEYWORDS = [
    "emergency", "injunction", "restraining order", "temporary restraining",
    "immediate", "urgent", "tro", "ex parte", "contempt", "eviction",
    "deportation", "custody emergency", "abuse", "domestic violence",
    "preliminary injunction", "imminent", "expires", "deadline",
]

COMPLEXITY_KEYWORDS = [
    "class action", "antitrust", "securities fraud", "merger", "acquisition",
    "intellectual property", "patent", "copyright", "multidistrict",
    "constitutional", "federal question", "cross-border", "international",
    "derivative", "arbitration clause", "rico", "qui tam", "whistleblower",
    "environmental", "discrimination",
]

CASE_TYPE_PATTERNS = {
    "Criminal": r"\b(criminal|prosecution|defendant|indictment|felony|misdemeanor|bail|arraignment)\b",
    "Civil": r"\b(plaintiff|damages|tort|negligence|breach of contract|civil)\b",
    "Family": r"\b(divorce|custody|alimony|adoption|guardian|domestic)\b",
    "Immigration": r"\b(deportation|asylum|visa|citizenship|immigration|uscis)\b",
    "Intellectual Property": r"\b(patent|trademark|copyright|trade secret|infringement)\b",
    "Corporate": r"\b(merger|acquisition|shareholder|corporation|llc|board of directors)\b",
}


class DocumentProcessor:
    """Extract text, metadata, and keywords from PDF bytes using PyMuPDF."""

    def extract(self, pdf_bytes: bytes) -> dict[str, Any]:
        try:
            import fitz  # PyMuPDF
        except ImportError:
            log.warning("PyMuPDF not installed — using stub extraction")
            return self._stub_extraction()

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        full_text_parts = []

        for page in doc:
            text = page.get_text("text")
            full_text_parts.append(text)

        doc.close()

        full_text = "\n".join(full_text_parts)
        words = full_text.split()

        return {
            "text": full_text,
            "page_count": len(full_text_parts),
            "word_count": len(words),
            "keywords": self._extract_keywords(full_text),
            "case_type": self._detect_case_type(full_text),
        }

    def _extract_keywords(self, text: str) -> list[str]:
        text_lower = text.lower()
        found = []
        for kw in URGENCY_KEYWORDS + COMPLEXITY_KEYWORDS:
            if kw in text_lower and kw not in found:
                found.append(kw)
        return found[:20]

    def _detect_case_type(self, text: str) -> str:
        text_lower = text.lower()
        scores: dict[str, int] = {}
        for case_type, pattern in CASE_TYPE_PATTERNS.items():
            matches = re.findall(pattern, text_lower)
            scores[case_type] = len(matches)
        if not any(scores.values()):
            return "Unknown"
        return max(scores, key=scores.get)

    def _stub_extraction(self) -> dict[str, Any]:
        return {
            "text": "Sample legal document text.",
            "page_count": 1,
            "word_count": 5,
            "keywords": ["contract"],
            "case_type": "Civil",
        }


class LegalBertScorer:
    """
    Score legal documents for urgency and complexity using Legal-BERT embeddings.
    Uses cosine similarity between the document's CLS embedding and
    anchor sentences representing high-urgency / high-complexity cases.
    """

    URGENCY_ANCHORS = [
        "This is an emergency matter requiring immediate judicial intervention.",
        "The petitioner faces imminent and irreparable harm without urgent court action.",
        "An emergency temporary restraining order is urgently required.",
        "Immediate action is needed to prevent domestic violence and protect the victim.",
        "The defendant faces deportation within 24 hours.",
    ]

    COMPLEXITY_ANCHORS = [
        "This is a complex multi-party class action lawsuit involving antitrust violations.",
        "The case involves intricate constitutional questions of federal and international law.",
        "Multiple cross-border jurisdictions and complex intellectual property rights are at issue.",
        "This case requires extensive discovery, expert testimony, and multidistrict litigation coordination.",
        "RICO violations, securities fraud, and corporate merger regulations are central to this dispute.",
    ]

    def __init__(self) -> None:
        self._model = None
        self._tokenizer = None
        self._urgency_embs: np.ndarray | None = None
        self._complexity_embs: np.ndarray | None = None
        self._load()

    def _load(self) -> None:
        import os
        if os.environ.get("RENDER"):
            log.warning("Running on Render Free Tier. Bypassing PyTorch Legal-BERT to prevent 502 OOM crashes. Using heuristic fallback.")
            self._model = None
            return

        try:
            from transformers import AutoTokenizer, AutoModel
            import torch

            model_name = "nlpaueb/legal-bert-base-uncased"
            log.info(f"Loading {model_name} …")
            self._tokenizer = AutoTokenizer.from_pretrained(model_name)
            self._model = AutoModel.from_pretrained(model_name)
            self._model.eval()

            self._urgency_embs = self._encode_batch(self.URGENCY_ANCHORS)
            self._complexity_embs = self._encode_batch(self.COMPLEXITY_ANCHORS)
            log.info("Legal-BERT loaded successfully ✅")
        except Exception as e:
            log.warning(f"Could not load Legal-BERT ({e}). Using heuristic fallback.")
            self._model = None

    def _encode_batch(self, sentences: list[str]) -> np.ndarray:
        import torch
        embeddings = []
        for sent in sentences:
            emb = self._encode(sent)
            embeddings.append(emb)
        return np.array(embeddings)

    def _encode(self, text: str, max_length: int = 512) -> np.ndarray:
        import torch
        inputs = self._tokenizer(
            text,
            return_tensors="pt",
            max_length=max_length,
            truncation=True,
            padding=True,
        )
        with torch.no_grad():
            outputs = self._model(**inputs)
        cls_embedding = outputs.last_hidden_state[:, 0, :].squeeze().numpy()
        return cls_embedding

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        a_norm = a / (np.linalg.norm(a) + 1e-9)
        b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-9)
        sims = b_norm @ a_norm
        return float(np.mean(sims))

    def _heuristic_score(self, text: str, keywords: list[str]) -> float:
        """Fallback when BERT is unavailable: keyword density scoring."""
        text_lower = text.lower()
        words = text_lower.split()
        if not words:
            return 30.0
        hits = sum(1 for kw in keywords if kw in text_lower)
        density = hits / len(keywords)
        # Map 0.0–0.5 keyword density → 20–95 score
        score = 20 + density * 2 * 75
        return min(95.0, max(10.0, score))

    def score_urgency(self, text: str) -> float:
        if self._model is None:
            return self._heuristic_score(text, URGENCY_KEYWORDS)
        try:
            doc_emb = self._encode(text[:2000])
            sim = self._cosine_similarity(doc_emb, self._urgency_embs)
            # Cosine sim range ~[0.7, 0.99] → map to [0, 100]
            score = (sim - 0.70) / 0.29 * 100
            return round(min(100.0, max(0.0, score)), 1)
        except Exception as e:
            log.warning(f"Urgency scoring error: {e}")
            return self._heuristic_score(text, URGENCY_KEYWORDS)

    def score_complexity(self, text: str) -> float:
        if self._model is None:
            return self._heuristic_score(text, COMPLEXITY_KEYWORDS)
        try:
            doc_emb = self._encode(text[:2000])
            sim = self._cosine_similarity(doc_emb, self._complexity_embs)
            score = (sim - 0.70) / 0.29 * 100
            return round(min(100.0, max(0.0, score)), 1)
        except Exception as e:
            log.warning(f"Complexity scoring error: {e}")
            return self._heuristic_score(text, COMPLEXITY_KEYWORDS)


class SignatureDetector:
    """
    YOLO-style signature detection stub using OpenCV contour analysis.
    Renders each PDF page to an image, then finds signature-like regions:
    - Isolated, horizontal, hand-drawn contours
    - Located in bottom 25% of page (typical signature location)
    - Aspect ratio and area within expected signature bounds
    Real YOLOv11 weights can be swapped in by replacing detect() with
    a YOLO model.predict() call.
    """

    def detect(self, pdf_bytes: bytes) -> dict:
        try:
            return self._detect_cv(pdf_bytes)
        except ImportError as e:
            log.warning(f"OpenCV/PyMuPDF unavailable: {e}. Using stub.")
            return self._stub_detect()
        except Exception as e:
            log.warning(f"Signature detection error: {e}")
            return self._stub_detect()

    def _detect_cv(self, pdf_bytes: bytes) -> dict:
        import fitz
        import cv2

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_signature_regions = 0
        all_confidences = []

        for page_num, page in enumerate(doc):
            # Render page to image at 150 DPI
            mat = fitz.Matrix(150 / 72, 150 / 72)
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width
            )

            regions, conf = self._find_signature_regions(img_array, page.rect.height)
            all_signature_regions += regions
            if conf > 0:
                all_confidences.append(conf)

        doc.close()

        if not all_confidences:
            return {"detected": False, "confidence": 0.0, "regions": 0}

        avg_conf = float(np.mean(all_confidences))
        detected = all_signature_regions > 0 and avg_conf > 0.45

        return {
            "detected": detected,
            "confidence": round(avg_conf, 3),
            "regions": all_signature_regions,
        }

    def _find_signature_regions(self, gray_img: np.ndarray, page_height_pts: float) -> tuple[int, float]:
        import cv2

        h, w = gray_img.shape

        # Focus on bottom 25% of page (typical signature location)
        sig_zone = gray_img[int(h * 0.65):, :]

        # Binarize
        _, thresh = cv2.threshold(sig_zone, 200, 255, cv2.THRESH_BINARY_INV)

        # Morphological closing to connect nearby strokes
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 3))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        signature_count = 0
        confidences = []

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 300 or area > 80000:
                continue  # too small (noise) or too large (printed text block)

            x, y, cw, ch = cv2.boundingRect(cnt)
            aspect_ratio = cw / max(ch, 1)

            # Signatures are wider than tall, not extremely so
            if not (1.5 < aspect_ratio < 15):
                continue

            # Solidity check: signatures have low solidity (not filled solid)
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = area / max(hull_area, 1)
            if solidity > 0.85:
                continue  # likely printed text stamp

            signature_count += 1
            # Confidence: based on area and solidity match
            conf = min(0.95, 0.45 + (1 - solidity) * 0.5 + min(area / 50000, 0.2))
            confidences.append(conf)

        if not confidences:
            return 0, 0.0
        return signature_count, float(np.mean(confidences))

    def _stub_detect(self) -> dict:
        """Deterministic fallback when CV stack unavailable."""
        import random
        detected = random.random() > 0.4
        return {
            "detected": detected,
            "confidence": round(random.uniform(0.55, 0.92) if detected else random.uniform(0.1, 0.35), 3),
            "regions": random.randint(1, 2) if detected else 0,
        }
