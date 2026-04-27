import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import StatsBar from './StatsBar'
import UploadZone from './UploadZone'
import CaseCard from './CaseCard'
import JusticeCalendar from './JusticeCalendar'

/* ── Neural Mesh SVG Background ─────────────────────────────────────────── */
const NODES = [
  [120,80],[340,150],[600,60],[820,200],[1100,90],[1350,160],[1480,80],
  [200,280],[450,320],[700,260],[950,300],[1200,250],[1420,310],
  [80,450],[300,500],[550,430],[780,490],[1050,460],[1300,500],[1500,440],
  [160,640],[420,680],[670,600],[900,660],[1150,620],[1400,670],
  [240,820],[500,780],[750,840],[1000,800],[1250,850],[1470,810],
]
const EDGES = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],
  [7,8],[8,9],[9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],[16,17],[17,18],[18,19],
  [0,7],[1,8],[2,9],[3,10],[4,11],[5,12],
  [7,13],[8,14],[9,15],[10,16],[11,17],[12,18],
  [13,20],[14,21],[15,22],[16,23],[17,24],[18,25],
  [20,26],[21,27],[22,28],[23,29],[24,30],[25,31],
]

function NeuralMesh() {
  return (
    <div className="neural-mesh" aria-hidden="true">
      <svg viewBox="0 0 1536 900" preserveAspectRatio="xMidYMid slice">
        {EDGES.map(([a, b], i) => (
          <line key={i} className="mesh-line"
            x1={NODES[a][0]} y1={NODES[a][1]}
            x2={NODES[b][0]} y2={NODES[b][1]}
          />
        ))}
        {NODES.map(([x, y], i) => (
          <circle key={i} className="mesh-node" cx={x} cy={y} r="2" />
        ))}
      </svg>
    </div>
  )
}

/* ── Animated Scales of Justice ─────────────────────────────────────────── */
function ScalesIcon({ urgencyRatio }) {
  const tilt = (urgencyRatio - 0.5) * 28
  return (
    <motion.svg width="32" height="32" viewBox="0 0 32 32" fill="none"
      style={{ filter: 'drop-shadow(0 0 6px rgba(201,168,76,0.5))' }}
    >
      <rect x="15" y="4" width="2" height="24" fill="#c9a84c" rx="1" />
      <motion.g animate={{ rotate: tilt }}
        transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        style={{ originX: '16px', originY: '8px' }}
      >
        <rect x="6" y="7" width="20" height="2" fill="#c9a84c" rx="1" />
        <path d="M6 9 L3 17 Q6 19 9 17 Z" fill="none" stroke="#c9a84c" strokeWidth="1.2" />
        <path d="M26 9 L23 17 Q26 19 29 17 Z" fill="none" stroke="#c9a84c" strokeWidth="1.2" />
      </motion.g>
      <rect x="11" y="27" width="10" height="2" fill="#c9a84c" rx="1" />
    </motion.svg>
  )
}

