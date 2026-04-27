import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

/* ── Quick Prompt Suggestions ───────────────────────────────────────────── */
const QUICK_PROMPTS = [
  { icon: '📋', label: 'Summarize',      text: 'Give me a concise professional summary of this case.' },
  { icon: '⚠️', label: 'Red Flags',     text: 'What are the most critical red flags I should address immediately?' },
  { icon: '📅', label: 'Prepare',        text: 'What specific preparation steps do I need before the hearing?' },
  { icon: '⚖️', label: 'Legal Issues',  text: 'What are the primary legal issues and applicable statutes in this document?' },
  { icon: '👥', label: 'Parties',        text: 'Identify all parties mentioned and their roles in this matter.' },
  { icon: '⏰', label: 'Deadlines',      text: 'Are there any critical deadlines, filing dates, or limitation periods mentioned?' },
]

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.75rem 1rem' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--gold-dim), var(--teal-dim))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', flexShrink: 0,
      }}>L</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }}
          />
        ))}
      </div>
      <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>LEXIS is analyzing…</span>
    </div>
  )
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: '0.2rem 0.75rem',
      }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginRight: 8,
          background: 'linear-gradient(135deg, var(--gold-dim), var(--teal-dim))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: '#fff',
          border: '1px solid rgba(201,168,76,0.3)',
        }}>L</div>
      )}
      <div style={{
        maxWidth: '80%',
        padding: '0.65rem 0.9rem',
        borderRadius: isUser ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
        background: isUser
          ? 'linear-gradient(135deg, var(--gold-dim), rgba(138,94,16,0.6))'
          : 'var(--bg-elevated)',
        border: isUser
          ? '1px solid rgba(201,168,76,0.3)'
          : '1px solid var(--card-border)',
        fontSize: '0.82rem',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
      {isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginLeft: 8,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--card-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem',
        }}>👤</div>
      )}
    </motion.div>
  )
}

export default function LegalChat({ caseData, onClose, initialAnalysis }) {
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const caseId = caseData._id || caseData.id

  // Seed with LEXIS intro message on open
  useEffect(() => {
    const intro = initialAnalysis?.summary
      ? `⚖️ **Case loaded: ${caseData.originalName}**\n\nI've analyzed this document. Here's my initial assessment:\n\n${initialAnalysis.summary}\n\n${initialAnalysis.urgencyReason ? `**Urgency:** ${initialAnalysis.urgencyReason}` : ''}\n\nHow can I assist you with this matter?`
      : `⚖️ **Case loaded: ${caseData.originalName}**\n\nI'm LEXIS, your AI legal triage assistant. This case has an urgency score of **${Math.round(caseData.urgencyScore || 0)}/100** and complexity of **${Math.round(caseData.complexityScore || 0)}/100**.\n\nAsk me anything about this document, or use the quick prompts below.`

    setMessages([{ role: 'assistant', content: intro }])
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setError('')

    const userMsg = { role: 'user', content: msg }
    const history = messages.filter(m => m.role !== 'system')

    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const { data } = await axios.post(`/api/gemini/chat/${caseId}`, {
        message: msg,
        history: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (err) {
      const errMsg = err.response?.data?.error || 'LEXIS is temporarily unavailable.'
      setError(errMsg)
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 12 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      style={{
        position: 'fixed',
        bottom: '4.5rem', right: '1.5rem',
        width: 380, height: 500, maxHeight: 'calc(100vh - 140px)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--card-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)',
        background: 'var(--bg-dark)',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(138,94,16,0.25) 0%, rgba(0,122,110,0.15) 100%)',
        borderBottom: '1px solid var(--card-border)',
        padding: '0.85rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* LEXIS Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-dim) 0%, var(--teal-dim) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.9rem', fontWeight: 900, color: '#fff',
            border: '2px solid rgba(201,168,76,0.4)',
            boxShadow: '0 0 14px rgba(201,168,76,0.3)',
            flexShrink: 0,
          }}>L</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="font-serif" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                LEXIS
              </span>
              <span className="font-mono" style={{
                fontSize: '0.55rem', color: 'var(--teal)', fontWeight: 700,
                border: '1px solid rgba(0,229,200,0.3)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em',
              }}>
                AI COUNSEL
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {caseData.originalName?.substring(0, 30)}{caseData.originalName?.length > 30 ? '…' : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 6px var(--teal)' }}
            />
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>GEMINI</span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)',
            color: 'var(--crimson)', borderRadius: '0.375rem', cursor: 'pointer',
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 700,
          }}>✕</button>
        </div>
      </div>

      {/* ── Case Context Strip ───────────────────────────────────────── */}
      <div style={{
        background: 'rgba(201,168,76,0.04)',
        borderBottom: '1px solid rgba(201,168,76,0.08)',
        padding: '0.5rem 1rem',
        display: 'flex', gap: '1rem', flexShrink: 0,
      }}>
        {[
          { label: 'Urgency', val: `${Math.round(caseData.urgencyScore || 0)}`, color: (caseData.urgencyScore || 0) >= 65 ? 'var(--crimson)' : 'var(--amber)' },
          { label: 'Complexity', val: `${Math.round(caseData.complexityScore || 0)}%`, color: 'var(--teal)' },
          { label: 'Type', val: initialAnalysis?.caseType || caseData.caseType || 'Unknown', color: 'var(--gold)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1 }}>
            <div className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            <div className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Message Thread ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        </AnimatePresence>
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick Prompts ────────────────────────────────────────────── */}
      <div style={{
        padding: '0.5rem 0.75rem',
        borderTop: '1px solid rgba(201,168,76,0.06)',
        display: 'flex', gap: '0.35rem', flexWrap: 'wrap',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.1)',
      }}>
        {QUICK_PROMPTS.map(qp => (
          <motion.button
            key={qp.label}
            onClick={() => sendMessage(qp.text)}
            whileHover={{ scale: 1.04, background: 'rgba(201,168,76,0.15)' }}
            whileTap={{ scale: 0.96 }}
            disabled={loading}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid rgba(201,168,76,0.15)',
              background: 'rgba(201,168,76,0.06)',
              color: 'var(--text-warm)',
              fontSize: '0.65rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
              fontFamily: 'DM Sans, sans-serif',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <span>{qp.icon}</span>{qp.label}
          </motion.button>
        ))}
      </div>

      {/* ── Input Area ───────────────────────────────────────────────── */}
      <div style={{
        padding: '0.65rem 0.75rem',
        borderTop: '1px solid var(--card-border)',
        display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
        flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask LEXIS about this case… (Enter to send)"
          rows={1}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', border: '1px solid var(--card-border)',
            borderRadius: '0.5rem',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            padding: '0.55rem 0.75rem',
            fontSize: '0.82rem', lineHeight: 1.5,
            fontFamily: 'DM Sans, sans-serif',
            outline: 'none',
            maxHeight: 90, overflowY: 'auto',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
          onBlur={e => e.target.style.borderColor = 'var(--card-border)'}
        />
        <motion.button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="btn btn-brass"
          style={{
            padding: '0.55rem 0.9rem', fontSize: '0.82rem',
            opacity: !input.trim() || loading ? 0.4 : 1,
            flexShrink: 0,
          }}
        >
          {loading ? '⏳' : '↑'}
        </motion.button>
      </div>
    </motion.div>
  )
}
