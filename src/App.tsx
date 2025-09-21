import { useEffect, useMemo, useState } from 'react'
import collectMindLogo from '/images/icon_origin.png'
import './App.css'

type Availability = 'available' | 'downloadable' | 'unavailable' | string

declare global {
  interface Window { Summarizer?: any }
  const Summarizer: any
}

export default function App() {
  const [supported, setSupported] = useState(false)
  const [availability, setAvailability] = useState<Availability>('unavailable')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>('')

  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const has = typeof window !== 'undefined' && 'Summarizer' in window
    setSupported(has)
    if (has) {
      ;(async () => {
        try {
          const av = await Summarizer.availability()
          setAvailability(av)
        } catch {
          setAvailability('unavailable')
        }
      })()
    }
  }, [])

  async function extractPageTextFromActiveTab(): Promise<string> {
    if (location.protocol !== 'chrome-extension:') {
      throw new Error('environment error')
    }
    const resp = await chrome.runtime.sendMessage({ type: 'collectmind:extract' })
    if (!resp?.ok) throw new Error(resp?.error || 'unable to extract text from active tab')
    if (!resp.text || resp.text.trim().length < 50) {
      throw new Error('no sufficient text to extract from active tab')
    }
    return resp.text as string
  }

  async function handleSummarize() {
    setError(null)
    setLoading(true)

    if (!compact) setCompact(true)

    try {
      if (!supported) throw new Error('Required APIs are not supported on this device')
      if (availability === 'unavailable') {
        throw new Error('Required APIs are not supported on this device')
      }

      const text = await extractPageTextFromActiveTab()
      const summarizer = await Summarizer.create({
        type: 'tldr',
        length: 'long',
        format: 'plain-text'
      })
      const raw: string = await summarizer.summarize(text)
      const three = raw
        .replace(/\s+/g, ' ')
        .split(/(?<=[。！？.!?])/)
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(' ')
      setSummary(three || raw)
    } catch (e: any) {
      setError(e?.message || 'failed to summarize')
    } finally {
      setLoading(false)
    }
  }

  const availabilityTip = useMemo(() => {
    if (!supported) return 'Required APIs are not supported on this device'
    if (availability === 'downloadable') return 'model is downloadable, it will be downloaded automatically'
    if (availability === 'available') return 'model is available'
    return 'model is unavailable'
  }, [supported, availability])

  return (
    <div className={`cm-shell ${compact ? 'is-compact' : ''}`}>
      {/* head container */}
      <div className="cm-hero">
        <div className="cm-brand">
          <img src={collectMindLogo} className="cm-logo" alt="CollectMind logo" />
          <h1 className="cm-title">CollectMind</h1>
        </div>

        <div className="cm-actions">
          <button className="cm-btn" onClick={handleSummarize} disabled={loading}>
            {loading ? 'Summarizing…' : 'Summarize'}
          </button>
        </div>
        <span className="cm-tip" title={availabilityTip}>{availabilityTip}</span>
      </div>

      {/* Content */}
      <div className="cm-content">
        {error && <p className="cm-error">{error}</p>}
        {summary && (
          <div className="cm-summary">
            <h3>TL;DR</h3>
            <p>{summary}</p>
          </div>
        )}
      </div>
    </div>
  )
}
