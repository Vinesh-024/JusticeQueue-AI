import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import LiveScanBar from './LiveScanBar'

const SCAN_STEPS = ['uploading', 'extracting', 'bert', 'signature', 'optimizing']

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export default function UploadZone({ onCaseAdded }) {
  const [scanStep, setScanStep]   = useState(null)
  const [hasError, setHasError]   = useState(false)
  const [isDragging, setDragging] = useState(false)
  const [filename, setFilename]   = useState('')

  const processUpload = useCallback(async (file) => {
    setHasError(false)
    setFilename(file.name)
    setScanStep(SCAN_STEPS[0])

    const formData = new FormData()
    formData.append('file', file)

    let caseId
    try {
      const resp = await axios.post('/api/cases/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      caseId = resp.data.caseId
    } catch {
      setHasError(true)
      return
    }

    await delay(700);  setScanStep(SCAN_STEPS[1])
    await delay(1000); setScanStep(SCAN_STEPS[2])
    await delay(1300); setScanStep(SCAN_STEPS[3])
    await delay(900);  setScanStep(SCAN_STEPS[4])

    let done = false, attempts = 0
    while (!done && attempts < 40) {
      await delay(1500)
      attempts++
      try {
        const { data } = await axios.get(`/api/cases/${caseId}`)
        if (data.status === 'complete' || data.status === 'error') {
          done = true
          setScanStep(null)
          onCaseAdded(data)
          return
        }
      } catch {}
    }
    setScanStep(null)
    try { const { data } = await axios.get(`/api/cases/${caseId}`); onCaseAdded(data) } catch {}
  }, [onCaseAdded])

  const onDrop = useCallback((accepted) => {
    setDragging(false)
    if (accepted.length > 0) processUpload(accepted[0])
  }, [processUpload])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    noClick: false,
    onDragEnter: () => setDragging(true),
    onDragLeave: () => setDragging(false),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <AnimatePresence>
        {!scanStep && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            {...getRootProps()}
            className={`scanner-zone ${isDragActive || isDragging ? 'drag-active' : ''}`}
            style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', textAlign: 'center' }}
          >
            <input {...getInputProps()} id="pdf-upload-input" />

            {/* Scan beam */}
            <div className="scan-beam" />

            {/* Scanner glass reflection */}
            <div style={{
              position: 'absolute', top: 6, left: '10%', right: '10%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(0,229,200,0.35), transparent)',
              pointerEvents: 'none',
            }} />

            {/* Icon */}
            <motion.div
              animate={{ y: isDragActive ? -6 : 0 }}
              transition={{ type: 'spring', stiffness: 280 }}
              style={{
                width: 56, height: 56, borderRadius: '12px',
                background: 'rgba(0,229,200,0.07)',
                border: '1px solid rgba(0,229,200,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem',
              }}
            >
              {isDragActive ? '📄' : '🖨'}
            </motion.div>

            <div>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                {isDragActive ? 'Release to load document…' : 'Place document on scanner'}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                PDF only · max 50 MB · drag & drop or click
              </p>
            </div>

            <motion.button
              className="btn btn-teal"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{ marginTop: '0.15rem', fontSize: '0.82rem' }}
              onClick={e => { e.stopPropagation(); open(); }}
              type="button"
            >
              <span>⬆</span> Load Document
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanStep && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Analyzing:</span>
              <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 600 }}>
                {filename.length > 28 ? filename.substring(0, 28) + '…' : filename}
              </span>
            </div>
            <LiveScanBar currentStep={scanStep} error={hasError} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
