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

function daysAgo(n: number): Date {
  return daysFromNow(-n)
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

// Demo homework: daysAhead for dueAt
const DEMO_HW = [
  { id: 'demo-hw-macbeth-1',    daysAhead: 5 },
  { id: 'demo-hw-adapted-1',    daysAhead: 5 },
  { id: 'demo-hw-paper2-1',     daysAhead: 10 },
  { id: 'demo-hw-7A-desc-std',  daysAhead: 6 },
  { id: 'demo-hw-7A-desc-scaf', daysAhead: 6 },
  { id: 'demo-hw-7B-frac-std',  daysAhead: 5 },
  { id: 'demo-hw-7B-frac-scaf', daysAhead: 7 },
  { id: 'demo-hw-aic-1',        daysAhead: 5 },
]

// Demo notifications: known IDs and their relative timestamps (daysAgo)
const DEMO_NOTIFICATIONS = [
  { id: 'notif-1', daysAgo: 0 },
  { id: 'notif-2', daysAgo: 1 },
  { id: 'notif-3', daysAgo: 1 },
  { id: 'notif-4', daysAgo: 2 },
  { id: 'notif-5', daysAgo: 14 },
  { id: 'notif-6', daysAgo: 3 },
  { id: 'notif-7', daysAgo: 5 },
]

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let lessonsUpdated    = 0
  let hwUpdated         = 0
  let hwReopened        = 0
  let notifsRefreshed   = 0
  let trialsExtended    = 0
  let classesCleanedUp  = 0

  // ── 1. Refresh demo lesson dates to the current school week ──────────────────
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

  // ── 2. Refresh demo homework — update dueAt, reopen if CLOSED ───────────────
  for (const hw of DEMO_HW) {
    try {
      // Reopen CLOSED homework so it's always visible in the demo
      const reopened = await prisma.homework.updateMany({
        where: { id: hw.id, status: HomeworkStatus.CLOSED },
        data: {
          status: HomeworkStatus.PUBLISHED,
          dueAt:  daysFromNow(hw.daysAhead),
        },
      })
      hwReopened += reopened.count

      // Refresh PUBLISHED homework whose due date has passed
      const refreshed = await prisma.homework.updateMany({
        where: {
          id:     hw.id,
          status: HomeworkStatus.PUBLISHED,
          dueAt:  { lt: new Date() },
        },
        data: {
          dueAt: daysFromNow(hw.daysAhead),
        },
      })
      hwUpdated += refreshed.count
    } catch (err) {
      console.error(`[demo-refresh] homework ${hw.id} failed:`, err)
    }
  }

  // ── 3. Refresh demo notification timestamps so they look recent ───────────────
  for (const n of DEMO_NOTIFICATIONS) {
    try {
      const result = await prisma.notification.updateMany({
        where: { id: n.id },
        data:  { createdAt: daysAgo(n.daysAgo) },
      })
      notifsRefreshed += result.count
    } catch (err) {
      console.error(`[demo-refresh] notif ${n.id} failed:`, err)
    }
  }

  // ── 4. Auto-extend nearly-expired active beta trials (≤7 days left → +30d) ──
  // Prevents good leads from getting locked out mid-evaluation.
  try {
    const nearExpiry = await prisma.user.findMany({
      where: {
        trialEndsAt: {
          not: null,
          gte: new Date(),                     // trial still active
          lte: daysFromNow(7),                 // but expiring within 7 days
        },
        activatedAt: { not: null },            // only users who have logged in
      },
      select: { id: true, trialEndsAt: true },
    })

    for (const u of nearExpiry) {
      const extended = new Date(u.trialEndsAt!.getTime() + 30 * 24 * 60 * 60 * 1000)
      await prisma.user.update({
        where: { id: u.id },
        data:  { trialEndsAt: extended },
      })
      trialsExtended++
    }
  } catch (err) {
    console.error('[demo-refresh] trial extension failed:', err)
  }

  // ── 5. Clean up expired trial users' ClassTeacher assignments ─────────────────
  // Users whose trial ended >14 days ago are removed as class teachers on the
  // demo school — they don't need to appear in the class roster view any more.
  // Their User account is kept intact so they can still log in / request support.
  try {
    const demoSchool = await prisma.school.findFirst({
      where:  { OR: [{ name: 'Omnis Demo School' }, { emailDomain: 'omnisdemo.school' }] },
      select: { id: true },
    })

    if (demoSchool) {
      const expiredUsers = await prisma.user.findMany({
        where: {
          schoolId:    demoSchool.id,
          trialEndsAt: { not: null, lt: daysAgo(14) },  // trial ended >14 days ago
        },
        select: { id: true },
      })

      if (expiredUsers.length > 0) {
        const expiredIds = expiredUsers.map(u => u.id)

        // Remove ClassTeacher records on the demo school's classes only
        const demoClasses = await prisma.schoolClass.findMany({
          where:  { schoolId: demoSchool.id },
          select: { id: true },
        })
        const demoClassIds = demoClasses.map(c => c.id)

        const deleted = await prisma.classTeacher.deleteMany({
          where: {
            userId:  { in: expiredIds },
            classId: { in: demoClassIds },
          },
        })
        classesCleanedUp = deleted.count
      }
    }
  } catch (err) {
    console.error('[demo-refresh] class cleanup failed:', err)
  }

  console.log(`[demo-refresh] lessons=${lessonsUpdated} hwRefreshed=${hwUpdated} hwReopened=${hwReopened} notifs=${notifsRefreshed} trialsExtended=${trialsExtended} classesCleanedUp=${classesCleanedUp}`)

  return NextResponse.json({
    ok: true,
    lessonsUpdated,
    hwUpdated,
    hwReopened,
    notifsRefreshed,
    trialsExtended,
    classesCleanedUp,
  })
}
