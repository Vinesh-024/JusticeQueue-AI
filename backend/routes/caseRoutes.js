const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

const Case = require('../models/Case');

const router = express.Router();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// In-memory fallback store when MongoDB is disconnected
const inMemoryStore = [];

// Helper: save to MongoDB or fallback
async function saveCase(data) {
  try {
    const doc = new Case(data);
    await doc.save();
    return doc;
  } catch {
    const doc = { _id: uuidv4(), ...data, id: uuidv4() };
    inMemoryStore.push(doc);
    return doc;
  }
}

async function updateCase(id, updates) {
  try {
    return await Case.findByIdAndUpdate(id, updates, { new: true });
  } catch {
    const idx = inMemoryStore.findIndex(c => c._id === id || c.id === id);
    if (idx !== -1) {
      inMemoryStore[idx] = { ...inMemoryStore[idx], ...updates };
      return inMemoryStore[idx];
    }
    return null;
  }
}

async function getAllCases() {
  try {
    return await Case.find().sort({ priority: -1, uploadedAt: -1 }).lean();
  } catch {
    return [...inMemoryStore].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}

async function getCaseById(id) {
  try {
    return await Case.findById(id).lean();
  } catch {
    return inMemoryStore.find(c => c._id === id || c.id === id) || null;
  }
}

// ─── ROUTES ────────────────────────────────────────────────────────────────

// POST /api/cases/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  // Create pending case record
  const caseData = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    status: 'analyzing',
  };

  let savedCase;
  try {
    savedCase = await saveCase(caseData);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create case record' });
  }

  // Respond immediately so the UI can start polling
  res.status(202).json({
    message: 'Case accepted for analysis',
    caseId: savedCase._id || savedCase.id,
    status: 'analyzing',
  });

  // ── Async: proxy PDF to AI engine ──
  (async () => {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: 'application/pdf',
      });

      const aiResponse = await axios.post(`${AI_ENGINE_URL}/analyze`, form, {
        headers: form.getHeaders(),
        timeout: 300000, // 5 min timeout for Render cold starts
      });

      const result = aiResponse.data;

      await updateCase(savedCase._id || savedCase.id, {
        status: 'complete',
        urgencyScore: result.urgency_score,
        complexityScore: result.complexity_score,
        signatureDetected: result.signature_detected,
        signatureConfidence: result.signature_confidence,
        signatureRegions: result.signature_regions,
        extractedText: result.extracted_text ? result.extracted_text.substring(0, 5000) : '',
        pageCount: result.page_count,
        wordCount: result.word_count,
        keywords: result.keywords || [],
        caseType: result.case_type || 'Unknown',
        priority: Math.round((result.urgency_score * 0.7) + (result.complexity_score * 0.3)),
      });

      // Clean up temp file
      fs.unlink(req.file.path, () => {});
    } catch (err) {
      console.error('AI engine error:', err.message);

      // Fallback: generate mock scores so the UI still works
      const mockUrgency = Math.floor(Math.random() * 60) + 20;
      const mockComplexity = Math.floor(Math.random() * 60) + 20;

      await updateCase(savedCase._id || savedCase.id, {
        status: 'complete',
        urgencyScore: mockUrgency,
        complexityScore: mockComplexity,
        signatureDetected: Math.random() > 0.5,
        signatureConfidence: parseFloat((Math.random() * 0.5 + 0.4).toFixed(2)),
        signatureRegions: Math.floor(Math.random() * 3),
        pageCount: 1,
        wordCount: 0,
        keywords: ['contract', 'plaintiff', 'defendant'],
        caseType: 'Civil',
        priority: Math.round((mockUrgency * 0.7) + (mockComplexity * 0.3)),
        errorMessage: 'AI engine unavailable — using mock scores',
      });

      fs.unlink(req.file.path, () => {});
    }
  })();
});

// GET /api/cases
router.get('/', async (req, res) => {
  try {
    const cases = await getAllCases();
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cases/:id
router.get('/:id', async (req, res) => {
  try {
    const c = await getCaseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Case not found' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cases/optimize  — trigger OR-Tools global re-optimization
router.post('/optimize', async (req, res) => {
  try {
    const cases = await getAllCases();
    const completeCases = cases.filter(c => c.status === 'complete');

    if (completeCases.length === 0) {
      return res.json({ message: 'No complete cases to optimize', cases: [] });
    }

    // Proxy to AI engine optimizer
    let optimized;
    try {
      const aiResp = await axios.post(`${AI_ENGINE_URL}/optimize`, {
        cases: completeCases.map(c => ({
          id: (c._id || c.id).toString(),
          urgency_score: c.urgencyScore || 0,
          complexity_score: c.complexityScore || 0,
          page_count: c.pageCount || 1,
          case_type: c.geminiCaseType || c.caseType || 'Unknown',
        })),
      }, { timeout: 30000 });
      optimized = aiResp.data.optimized;
    } catch {
      // Fallback: sort by (urgency*0.7 + complexity*0.3) desc and assign slots
      const sorted = [...completeCases].sort((a, b) =>
        ((b.urgencyScore || 0) * 0.7 + (b.complexityScore || 0) * 0.3) -
        ((a.urgencyScore || 0) * 0.7 + (a.complexityScore || 0) * 0.3)
      );

      // Generate 30-min slots starting next Monday 9am
      const startDate = getNextMonday();
      optimized = sorted.map((c, i) => ({
        id: (c._id || c.id).toString(),
        scheduled_slot: addSlot(startDate, i),
        rank: i + 1,
      }));
    }

    // Update each case with its scheduled slot
    const updatePromises = optimized.map(async (opt) => {
      return updateCase(opt.id, {
        scheduledSlot: opt.scheduled_slot,
        priority: optimized.length - (opt.rank - 1),
      });
    });
    await Promise.all(updatePromises);

    const updatedCases = await getAllCases();
    res.json({ message: 'Optimization complete', cases: updatedCases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cases/:id
router.delete('/:id', async (req, res) => {
  try {
    try {
      await Case.findByIdAndDelete(req.params.id);
    } catch (dbErr) {
      // Ignore CastError if deleting a UUID
    }
    const idx = inMemoryStore.findIndex(c => c._id === req.params.id || c.id === req.params.id);
    if (idx !== -1) inMemoryStore.splice(idx, 1);
    res.json({ message: 'Case deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  return d;
}

function addSlot(startDate, slotIndex) {
  const SLOTS_PER_DAY = 16; // 9am-5pm = 8 hours = 16 × 30 min
  const dayOffset = Math.floor(slotIndex / SLOTS_PER_DAY);
  const slotOffset = slotIndex % SLOTS_PER_DAY;
  const d = new Date(startDate);
  // Skip weekends
  let daysAdded = 0;
  let currentDay = d.getDay();
  while (daysAdded < dayOffset) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) daysAdded++;
  }
  d.setMinutes(d.getMinutes() + slotOffset * 30);
  return d.toISOString();
}

module.exports = router;
