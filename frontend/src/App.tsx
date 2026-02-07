import React, { useEffect, useState } from 'react'

type Event = { id: string; type: 'in' | 'out'; time: number }

export default function App() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  async function fetchEvents() {
    setLoading(true)
    try {
      const r = await fetch(`/api/attendance?date=${today}`)
      const data = await r.json()
      setEvents(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  async function clock(type: 'in' | 'out') {
    setLoading(true)
    try {
      await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      await fetchEvents()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function deleteEvent(id: string, date?: string) {
    if (!confirm('この打刻を削除しますか？')) return
    try {
      await fetch(`/api/attendance/${id}`, { method: 'DELETE' })
      await fetchEvents()
      await fetchSummary()
    } catch (e) {
      console.error(e)
    }
  }

  async function editEvent(id: string, currentTime: number) {
    const hhmm = prompt('新しい時刻を入力してください (HH:MM)。現在: ' + new Date(currentTime).toLocaleTimeString())
    if (!hhmm) return
    const m = hhmm.match(/^\s*(\d{1,2}):(\d{2})\s*$/)
    if (!m) { alert('形式は HH:MM です'); return }
    const hh = Number(m[1])
    const mm = Number(m[2])
    const d = new Date(currentTime)
    d.setHours(hh, mm, 0, 0)
    const newTs = d.getTime()
    try {
      await fetch(`/api/attendance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: newTs })
      })
      await fetchEvents()
      await fetchSummary()
    } catch (e) {
      console.error(e)
    }
  }

  // 月別集計
  const monthDefault = new Date().toISOString().slice(0,7) // YYYY-MM
  const [month, setMonth] = useState<string>(monthDefault)
  const [summary, setSummary] = useState<Record<string, { in?: number; out?: number }>>({})
  const [summaryLoading, setSummaryLoading] = useState(false)

  async function fetchSummary(selectedMonth?: string) {
    setSummaryLoading(true)
    try {
      const m = selectedMonth || month
      const r = await fetch(`/api/attendance/summary/${m}`)
      const data = await r.json()
      setSummary(data.summary || {})
    } catch (e) {
      console.error(e)
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>勤怠管理 (Kintai)</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => clock('in')} disabled={loading} style={{ marginRight: 8 }}>
          出勤
        </button>
        <button onClick={() => clock('out')} disabled={loading}>
          退勤
        </button>
      </div>

      <h3>今日の打刻 — {today}</h3>
      {loading && <div>読み込み中...</div>}
      {!loading && events.length === 0 && <div>まだ打刻がありません。</div>}

      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {e.type === 'in' ? '出勤' : '退勤'} — {new Date(e.time).toLocaleTimeString()}
            <button onClick={() => editEvent(e.id, e.time)} style={{ marginLeft: 8 }}>編集</button>
            <button onClick={() => deleteEvent(e.id)} style={{ marginLeft: 6 }}>削除</button>
          </li>
        ))}
      </ul>

      <hr style={{ margin: '20px 0' }} />

      <h3>月別集計</h3>
      <div style={{ marginBottom: 8 }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button onClick={() => fetchSummary()} style={{ marginLeft: 8 }} disabled={summaryLoading}>
          表示
        </button>
      </div>

      {summaryLoading && <div>集計を取得中...</div>}

      {!summaryLoading && Object.keys(summary).length === 0 && <div>データがありません。</div>}

      {!summaryLoading && Object.keys(summary).length > 0 && (
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', padding: '6px 12px' }}>日付</th>
              <th style={{ borderBottom: '1px solid #ccc', padding: '6px 12px' }}>出勤</th>
              <th style={{ borderBottom: '1px solid #ccc', padding: '6px 12px' }}>退勤</th>
              <th style={{ borderBottom: '1px solid #ccc', padding: '6px 12px' }}>勤務時間</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(summary).sort().map(d => {
              const s = summary[d]
              const inT = s.in
              const outT = s.out
              const worked = inT && outT ? ((outT - inT) / 1000 / 60 / 60) : undefined
              return (
                <tr key={d}>
                  <td style={{ padding: '6px 12px' }}>{d}</td>
                  <td style={{ padding: '6px 12px' }}>{inT ? new Date(inT).toLocaleTimeString() : '-'}</td>
                  <td style={{ padding: '6px 12px' }}>{outT ? new Date(outT).toLocaleTimeString() : '-'}</td>
                  <td style={{ padding: '6px 12px' }}>{worked !== undefined ? `${worked.toFixed(2)} h` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
