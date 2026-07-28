/**
 * GET /api/cron/trial-onboarding
 *
 * Daily cron (09:30 UTC) — sends the trial onboarding email sequence to beta users.
 *
 * Sequence (timed from activatedAt — first login):
 *   Day 1 (23h+):  Getting started guide       → trialNudgeSent: 0 → 1
 *   Day 3 (71h+):  Feature spotlight            → trialNudgeSent: 1 → 3
 *   Day 7 (167h+): Week-one check-in            → trialNudgeSent: 3 → 7
 *
 * Guards:
 *  - User must have trialEndsAt set (beta trial account)
 *  - User must have activatedAt set (has logged in at least once)
 *  - trialEndsAt must be in the future (don't email expired trials)
 *  - Each stage only sent once (trialNudgeSent tracks progress)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import {
  sendTrialDay1Email,
  sendTrialDay3Email,
  sendTrialDay7Email,
} from '@/lib/email'

export const maxDuration = 60

const SITE_URL = process.env.NEXTAUTH_URL ?? 'https://omnis.education'

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000)
}

function daysLeft(trialEndsAt: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  let day1Sent = 0, day3Sent = 0, day7Sent = 0, errors = 0

  const baseWhere = {
    trialEndsAt:  { not: null, gt: new Date() },  // active trial
    activatedAt:  { not: null },                   // has logged in
  }

  // ── Day 1: send to users who activated 23h+ ago and haven't received any nudge ──
  const day1Users = await prisma.user.findMany({
    where: { ...baseWhere, activatedAt: { lte: hoursAgo(23) }, trialNudgeSent: 0 },
    select: { id: true, email: true, firstName: true, trialEndsAt: true },
  })

  for (const user of day1Users) {
    try {
      await sendTrialDay1Email({
        to:           user.email,
        firstName:    user.firstName,
        daysLeft:     daysLeft(user.trialEndsAt!),
        dashboardUrl: SITE_URL,
      })
      await prisma.user.update({ where: { id: user.id }, data: { trialNudgeSent: 1 } })
      day1Sent++
    } catch (err) {
      console.error(`[trial-onboarding] day1 failed for ${user.email}:`, err)
      errors++
    }
  }

  // ── Day 3: activated 71h+ ago, day1 already sent ─────────────────────────────
  const day3Users = await prisma.user.findMany({
    where: { ...baseWhere, activatedAt: { lte: hoursAgo(71) }, trialNudgeSent: 1 },
    select: { id: true, email: true, firstName: true, trialEndsAt: true },
  })

  for (const user of day3Users) {
    try {
      await sendTrialDay3Email({
        to:           user.email,
        firstName:    user.firstName,
        daysLeft:     daysLeft(user.trialEndsAt!),
        dashboardUrl: SITE_URL,
      })
      await prisma.user.update({ where: { id: user.id }, data: { trialNudgeSent: 3 } })
      day3Sent++
    } catch (err) {
      console.error(`[trial-onboarding] day3 failed for ${user.email}:`, err)
      errors++
    }
  }

  // ── Day 7: activated 167h+ ago, day3 already sent ────────────────────────────
  const day7Users = await prisma.user.findMany({
    where: { ...baseWhere, activatedAt: { lte: hoursAgo(167) }, trialNudgeSent: 3 },
    select: { id: true, email: true, firstName: true, trialEndsAt: true },
  })

  for (const user of day7Users) {
    try {
      await sendTrialDay7Email({
        to:           user.email,
        firstName:    user.firstName,
        daysLeft:     daysLeft(user.trialEndsAt!),
        dashboardUrl: SITE_URL,
      })
      await prisma.user.update({ where: { id: user.id }, data: { trialNudgeSent: 7 } })
      day7Sent++
    } catch (err) {
      console.error(`[trial-onboarding] day7 failed for ${user.email}:`, err)
      errors++
    }
  }

  return NextResponse.json({
    ok: true,
    day1Sent,
    day3Sent,
    day7Sent,
    errors,
    durationMs: Date.now() - started,
  })
}
