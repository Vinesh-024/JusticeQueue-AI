import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS = [
  { key: 'uploading',  label: 'Document Loaded',       sub: 'Transmitting to intake server' },
  { key: 'extracting', label: 'Text Extraction',        sub: 'PyMuPDF parsing pages & layout' },
  { key: 'bert',       label: 'Legal-BERT Analysis',    sub: 'Scoring urgency & complexity' },
  { key: 'signature',  label: 'Signature Detection',    sub: 'OpenCV contour scan (YOLO-stub)' },
  { key: 'optimizing', label: 'Scheduling Optimization',sub: 'OR-Tools CP-SAT slot assignment' },
]
const STEP_KEYS = STEPS.map(s => s.key)

/* Animated waveform — active when scanning, flat otherwise */
function WaveForm({ active, error }) {
  const color = error ? 'var(--crimson)' : 'var(--teal)'
  if (!active) {
    return (
      <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ height: 1.5, flex: 1, background: color, opacity: 0.3, borderRadius: 2 }} />
      </div>
    )
  }
  return (
    <div className="wave-bar" style={{ flex: 1 }}>
      {[16, 10, 20, 8, 18, 12, 20].map((h, i) => (
        <span key={i} style={{ '--h': `${h}px`, minHeight: 4 }} />
      ))}
    </div>
  )
}

export default function LiveScanBar({ currentStep, error }) {
  const currentIndex = STEP_KEYS.indexOf(currentStep)

  return (
    <div className="dossier-card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Chain of Custody
          </span>
        </div>
        <WaveForm active={!!currentStep && !error} error={error} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {STEPS.map((step, idx) => {
          const isDone   = idx < currentIndex
          const isActive = idx === currentIndex
          const stepClass = isDone ? 'step-done' : isActive ? 'step-active' : ''

          return (
            <motion.div
              key={step.key}
              className={`custody-step ${stepClass}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
            >
              {/* Dot */}
              <div className="custody-dot">
                {isDone && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    style={{ fontSize: '0.55rem', color: 'var(--gold)', fontWeight: 800 }}
                  >✓</motion.span>
                )}
              </div>

              {/* Label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isDone
                      ? 'var(--gold)'
                      : isActive
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                    transition: 'color 0.3s',
                  }}>
                    {step.label}
                  </span>
                  {isActive && !error && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="font-mono"
                      style={{ fontSize: '0.62rem', color: 'var(--teal)' }}
                    >
                      processing_
                    </motion.span>
                  )}
                  {isDone && (
                    <span className="badge badge-gold" style={{ fontSize: '0.55rem', padding: '1px 6px' }}>done</span>
                  )}
                </div>
                {(isActive || isDone) && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {step.sub}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Bottom progress line */}
      <div style={{ marginTop: '1rem', height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 9999, overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: error
              ? 'var(--crimson)'
              : 'linear-gradient(90deg, var(--gold-dim), var(--teal))',
            borderRadius: 9999,
          }}
        />
      </div>
    </div>
  )
}
