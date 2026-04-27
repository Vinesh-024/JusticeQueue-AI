import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, addDays, startOfWeek, parseISO } from 'date-fns'

const HOURS = Array.from({ length: 16 }, (_, i) => {
  const h = 9 + Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return { label: `${h}:${m}`, isHour: i % 2 === 0 }
})

function getWeekDays(ref) {
  const monday = startOfWeek(ref, { weekStartsOn: 1 })
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i))
}

function pinColor(score) {
  if (score >= 75) return { bg: 'rgba(230,57,70,0.18)',  border: 'var(--crimson)',  text: '#fb7185' }
  if (score >= 50) return { bg: 'rgba(244,162,97,0.18)', border: 'var(--amber)',    text: '#fbbf24' }
  return              { bg: 'rgba(0,229,200,0.12)',       border: 'var(--teal)',     text: 'var(--teal)' }
}

function isToday(day) {
  return format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
}

export default function JusticeCalendar({ cases }) {
  const [weekOffset, setWeekOffset] = React.useState(0)

  const ref = addDays(new Date(), weekOffset * 7)
  const weekDays = getWeekDays(ref)
  const todayIdx = weekDays.findIndex(d => isToday(d))

  // Slot map: "dayIdx-slotIdx" → case
  const slotMap = {}
  cases.forEach(c => {
    if (!c.scheduledSlot) return
    try {
      const d = parseISO(c.scheduledSlot)
      const di = d.getDay() - 1
      if (di < 0 || di > 4) return
      const si = Math.round((d.getHours() * 60 + d.getMinutes() - 540) / 30)
      if (si < 0 || si > 15) return
      slotMap[`${di}-${si}`] = c
    } catch {}
  })

  return (
    <div>
      {/* Week Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <span className="font-serif" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {format(weekDays[0], 'MMM d')}
          </span>
          <span style={{ color: 'var(--text-muted)', margin: '0 0.4rem' }}>—</span>
          <span className="font-serif" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {format(weekDays[4], 'MMM d, yyyy')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="btn btn-ghost" onClick={() => setWeekOffset(w => w - 1)} style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem' }}>◀</button>
          <button className="btn btn-ghost" onClick={() => setWeekOffset(0)} style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem' }}>Today</button>
          <button className="btn btn-ghost" onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem' }}>▶</button>
        </div>
      </div>

      {/* Docket Grid */}
      <div className="docket-grid">
        {/* Corner */}
        <div className="docket-header" />

        {/* Day headers */}
        {weekDays.map((day, di) => (
          <div key={di} className={`docket-header ${isToday(day) ? 'today-col' : ''}`}>
            <span style={{
              fontSize: '0.6rem', fontWeight: 600,
              color: isToday(day) ? 'var(--gold)' : 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              {format(day, 'EEE')}
            </span>
            <span style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 700, fontSize: '1.15rem',
              color: isToday(day) ? 'var(--gold)' : 'var(--text-primary)',
            }}>
              {format(day, 'd')}
            </span>
          </div>
        ))}

        {/* Time rows */}
        {HOURS.map(({ label, isHour }, si) => (
          <React.Fragment key={si}>
            <div className={`docket-time ${isHour ? 'hour-mark' : ''}`}>{label}</div>
            {weekDays.map((_, di) => {
              const caseItem = slotMap[`${di}-${si}`]
              const colors = caseItem ? pinColor(caseItem.urgencyScore || 0) : null
              const todayHighlight = di === todayIdx

              return (
                <div key={di} className={`docket-cell ${todayHighlight ? 'today-col' : ''}`}>
                  <AnimatePresence>
                    {caseItem && (
                      <motion.div
                        className="docket-pin"
                        layout
                        initial={{ opacity: 0, scaleY: 0.5 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.5 }}
                        whileHover={{ zIndex: 10, scale: 1.04 }}
                        title={caseItem.originalName}
                        style={{
                          background: colors.bg,
                          borderTopColor: colors.border,
                          color: colors.text,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontSize: '0.6rem' }}>
                          {caseItem.originalName?.replace('.pdf', '').substring(0, 14)}
                        </span>
                        <span className="font-mono" style={{ fontSize: '0.55rem', opacity: 0.75 }}>
                          U{Math.round(caseItem.urgencyScore ?? 0)}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Empty state */}
      {cases.filter(c => c.scheduledSlot).length === 0 && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic', fontFamily: 'Playfair Display, serif' }}>
          No matters docketed — upload documents and click Re-Optimize
        </div>
      )}
    </div>
  )
}
