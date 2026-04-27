const router = require('express').Router()
const { GoogleGenerativeAI } = require('@google/generative-ai')
const Case = require('../models/Case')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Using gemini-2.5-flash which is confirmed to have active quota
const model = genAI.getGenerativeModel(
  { model: 'gemini-2.5-flash' },
  { apiVersion: 'v1beta' }
)

/* ── Retry helper (exponential backoff for 429 rate limits) ─────────────── */
async function retryWithBackoff(fn, retries = 3, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('Too Many')
      if (is429 && i < retries - 1) {
        const wait = delayMs * (i + 1)   // 5s → 10s → 15s
        console.log(`[Gemini] Rate limited — waiting ${wait / 1000}s before retry ${i + 1}/${retries}…`)
        await new Promise(r => setTimeout(r, wait))
      } else {
        throw err
      }
    }
  }
}


/* ── LEXIS System Persona ────────────────────────────────────────────────── */
const LEXIS_PERSONA = `You are LEXIS, an elite AI legal triage assistant embedded inside JusticeQueue AI — a neural legal case management and court scheduling system used by legal professionals.

Your core responsibilities:
- Analyze uploaded legal documents to help attorneys prioritize their caseload
- Extract critical information: parties, deadlines, legal issues, risks
- Explain AI-generated urgency and complexity scores in plain terms
- Identify red flags that require immediate attention
- Suggest specific preparatory actions before hearings

Your personality:
- Precise, authoritative, and concise — like a senior paralegal
- Use proper legal terminology but remain accessible
- Structure responses clearly with bullet points when listing items
- Never give personal legal advice — you are a triage and prioritization tool
- Always focus on actionability: what needs to happen next

Important: This is a professional legal tool. Be direct, structured, and helpful.`

/* ── Build case context for Gemini ──────────────────────────────────────── */
function buildCaseContext(doc) {
  return `
CASE FILE: ${doc.originalName}
Type: ${doc.geminiCaseType || doc.caseType || 'Unknown'} | Status: ${doc.status}
Pages: ${doc.pageCount || 0} | Words: ${doc.wordCount || 0}
Urgency: ${Math.round(doc.urgencyScore || 0)}/100 | Complexity: ${Math.round(doc.complexityScore || 0)}/100 | Priority: #${doc.priority || '—'}
Signature: ${doc.signatureDetected ? 'Detected' : 'Not detected'}
Keywords: ${(doc.keywords || []).join(', ') || 'None'}
Scheduled: ${doc.scheduledSlot ? new Date(doc.scheduledSlot).toDateString() : 'Not docketed'}

DOCUMENT TEXT (first 1500 chars):
${(doc.extractedText || 'No text extracted').substring(0, 1500)}
`
}

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/gemini/analyze/:caseId
   Full Gemini analysis: summary, case type, urgency reason, red flags
   ══════════════════════════════════════════════════════════════════════════ */
router.post('/analyze/:caseId', async (req, res) => {
  try {
    const doc = await Case.findById(req.params.caseId)
    if (!doc) return res.status(404).json({ error: 'Case not found' })

    const prompt = `${LEXIS_PERSONA}

${buildCaseContext(doc)}

TASK: Analyze this legal case. Respond ONLY with valid JSON (no markdown):
{
  "summary": "2-3 sentence professional summary",
  "caseType": "Criminal | Civil | Family | Corporate | Intellectual Property | Administrative | Contract | Real Estate | Employment | Constitutional | Immigration | Tax | Bankruptcy | Unknown",
  "urgencyReason": "Why this scored ${Math.round(doc.urgencyScore || 0)}/100 urgency",
  "redFlags": ["flag1", "flag2", "flag3"],
  "requiredActions": ["action1", "action2", "action3"],
  "hearingPrepTime": "e.g. '3-4 hours'",
  "priorityJustification": "One sentence"
}`

    const result = await retryWithBackoff(() => model.generateContent(prompt))
    const raw = result.response.text().trim()

    let analysis
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      analysis = JSON.parse(clean)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      analysis = match ? JSON.parse(match[0]) : {
        summary: raw.substring(0, 300), caseType: 'Unknown',
        urgencyReason: '', redFlags: [], requiredActions: [],
        hearingPrepTime: 'Unknown', priorityJustification: '',
      }
    }

    await Case.findByIdAndUpdate(req.params.caseId, {
      geminiSummary:               analysis.summary,
      geminiCaseType:              analysis.caseType,
      geminiUrgencyReason:         analysis.urgencyReason,
      geminiRedFlags:              analysis.redFlags || [],
      geminiRequiredActions:       analysis.requiredActions || [],
      geminiHearingPrep:           analysis.hearingPrepTime,
      geminiPriorityJustification: analysis.priorityJustification,
      geminiAnalyzedAt:            new Date(),
      caseType:                    analysis.caseType || doc.caseType,
    })

    res.json({ success: true, analysis })
  } catch (err) {
    console.error('[Gemini /analyze] Error:', err.message)
    const isQuota = err.message?.includes('429') || err.message?.includes('quota')
    res.status(isQuota ? 429 : 500).json({
      error: isQuota
        ? 'Gemini API rate limit reached. Please wait 60 seconds and try again.'
        : err.message
    })
  }
})

/* ══════════════════════════════════════════════════════════════════════════
   POST /api/gemini/chat/:caseId
   Multi-turn chat about a specific case
   Body: { message: string, history: [{role, content}] }
   ══════════════════════════════════════════════════════════════════════════ */
router.post('/chat/:caseId', async (req, res) => {
  try {
    const { message, history = [] } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' })

    const doc = await Case.findById(req.params.caseId)
    if (!doc) return res.status(404).json({ error: 'Case not found' })

    const historyText = history.slice(-6).map(h =>
      `${h.role === 'user' ? 'Attorney' : 'LEXIS'}: ${h.content}`
    ).join('\n')

    const prompt = `${LEXIS_PERSONA}

${buildCaseContext(doc)}

${historyText ? `CONVERSATION HISTORY:\n${historyText}\n\n` : ''}Attorney: ${message.trim()}
LEXIS:`

    const result = await retryWithBackoff(() => model.generateContent(prompt))
    const response = result.response.text().trim()

    res.json({ response })
  } catch (err) {
    console.error('[Gemini /chat] Error:', err.message)
    const isQuota = err.message?.includes('429') || err.message?.includes('quota')
    res.status(isQuota ? 429 : 500).json({
      error: isQuota
        ? 'Rate limit reached. Please wait a moment before sending another message.'
        : err.message
    })
  }
})

/* ══════════════════════════════════════════════════════════════════════════
   GET /api/gemini/status/:caseId
   Check if a case has been Gemini-analyzed
   ══════════════════════════════════════════════════════════════════════════ */
router.get('/status/:caseId', async (req, res) => {
  try {
    const doc = await Case.findById(req.params.caseId).select('geminiAnalyzedAt geminiSummary geminiCaseType geminiRedFlags geminiRequiredActions geminiUrgencyReason geminiHearingPrep geminiPriorityJustification caseType')
    if (!doc) return res.status(404).json({ error: 'Case not found' })
    res.json({
      analyzed: !!doc.geminiAnalyzedAt,
      analyzedAt: doc.geminiAnalyzedAt,
      summary: doc.geminiSummary,
      caseType: doc.geminiCaseType || doc.caseType,
      urgencyReason: doc.geminiUrgencyReason,
      redFlags: doc.geminiRedFlags || [],
      requiredActions: doc.geminiRequiredActions || [],
      hearingPrep: doc.geminiHearingPrep,
      priorityJustification: doc.geminiPriorityJustification,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
