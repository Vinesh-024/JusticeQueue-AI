import React from 'react'
import { motion } from 'framer-motion'

const STATS = [
  {
    key: 'total',
    label: 'Total Matters',
    icon: '⚖',
    borderColor: 'var(--gold)',
    valueColor: 'var(--gold)',
    desc: 'filed',
  },
  {
    key: 'analyzing',
    label: 'Under Review',
    icon: '🔬',
    borderColor: 'var(--teal)',
    valueColor: 'var(--teal)',
    desc: 'active',
  },
  {
    key: 'highUrgency',
    label: 'Critical Priority',
    icon: '⚠',
    borderColor: 'var(--crimson)',
    valueColor: 'var(--crimson)',
    desc: 'urgent',
  },
  {
    key: 'scheduled',
    label: 'Docketed',
    icon: '📋',
    borderColor: 'var(--emerald)',
    valueColor: 'var(--emerald)',
    desc: 'scheduled',
  },
]

/* Tiny sparkline bars (pure CSS, no lib) */
function MiniBar({ value, max, color }) {
  const bars = 8
  const fill = Math.round((value / Math.max(max, 1)) * bars)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 18 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} style={{
          width: 3,
          height: 4 + i * 1.75,
          borderRadius: 1,
          background: i < fill ? color : 'rgba(255,255,255,0.06)',
          transition: 'background 0.4s',
        }} />
      ))}
    </div>
  )
}

export default function StatsBar({ cases }) {
  const metrics = {
    total:       cases.length,
    analyzing:   cases.filter(c => c.status === 'analyzing').length,
    highUrgency: cases.filter(c => (c.urgencyScore || 0) >= 65).length,
    scheduled:   cases.filter(c => c.scheduledSlot).length,
  }
  const maxVal = Math.max(metrics.total, 1)

  return (
    <div className="stats-grid">
      {STATS.map((stat, i) => (
        <motion.div
          key={stat.key}
          className="ledger-card"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.35 }}
          whileHover={{ x: 6 }}
          style={{ borderLeftColor: stat.borderColor }}
        >
          {/* Left: icon + number */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{stat.icon}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span className="font-mono" style={{ fontSize: '2.1rem', fontWeight: 700, color: stat.valueColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {metrics[stat.key]}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{stat.desc}</span>
            </div>
          </div>

          {/* Right: sparkline */}
          <MiniBar value={metrics[stat.key]} max={maxVal} color={stat.borderColor} />
        </motion.div>
      ))}
    </div>
  )
}
