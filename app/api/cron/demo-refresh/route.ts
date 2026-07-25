import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { HomeworkStatus } from '@prisma/client'

export const maxDuration = 60

/** Returns the Monday of the current school week (snaps Sat/Sun to next Mon) */
function getMonday(): Date {
  const now = new Date()
  const dow = now.getDay()
  const d   = new Date(now)
  if (dow === 6)      d.setDate(now.getDate() + 2)
  else if (dow === 0) d.setDate(now.getDate() + 1)
  else                d.setDate(now.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function lessonDate(weekOffset: number, dayOffset: number, hour: number): Date {
  const d = getMonday()
  d.setDate(d.getDate() + weekOffset * 7 + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

// All seeded demo lessons: { id, weekOffset, day (0=Mon), startH, endH }
const DEMO_LESSONS = [
  // Current week
  { id: 'demo-lesson-9E-d0-h9',   weekOffset: 0, day: 0, startH: 9,  endH: 10 },
  { id: 'demo-lesson-10E-d0-h11', weekOffset: 0, day: 0, startH: 11, endH: 12 },
  { id: 'demo-lesson-11E-d1-h10', weekOffset: 0, day: 1, startH: 10, endH: 11 },
  { id: 'demo-lesson-9E-d2-h9',   weekOffset: 0, day: 2, startH: 9,  endH: 10 },
  { id: 'demo-lesson-11E-d2-h13', weekOffset: 0, day: 2, startH: 13, endH: 14 },
  { id: 'demo-lesson-10E-d3-h11', weekOffset: 0, day: 3, startH: 11, endH: 12 },
  { id: 'demo-lesson-9E-d4-h14',  weekOffset: 0, day: 4, startH: 14, endH: 15 },
  { id: 'demo-lesson-7A-eng',      weekOffset: 0, day: 1, startH: 14, endH: 15 },
  { id: 'demo-lesson-7B-maths',    weekOffset: 0, day: 3, startH: 9,  endH: 10 },
  // Next week (future unscheduled)
  { id: 'demo-future-9E-d0',  weekOffset: 1, day: 0, startH: 9,  endH: 10 },
  { id: 'demo-future-10E-d1', weekOffset: 1, day: 1, startH: 11, endH: 12 },
  { id: 'demo-future-11E-d2', weekOffset: 1, day: 2, startH: 9,  endH: 10 },
]

// Demo homework IDs with the daysFromNow offset used at seed time
const DEMO_HW_FUTURE = [
  { id: 'demo-hw-macbeth-1',    daysAhead: 5  },
  { id: 'demo-hw-adapted-1',    daysAhead: 5  },
  { id: 'demo-hw-paper2-1',     daysAhead: 10 },
  { id: 'demo-hw-7A-desc-std',  daysAhead: 6  },
  { id: 'demo-hw-7A-desc-scaf', daysAhead: 6  },
  { id: 'demo-hw-7B-frac-std',  daysAhead: 5  },
  { id: 'demo-hw-7B-frac-scaf', daysAhead: 7  },
]

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let lessonsUpdated = 0
  let hwUpdated = 0

  // 1. Refresh demo lesson dates to the current school week
  for (const l of DEMO_LESSONS) {
    try {
      const result = await prisma.lesson.updateMany({
        where: { id: l.id },
        data: {
          scheduledAt: lessonDate(l.weekOffset, l.day, l.startH),
          endsAt:      lessonDate(l.weekOffset, l.day, l.endH),
        },
      })
      lessonsUpdated += result.count
    } catch (err) {
      console.error(`[demo-refresh] lesson ${l.id} failed:`, err)
    }
  }

  // 2. Refresh PUBLISHED demo homework that is now in the past
  for (const hw of DEMO_HW_FUTURE) {
    try {
      const result = await prisma.homework.updateMany({
        where: {
          id:     hw.id,
          status: HomeworkStatus.PUBLISHED,
          dueAt:  { lt: new Date() },
        },
        data: { dueAt: daysFromNow(hw.daysAhead) },
      })
      hwUpdated += result.count
    } catch (err) {
      console.error(`[demo-refresh] homework ${hw.id} failed:`, err)
    }
  }

  // 3. Also refresh 'demo-hw-aic-1' which has past submissions but the hw
  //    itself should stay PUBLISHED with a future due date for new demo users
  try {
    await prisma.homework.updateMany({
      where: { id: 'demo-hw-aic-1', status: HomeworkStatus.PUBLISHED, dueAt: { lt: new Date() } },
      data: { dueAt: daysFromNow(5) },
    })
  } catch { /* ignore */ }

  console.log(`[demo-refresh] lessons=${lessonsUpdated} hw=${hwUpdated}`)
  return NextResponse.json({ ok: true, lessonsUpdated, hwUpdated })
}
