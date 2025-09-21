import { useEffect, useMemo, useState } from 'react'
import collectMindLogo from '/images/icon_origin.png'
import './App.css'

type Availability = 'available' | 'downloadable' | 'unavailable' | string

declare global {
  interface Window {
    Summarizer?: any
  }
  const Summarizer: any
}

function App() {
  const [supported, setSupported] = useState(false)
  const [availability, setAvailability] = useState<Availability>('unavailable')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>('')

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
        } catch (e) {
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
    setSummary('')
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

      setSummary(threeSentences || raw)
    } catch (e: any) {
      setError(e?.message || 'failed to summarize')
    } finally {
      setLoading(false)
    }
  }

  const availabilityTip = useMemo(() => {
    if (!supported) return 'Required APIs are not supported on this browser'
    if (availability === 'downloadable') return 'model is downloadable'
    if (availability === 'available') return 'model is available'
    return 'model is unavailable'
  }, [supported, availability])

  return (
    <>
      <div>
        <a href="https://github.com/lrx0014/CollectMind" target="_blank">
          <img src={collectMindLogo} className="logo" alt="CollectMind logo" />
        </a>
      </div>
      <h1>CollectMind</h1>

      <div className="summary-toolbar">
        <button onClick={handleSummarize} disabled={loading}>
          {loading ? 'Summarizing…' : 'Summarize'}
        </button>
        <br></br>
        <span className="availability">{availabilityTip}</span>
      </div>

      {error && <p className="error">{error}</p>}
      {summary && (
        <div className="summary-box">
          <h3>TL;DR</h3>
          <p>{summary}</p>
        </div>
      )}
    </>
  )
}

export default App
