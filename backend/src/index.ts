import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()
app.use(cors())
app.use(express.json())

function dateKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10)
}

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, time: Date.now() })
})

app.post('/api/attendance/clock', async (req, res) => {
  const { type } = req.body as { type?: string }
  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ error: 'type must be "in" or "out"' })
  }

  const time = Date.now()
  const date = dateKey(time)
  
  try {
    const ev = await prisma.attendance.create({
      data: { date, type, time: BigInt(time) }
    })
    // update daily summary cache
    const month = date.slice(0,7) // YYYY-MM
    const existing = await prisma.dailySummary.findUnique({ where: { date } })
    if (!existing) {
      const createData: any = { date, month }
      if (type === 'in') createData.inTime = BigInt(time)
      if (type === 'out') createData.outTime = BigInt(time)
      if (createData.inTime && createData.outTime) createData.workedMs = createData.outTime - createData.inTime
      await prisma.dailySummary.create({ data: createData })
    } else {
      let inTime = existing.inTime ?? null
      let outTime = existing.outTime ?? null
      if (type === 'in' && !inTime) inTime = BigInt(time)
      if (type === 'out') outTime = BigInt(time)
      const updateData: any = {}
      if (inTime !== null) updateData.inTime = inTime
      if (outTime !== null) updateData.outTime = outTime
      if (inTime !== null && outTime !== null) updateData.workedMs = outTime - inTime
      await prisma.dailySummary.update({ where: { date }, data: updateData })
    }

    res.status(201).json({ id: ev.id, type: ev.type, time: Number(ev.time) })
  } catch (e) {
    console.error('Clock error:', e)
    res.status(500).json({ error: 'Failed to record attendance' })
  }
})

// recompute daily summary from attendance rows for a date
async function recomputeDailySummary(date: string) {
  const rows = await prisma.attendance.findMany({ where: { date }, orderBy: { time: 'asc' } })
  let firstIn: bigint | null = null
  let lastOut: bigint | null = null
  for (const r of rows) {
    if (r.type === 'in' && firstIn === null) firstIn = r.time
    if (r.type === 'out') lastOut = r.time
  }
  const month = date.slice(0, 7)
  if (!firstIn && !lastOut) {
    // delete summary if exists
    try {
      await prisma.dailySummary.delete({ where: { date } })
    } catch (e) {
      // ignore if not exists
    }
    return
  }
  const data: any = { month }
  if (firstIn) data.inTime = firstIn
  if (lastOut) data.outTime = lastOut
  if (firstIn && lastOut) data.workedMs = lastOut - firstIn

  const exists = await prisma.dailySummary.findUnique({ where: { date } })
  if (exists) {
    await prisma.dailySummary.update({ where: { date }, data })
  } else {
    await prisma.dailySummary.create({ data: { date, ...data } })
  }
}

// Delete attendance by id
app.delete('/api/attendance/:id', async (req, res) => {
  const { id } = req.params
  try {
    const ev = await prisma.attendance.findUnique({ where: { id } })
    if (!ev) return res.status(404).json({ error: 'not found' })
    await prisma.attendance.delete({ where: { id } })
    await recomputeDailySummary(ev.date)
    res.json({ ok: true })
  } catch (e) {
    console.error('Delete error:', e)
    res.status(500).json({ error: 'Failed to delete' })
  }
})

// Update attendance (time/type)
app.patch('/api/attendance/:id', async (req, res) => {
  const { id } = req.params
  const { time, type } = req.body as { time?: number; type?: string }
  try {
    const ev = await prisma.attendance.findUnique({ where: { id } })
    if (!ev) return res.status(404).json({ error: 'not found' })
    const updateData: any = {}
    if (typeof time === 'number') updateData.time = BigInt(time)
    if (type === 'in' || type === 'out') updateData.type = type
    const updated = await prisma.attendance.update({ where: { id }, data: updateData })
    // if date changed? we don't allow changing date here; recompute for that date
    await recomputeDailySummary(updated.date)
    res.json({ id: updated.id, type: updated.type, time: Number(updated.time) })
  } catch (e) {
    console.error('Patch error:', e)
    res.status(500).json({ error: 'Failed to update' })
  }
})

app.get('/api/attendance', async (req, res) => {
  const date = (req.query.date as string) || dateKey()
  
  try {
    const events = await prisma.attendance.findMany({
      where: { date },
      orderBy: { time: 'asc' }
    })
    const result = events.map(e => ({
      id: e.id,
      type: e.type,
      time: Number(e.time)
    }))
    res.json(result)
  } catch (e) {
    console.error('Query error:', e)
    res.status(500).json({ error: 'Failed to fetch attendance' })
  }
})

app.get('/api/attendance/summary/:month', async (req, res) => {
  const { month } = req.params
  
  try {
    const rows = await prisma.dailySummary.findMany({
      where: { month },
      orderBy: { date: 'asc' }
    })
    const dailySummary: { [date: string]: { in?: number; out?: number } } = {}
    rows.forEach(r => {
      dailySummary[r.date] = {
        in: r.inTime ? Number(r.inTime) : undefined,
        out: r.outTime ? Number(r.outTime) : undefined
      }
    })
    res.json({ month, summary: dailySummary })
  } catch (e) {
    console.error('Summary error:', e)
    res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

const port = process.env.PORT || 3001
app.listen(Number(port), () => {
  console.log(`Backend running on http://localhost:${port}`)
})

