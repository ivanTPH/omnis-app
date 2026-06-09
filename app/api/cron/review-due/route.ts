/**
 * GET /api/cron/review-due
 *
 * Runs Mon–Fri at 07:00 UTC.
 * Sends email reminders to SENCOs for:
 *  - ILP reviews due within the next 7 days
 *  - EHCP annual reviews due within the next 30 days
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendIlpReviewDueEmail, sendEhcpReviewDueEmail } from '@/lib/email'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now        = new Date()
  const in7days    = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000)
  const in30days   = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const baseUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  let ilpsSent  = 0
  let ehcpsSent = 0
  const errors: string[] = []

  // ── ILP reviews due in next 7 days ─────────────────────────────────────────
  try {
    const ilpsDue = await prisma.iLP.findMany({
      where: {
        status:      'ACTIVE',
        reviewDueAt: { gte: now, lte: in7days },
      },
      include: {
        school: {
          include: {
            users: {
              where:  { role: 'SENCO', isActive: true },
              select: { id: true, email: true, firstName: true },
              take:   1,
            },
          },
        },
      },
    })

    for (const ilp of ilpsDue) {
      const senco = ilp.school.users[0]
      if (!senco?.email || !ilp.reviewDueAt) continue
      try {
        const student = await prisma.user.findUnique({
          where:  { id: ilp.studentId },
          select: { firstName: true, lastName: true },
        })
        await sendIlpReviewDueEmail({
          to:            senco.email,
          sencoFirstName:senco.firstName,
          studentName:   student ? `${student.firstName} ${student.lastName}` : 'Unknown student',
          reviewDueAt:   ilp.reviewDueAt,
          ilpUrl:        `${baseUrl}/senco/ilp/${ilp.studentId}`,
        })
        ilpsSent++
      } catch (err) {
        errors.push(`ILP ${ilp.id}: ${String(err)}`)
      }
    }
  } catch (err) {
    errors.push(`ILP query: ${String(err)}`)
  }

  // ── EHCP reviews due in next 30 days ────────────────────────────────────────
  try {
    const ehcpsDue = await prisma.ehcpPlan.findMany({
      where: {
        reviewDate: { gte: now, lte: in30days },
      },
      include: {
        school: {
          include: {
            users: {
              where:  { role: 'SENCO', isActive: true },
              select: { id: true, email: true, firstName: true },
              take:   1,
            },
          },
        },
        student: { select: { firstName: true, lastName: true } },
      },
    })

    for (const ehcp of ehcpsDue) {
      const senco = ehcp.school.users[0]
      if (!senco?.email) continue
      try {
        await sendEhcpReviewDueEmail({
          to:            senco.email,
          sencoFirstName:senco.firstName,
          studentName:   `${ehcp.student?.firstName ?? ''} ${ehcp.student?.lastName ?? ''}`.trim() || 'Unknown student',
          reviewDueAt:   ehcp.reviewDate,
          ehcpUrl:       `${baseUrl}/senco/ehcp`,
        })
        ehcpsSent++
      } catch (err) {
        errors.push(`EHCP ${ehcp.id}: ${String(err)}`)
      }
    }
  } catch (err) {
    errors.push(`EHCP query: ${String(err)}`)
  }

  return NextResponse.json({ ok: true, ilpsSent, ehcpsSent, errors })
}