/* ── Court Ticker ────────────────────────────────────────────────────────── */
function CourtTicker({ cases }) {
  const active = cases.filter(c => c.status !== 'error')
  if (active.length === 0) return null
  const urgencyColor = (score) => {
    if ((score || 0) >= 75) return 'var(--crimson)'
    if ((score || 0) >= 50) return 'var(--amber)'
    return 'var(--teal)'
  }
  const items = [...active, ...active]
  return (
    <div className="court-ticker">
      <div className="ticker-label">DOCKET</div>
      <div className="ticker-track">
        <div className="ticker-content">
          {items.map((c, i) => (
            <span key={i} className="ticker-item">
              <span className="ticker-dot" style={{ background: urgencyColor(c.urgencyScore) }} />
              <span style={{ color: 'var(--text-warm)' }}>
                {c.originalName?.replace('.pdf','').substring(0, 22)}
              </span>
              {c.urgencyScore != null && (
                <span style={{ color: urgencyColor(c.urgencyScore), fontWeight: 700 }}>
                  U:{Math.round(c.urgencyScore)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const TABS = ['Queue', 'Calendar']

export default function Dashboard() {
  const [cases, setCases]     = useState([])
  const [loading, setLoading] = useState(true)
  const [optimizing, setOpt]  = useState(false)
  const [activeTab, setTab]   = useState('Queue')
  const [optMsg, setOptMsg]   = useState('')
  const [isDark, setIsDark]   = useState(true)

  // Persist theme in localStorage and apply to <html>
  useEffect(() => {
    const saved = localStorage.getItem('jq-theme')
    const dark = saved ? saved === 'dark' : true
    setIsDark(dark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    const theme = next ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('jq-theme', theme)
  }

  const fetchCases = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/cases')
      setCases(data)
    } catch { setCases([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchCases()
    const iv = setInterval(fetchCases, 5000)
    return () => clearInterval(iv)
  }, [fetchCases])

  const handleCaseAdded = (newCase) => {
    setCases(prev => {
      const key = newCase._id || newCase.id
      const exists = prev.find(c => (c._id || c.id) === key)
      return exists
        ? prev.map(c => (c._id || c.id) === key ? newCase : c)
        : [newCase, ...prev]
    })
  }

  const handleDelete = (id) => setCases(prev => prev.filter(c => (c._id || c.id) !== id))

  const handleOptimize = async () => {
    setOpt(true); setOptMsg('')
    try {
      const { data } = await axios.post('/api/cases/optimize')
      setCases(data.cases || [])
      setOptMsg(`${data.cases?.length ?? 0} cases re-scheduled`)
      setTab('Calendar')
    } catch { setOptMsg('Optimization failed') }
    finally {
      setOpt(false)
      setTimeout(() => setOptMsg(''), 4000)
    }
  }

  const urgencyRatio = cases.length === 0
    ? 0.5
    : cases.filter(c => (c.urgencyScore || 0) >= 65).length / cases.length

  const completeCases = cases.filter(c => c.status === 'complete')

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <NeuralMesh />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: isDark ? 'rgba(7,8,13,0.88)' : 'rgba(240,232,216,0.92)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(201,168,76,0.12)',
        transition: 'background 0.35s ease',
      }}>
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, var(--gold-dim) 20%, var(--gold) 50%, var(--gold-dim) 80%, transparent 100%)',
          opacity: 0.6,
        }} />

        <div style={{
          maxWidth: 1440, margin: '0 auto',
          padding: '0 1.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 62,
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ScalesIcon urgencyRatio={urgencyRatio} />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                <span className="font-serif" style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Justice
                </span>
                <span className="font-serif text-gold-grad" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  Queue
                </span>
                <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--teal)', marginLeft: 4, border: '1px solid rgba(0,229,200,0.3)', padding: '1px 5px', borderRadius: 3 }}>
                  AI
                </span>
              </div>
              <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: '-2px' }}>
                Neural Legal Triage
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '2px', padding: '3px', background: 'rgba(201,168,76,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(201,168,76,0.1)' }}>
            {TABS.map(tab => (
              <motion.button
                key={tab}
                onClick={() => setTab(tab)}
                className={activeTab === tab ? 'btn btn-brass' : 'btn btn-ghost'}
                style={{ padding: '0.3rem 1rem', fontSize: '0.8rem', borderRadius: '0.375rem' }}
                whileTap={{ scale: 0.96 }}
              >
                {tab === 'Queue' ? '⚡ Queue' : '📋 Docket'}
              </motion.button>
            ))}
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AnimatePresence>
              {optMsg && (
                <motion.span
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--teal)' }}
                >
                  ✦ {optMsg}
                </motion.span>
              )}
            </AnimatePresence>

            <motion.button
              id="optimize-btn"
              className="btn btn-brass"
              onClick={handleOptimize}
              disabled={optimizing || completeCases.length === 0}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ fontSize: '0.8rem', opacity: (optimizing || completeCases.length === 0) ? 0.45 : 1 }}
            >
              {optimizing ? (
                <>
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⚙</motion.span>
                  Optimizing…
                </>
              ) : (
                <><span>🧮</span> Re-Optimize</>
              )}
            </motion.button>

            {/* ── Theme Toggle Button ──────────────────────────────── */}
            <motion.button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title={isDark ? 'Switch to LEXIS LUMEN (light)' : 'Switch to LEXIS NOIR (dark)'}
              style={{
                width: 36, height: 36,
                borderRadius: '50%',
                border: `1px solid ${isDark ? 'rgba(201,168,76,0.3)' : 'rgba(138,94,16,0.3)'}`,
                background: isDark ? 'rgba(201,168,76,0.08)' : 'rgba(138,94,16,0.1)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
                flexShrink: 0,
                transition: 'background 0.3s, border-color 0.3s',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={isDark ? 'moon' : 'sun'}
                  initial={{ rotate: -40, opacity: 0, scale: 0.6 }}
                  animate={{ rotate: 0,   opacity: 1, scale: 1 }}
                  exit={   { rotate:  40, opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.22 }}
                  style={{ display: 'flex' }}
                >
                  {isDark ? '🌙' : '☀️'}
                </motion.span>
              </AnimatePresence>
            </motion.button>

            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 8px var(--teal)' }}
              />
              <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main style={{ flex: 1, maxWidth: 1440, margin: '0 auto', padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', zIndex: 1, width: '100%' }}>

        <StatsBar cases={cases} />

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left: Upload Sidebar */}
          <motion.div layout className="dossier-card" style={{ padding: '1.5rem' }}>
            <div className="gold-rule" style={{ marginBottom: '1.25rem' }}>
              <span>📥</span> Intake
            </div>
            <UploadZone onCaseAdded={handleCaseAdded} />
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(0,229,200,0.04)', border: '1px solid rgba(0,229,200,0.1)' }}>
              <p className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-cold)', lineHeight: 1.7 }}>
                <span style={{ color: 'var(--teal)' }}>PyMuPDF</span> → extract
                <br /><span style={{ color: 'var(--gold)' }}>Legal-BERT</span> → score
                <br /><span style={{ color: 'var(--teal)' }}>OpenCV/YOLO</span> → sign
                <br /><span style={{ color: 'var(--gold)' }}>OR-Tools CP-SAT</span> → schedule
              </p>
            </div>
          </motion.div>

          {/* Right: Queue or Calendar */}
          <motion.div layout>
            <AnimatePresence mode="wait">
              {activeTab === 'Queue' ? (
                <motion.div key="queue" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                  <div className="gold-rule" style={{ marginBottom: '1.25rem' }}>
                    <span>⚡</span> Case Queue
                    <span className="font-mono" style={{ fontSize: '0.65rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                      [{cases.length} matters]
                    </span>
                  </div>

                  {loading ? (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
                    </div>
                  ) : cases.length === 0 ? (
                    <motion.div className="dossier-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ padding: '4rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
                      <h3 className="font-serif" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        No Matters Filed
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Upload a legal document to begin AI triage
                      </p>
                    </motion.div>
                  ) : (
                    <div className="cases-grid">
                      <AnimatePresence>
                        {cases.map((c, i) => (
                          <CaseCard key={c._id || c.id || i} caseData={c} onDelete={handleDelete} />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="calendar" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  className="dossier-card" style={{ padding: '1.5rem' }}>
                  <div className="gold-rule" style={{ marginBottom: '1.25rem' }}>
                    <span>📋</span> Court Docket
                  </div>
                  <JusticeCalendar cases={cases} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>

      {/* ── Court Ticker + Footer ─────────────────────────────────────── */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 40 }}>
        <CourtTicker cases={cases} />
        <footer style={{
          background: isDark ? 'rgba(7,8,13,0.95)' : 'rgba(240,232,216,0.97)',
          borderTop: '1px solid rgba(201,168,76,0.07)',
          padding: '0.6rem 1.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background 0.35s ease',
        }}>
          <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            JUSTICEQUEUE AI · {isDark ? 'LEXIS NOIR' : 'LEXIS LUMEN'} v2.0
          </span>
          <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            Legal-BERT · OR-Tools CP-SAT · OpenCV · PyMuPDF
          </span>
        </footer>
      </div>
    </div>
  )
}
