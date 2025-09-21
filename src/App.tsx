import { useEffect, useRef, useState } from 'react'
import collectMindLogo from '/images/icon_origin.png'
import './App.css'

type Availability = 'available' | 'downloadable' | 'unavailable' | string

declare global {
  interface Window {
    Summarizer?: any
  }
  const Summarizer: any
}

export default function App() {
  const [supported, setSupported] = useState(false)
  const [availability, setAvailability] = useState<Availability>('unavailable')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [compact, setCompact] = useState(false)
  const [summary, setSummary] = useState('')
  const [summaryPending, setSummaryPending] = useState('')

  const heroRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const onEnd = () => {
      if (compact && summaryPending) {
        setSummary(summaryPending)
        setSummaryPending('')
      }
    }
    el.addEventListener('transitionend', onEnd)
    return () => el.removeEventListener('transitionend', onEnd)
  }, [compact, summaryPending])

  async function extractPageTextFromActiveTab(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab')

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          const sel = window.getSelection?.()?.toString?.().trim()
          const baseText =
            sel && sel.length > 80
              ? sel
              : document.body?.innerText || document.documentElement?.innerText || ''

          const cleaned = baseText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && l.length < 2000)
            .join('\n')

          return cleaned.slice(0, 8000)
        } catch {
          return ''
        }
      }
    } as any)

    const text = (result as string) || ''
    if (!text || text.trim().length < 50) {
      throw new Error('No sufficient content extracted from active tab')
    }
    return text
  }

  async function handleSummarize() {
    setError(null)
    setLoading(true)
    try {
      if (!supported) throw new Error('Required APIs are not supported on this browser')
      if (availability === 'unavailable') {
        throw new Error('Required APIs are not supported on this browser')
      }

      const text = await extractPageTextFromActiveTab()

      const summarizer = await Summarizer.create({
        type: 'tldr',
        length: 'long',
        format: 'plain-text'
      })

      const raw: string = await summarizer.summarize(text)

      const threeSentences = raw
        .replace(/\s+/g, ' ')
        .split(/(?<=[。！？.!?])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3)
        .join(' ')

      setSummaryPending(threeSentences || raw)

      if (!compact) setCompact(true)
    } catch (e: any) {
      setError(e?.message || 'failed to summarize')
    } finally {
      setLoading(false)
    }
  }

  // const availabilityTip = useMemo(() => {
  //   if (!supported) return 'Required APIs are not supported on this browser'
  //   if (availability === 'downloadable') return 'model is downloadable'
  //   if (availability === 'available') return 'model is available'
  //   return 'model is unavailable'
  // }, [supported, availability])

  return (
    <div className={`cm-shell ${compact ? 'is-compact' : ''}`}>
      {/* head */}
      <div ref={heroRef} className="cm-hero">
        <div className="cm-brand">
          <img src={collectMindLogo} className="cm-logo" alt="CollectMind logo" />
          <h1 className="cm-title">CollectMind</h1>
        </div>

        <div className="cm-actions">
          <button className="cm-btn" onClick={handleSummarize} disabled={loading}>
            {loading ? 'Summarizing…' : 'Summarize'}
          </button>
          {/* <span className="cm-tip">{availabilityTip}</span> */}
        </div>
      </div>

      {/* content container */}
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
