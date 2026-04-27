import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { format } from 'date-fns'
import LegalChat from './LegalChat'

/* ── Seismograph waveform ───────────────────────────────────────────────── */
function Seismograph({ score, color }) {
  const w = 80, h = 24, mid = h / 2
  const pts = Array.from({ length: 11 }, (_, i) => {
    const x = (i / 10) * w
    const amp = (score / 100) * 9
    const y = (i === 0 || i === 10) ? mid : mid + Math.sin(i * 2.4) * amp + Math.sin(i * 5.1) * amp * 0.4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg className="seismo" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1="0" y1={mid} x2={w} y2={mid} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <path className="seismo-line" d={`M ${pts.join(' L ')}`} stroke={color} strokeOpacity="0.75" />
    </svg>
  )
}

/* ── Wax Seal ───────────────────────────────────────────────────────────── */
function WaxSeal({ score }) {
  const urg = Math.round(score ?? 0)
  let cls = 'wax-seal-low', label = 'LOW'
  if (urg >= 75) { cls = 'wax-seal-critical'; label = 'CRIT' }
  else if (urg >= 50) { cls = 'wax-seal-high'; label = 'HIGH' }
  else if (urg >= 25) { cls = 'wax-seal-medium'; label = 'MED' }
  return (
    <div className={`wax-seal ${cls}`}>
      <span style={{ lineHeight: 1.1 }}>{urg}<br />{label}</span>
    </div>
  )
}

/* ── Brass Clasp ────────────────────────────────────────────────────────── */
function BrassClasp() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#c9a84c" strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="9" cy="9" r="4" stroke="#c9a84c" strokeWidth="1" strokeOpacity="0.4" />
      <circle cx="9" cy="9" r="2" fill="#c9a84c" fillOpacity="0.5" />
    </svg>
  )
}

function seismoColor(s) {
  if (s >= 75) return 'var(--crimson)'
  if (s >= 50) return 'var(--amber)'
  return 'var(--teal)'
}
function statusBadge(status) {
  if (status === 'complete')  return { cls: 'badge-teal',    label: 'Complete' }
  if (status === 'analyzing') return { cls: 'badge-amber',   label: 'Analyzing' }
  if (status === 'error')     return { cls: 'badge-crimson', label: 'Error' }
  return { cls: 'badge-slate', label: 'Pending' }
}

/* ── LEXIS Analysis Panel ───────────────────────────────────────────────── */
function LexisPanel({ caseId, onAnalysisDone }) {
  const [state, setState]       = useState('idle') // idle | loading | done | error
  const [analysis, setAnalysis] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const runAnalysis = async () => {
    setState('loading')
    try {
      const { data } = await axios.post(`/api/gemini/analyze/${caseId}`)
      setAnalysis(data.analysis)
      setState('done')
      setExpanded(true)
      onAnalysisDone?.(data.analysis)
    } catch (err) {
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <motion.button
        className="btn btn-ghost"
        onClick={runAnalysis}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', width: '100%', justifyContent: 'center' }}
      >
        <span>✦</span> Analyze with LEXIS AI
      </motion.button>
    )
  }

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} style={{ fontSize: '1rem' }}>⚙</motion.span>
        <span className="font-mono" style={{ fontSize: '0.72rem' }}>LEXIS is reading the document…</span>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--amber)' }}>
        ⚠ LEXIS analysis failed. <button onClick={runAnalysis} style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>Retry</button>
      </div>
    )
  }

  // state === 'done'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Summary row */}
      <div style={{
        background: 'rgba(201,168,76,0.04)',
        border: '1px solid rgba(201,168,76,0.12)',
        borderLeft: '2px solid var(--gold)',
        borderRadius: '0.4rem',
        padding: '0.65rem 0.85rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>✦ LEXIS Summary</span>
            {analysis.caseType && analysis.caseType !== 'Unknown' && (
              <span className="badge badge-gold" style={{ fontSize: '0.55rem' }}>{analysis.caseType}</span>
            )}
          </div>
          <button onClick={() => setExpanded(x => !x)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
            {expanded ? '▲' : '▼'}
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
          {analysis.summary}
        </p>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {/* Urgency reason */}
            {analysis.urgencyReason && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 0.25rem', lineHeight: 1.55 }}>
                <span style={{ color: seismoColor(85), fontWeight: 600 }}>Urgency: </span>
                {analysis.urgencyReason}
              </div>
            )}

            {/* Red flags */}
            {analysis.redFlags?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--crimson)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>⚑ Red Flags</span>
                {analysis.redFlags.map((flag, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--crimson)', flexShrink: 0 }}>•</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Required actions */}
            {analysis.requiredActions?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--teal)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>→ Required Actions</span>
                {analysis.requiredActions.map((act, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--teal)', flexShrink: 0 }}>{i + 1}.</span>
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hearing prep time */}
            {analysis.hearingPrepTime && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Est. Prep:</span>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--gold)' }}>{analysis.hearingPrepTime}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main CaseCard
   ═══════════════════════════════════════════════════════════════════════════ */
export default function CaseCard({ caseData, onDelete }) {
  const {
    _id, originalName, status,
    urgencyScore, complexityScore,
    signatureDetected, signatureConfidence,
    keywords, caseType, pageCount, wordCount,
    scheduledSlot, priority, errorMessage,
    geminiSummary, geminiCaseType, geminiAnalyzedAt,
    geminiRedFlags, geminiRequiredActions,
  } = caseData

  const [chatOpen, setChatOpen]         = useState(false)
  const [geminiData, setGeminiData]     = useState(
    geminiSummary ? { summary: geminiSummary, caseType: geminiCaseType, redFlags: geminiRedFlags, requiredActions: geminiRequiredActions } : null
  )

  const urg        = Math.round(urgencyScore ?? 0)
  const comp       = Math.round(complexityScore ?? 0)
  const sc         = seismoColor(urg)
  const sb         = statusBadge(status)
  const isComplete = status === 'complete'
  const displayType = geminiData?.caseType || geminiCaseType || caseType || 'Unknown'

  const handleDelete = async () => {
    try { await axios.delete(`/api/cases/${_id}`) } catch {}
    onDelete?.(_id)
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        whileHover={{ y: -2 }}
        style={{ position: 'relative' }}
      >
        <div className="dossier-card">

          {/* ── Dossier Top Strip ─────────────────────────────────────── */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(201,168,76,0.1), rgba(201,168,76,0.04))',
            borderBottom: '1px solid rgba(201,168,76,0.12)',
            padding: '0.75rem 1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: 'var(--radius) var(--radius) 0 0',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
                <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--gold-dim)', letterSpacing: '0.08em' }}>
                  #{priority ?? '—'} · {displayType}
                </span>
                <span className={`badge ${sb.cls}`}>{sb.label}</span>
                {geminiAnalyzedAt && (
                  <span className="badge badge-gold" style={{ fontSize: '0.52rem' }}>✦ LEXIS</span>
                )}
              </div>
              <h3 style={{
                fontSize: '0.9rem', fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'Playfair Display, serif',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320,
              }}>
                {originalName}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <BrassClasp />
              <WaxSeal score={urg} />
            </div>
          </div>

          {/* ── Card Body ─────────────────────────────────────────────── */}
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Seismograph + Complexity */}
            {isComplete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>Urgency Signal</span>
                    <span className="font-mono" style={{ fontSize: '0.68rem', color: sc }}>{urg}</span>
                  </div>
                  <Seismograph score={urg} color={sc} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>Complexity</span>
                    <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--teal)' }}>{comp}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 9999, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${comp}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, var(--teal-dim), var(--teal))', borderRadius: 9999 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Metadata row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              {pageCount > 0 && <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>📄 {pageCount}pp</span>}
              {wordCount > 0 && <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>🔤 {wordCount.toLocaleString()}w</span>}
              <span className={`badge ${signatureDetected ? 'badge-emerald' : 'badge-slate'}`}>
                {signatureDetected ? `✍ Signed ${signatureConfidence ? Math.round(signatureConfidence * 100) + '%' : ''}` : '✗ Unsigned'}
              </span>
              {isComplete && <div className="holo-badge"><span>✦ AI VERIFIED</span></div>}
            </div>

            {/* Exhibit tags */}
            {keywords?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {keywords.slice(0, 6).map(kw => (
                  <span key={kw} className="exhibit-tag">
                    <span style={{ opacity: 0.5, fontSize: '0.6rem' }}>EX·</span>{kw}
                  </span>
                ))}
              </div>
            )}

            {/* ── LEXIS Gemini Panel ──────────────────────────────────── */}
            {isComplete && (
              <LexisPanel
                caseId={_id}
                onAnalysisDone={(a) => setGeminiData(a)}
              />
            )}

            {/* Court stamp */}
            {scheduledSlot && (
              <div>
                <div className="court-stamp">
                  <span>📋</span>
                  {format(new Date(scheduledSlot), 'EEE dd MMM yyyy · HH:mm')}
                </div>
              </div>
            )}

            {/* Error */}
            {errorMessage && (
              <p className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--amber)' }}>⚠ {errorMessage}</p>
            )}

            {/* Action Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              {isComplete && (
                <motion.button
                  className="btn btn-teal"
                  onClick={() => setChatOpen(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
                >
                  💬 Ask LEXIS
                </motion.button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={handleDelete} style={{ padding: '0.3rem 0.85rem', fontSize: '0.75rem' }}>
                🗑 Remove
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── LEXIS Chat Panel (floating) ─────────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <LegalChat
            caseData={{ ...caseData, caseType: displayType }}
            initialAnalysis={geminiData}
            onClose={() => setChatOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
