/**
 * GET /api/cron/early-warning
 *
 * Runs the early warning analysis engine for all active schools.
 * Triggered by Vercel Cron at 6am Mon–Fri (schedule: "0 6 * * 1-5").
 *
 * SECURITY:
 * - When CRON_SECRET is set: request must include Authorization: Bearer <secret>
 * - When CRON_SECRET is unset (dev only): unauthenticated requests are allowed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyseStudentPatterns, checkIlpTargetReviewsDue, checkEhcpReviewsDue } from '@/lib/send/early-warning'
import { computeAndSaveAdaptiveProfile } from '@/lib/adaptive-profile'
import { computeSchoolCohortAggregate } from '@/lib/cohort-aggregate'
import { runEvidenceAgentBatch } from '@/lib/agents/evidence-agent'
import { purgeExpiredInferenceCache } from '@/lib/omnis-inference'
import { prisma } from '@/lib/prisma'
import { reportBatchItemFailure, reportSystemicFailure, reportFatalError } from '@/lib/monitoring'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startTime = Date.now()

  try {
    // Get all active schools
    const schools = await prisma.school.findMany({
      select: { id: true, name: true },
    })

    let totalFlags = 0
    let totalIlpReviewNotifications = 0
    let totalEhcpReviewNotifications = 0
    let patternErrors = 0, ilpErrors = 0, ehcpErrors = 0
    const results: { schoolId: string; name: string; newFlags: number }[] = []

    for (const school of schools) {
      try {
        const newFlags = await analyseStudentPatterns(school.id)
        totalFlags += newFlags
        results.push({ schoolId: school.id, name: school.name, newFlags })
      } catch (err) {
        patternErrors++
        reportBatchItemFailure('early-warning:patterns', school.id, err, { schoolName: school.name })
        results.push({ schoolId: school.id, name: school.name, newFlags: -1 })
      }

      // Check for ILP targets due within 7 days and notify SENCOs
      try {
        const n = await checkIlpTargetReviewsDue(school.id)
        totalIlpReviewNotifications += n
      } catch (err) {
        ilpErrors++
        reportBatchItemFailure('early-warning:ilp-review', school.id, err, { schoolName: school.name })
      }

      // Check for EHCP plans with review date within 30 days and notify SENCOs
      try {
        const n = await checkEhcpReviewsDue(school.id)
        totalEhcpReviewNotifications += n
      } catch (err) {
        ehcpErrors++
        reportBatchItemFailure('early-warning:ehcp-review', school.id, err, { schoolName: school.name })
      }
    }

    // Refresh adaptive learning profiles for all students across all schools.
    // Runs after flag analysis so profile data is fresh for SENCO dashboards.
    // Processes in batches of 5 with a 500ms pause to avoid DB connection spikes.
    let totalProfiles = 0
    let profileErrors = 0
    for (const school of schools) {
      try {
        const students = await prisma.user.findMany({
          where:  { schoolId: school.id, role: 'STUDENT', isActive: true },
          select: { id: true },
        })
        const BATCH = 5
        for (let i = 0; i < students.length; i += BATCH) {
          const batch = students.slice(i, i + BATCH)
          await Promise.allSettled(
            batch.map(s => computeAndSaveAdaptiveProfile(s.id, school.id))
          )
          totalProfiles += batch.length
          if (i + BATCH < students.length) {
            await new Promise(r => setTimeout(r, 500))
          }
        }
      } catch (err) {
        profileErrors++
        reportBatchItemFailure('early-warning:profile-refresh', school.id, err, { schoolName: school.name })
      }
    }

    // Roll up per-student profiles into school cohort aggregates.
    // Runs after all individual profiles are fresh so aggregates reflect today's data.
    let totalCohortRows = 0
    let cohortErrors = 0
    for (const school of schools) {
      try {
        const rows = await computeSchoolCohortAggregate(school.id)
        totalCohortRows += rows
      } catch (err) {
        cohortErrors++
        reportBatchItemFailure('early-warning:cohort-aggregate', school.id, err, { schoolName: school.name })
      }
    }

    // Run Evidence Agent batch for each school — retroactively link homework evidence to SEND plans
    let totalEvidenceStudents = 0
    let evidenceErrors = 0
    for (const school of schools) {
      try {
        const n = await runEvidenceAgentBatch(school.id)
        totalEvidenceStudents += n
      } catch (err) {
        evidenceErrors++
        reportBatchItemFailure('early-warning:evidence-agent', school.id, err, { schoolName: school.name })
      }
    }

    // Purge expired Omnis Inference Cache entries
    let purgedInferenceEntries = 0
    try {
      purgedInferenceEntries = await purgeExpiredInferenceCache()
    } catch (err) {
      console.error('[early-warning cron] Inference cache purge error:', err)
    }

    const durationMs = Date.now() - startTime
    console.log(`[early-warning cron] Complete — ${totalFlags} new flags, ${totalIlpReviewNotifications} ILP review notifications, ${totalEhcpReviewNotifications} EHCP review notifications, ${totalProfiles} profiles refreshed, ${totalCohortRows} cohort aggregate rows upserted, ${totalEvidenceStudents} evidence students processed, ${purgedInferenceEntries} inference cache entries purged across ${schools.length} schools in ${durationMs}ms`)

    // This route runs 5 largely-independent phases (pattern analysis, ILP/EHCP
    // review checks, adaptive profiles, cohort aggregates, evidence linking).
    // Rather than one grandProcessed/grandErrors pair, each phase is checked
    // for total failure separately -- a phase failing for every school (not
    // just one bad school) is the "silently stopped working" case worth
    // surfacing loudly; a school here and there erroring is normal batch noise.
    const phaseFailures: string[] = []
    if (schools.length > 0) {
      if (patternErrors  === schools.length) phaseFailures.push('pattern-analysis')
      if (ilpErrors      === schools.length) phaseFailures.push('ilp-review-check')
      if (ehcpErrors     === schools.length) phaseFailures.push('ehcp-review-check')
      if (profileErrors  === schools.length) phaseFailures.push('profile-refresh')
      if (cohortErrors   === schools.length) phaseFailures.push('cohort-aggregate')
      if (evidenceErrors === schools.length) phaseFailures.push('evidence-agent')
    }
    if (phaseFailures.length > 0) {
      reportSystemicFailure('early-warning', `phase(s) failed for all ${schools.length} schools: ${phaseFailures.join(', ')}`, { phaseFailures, schoolCount: schools.length })
    }

    return NextResponse.json({
      success: phaseFailures.length === 0,
      totalFlags, totalIlpReviewNotifications, totalEhcpReviewNotifications,
      totalProfiles, totalCohortRows, totalEvidenceStudents, purgedInferenceEntries,
      phaseFailures,
      schools: results, durationMs,
    }, { status: phaseFailures.length > 0 ? 502 : 200 })
  } catch (err) {
    const durationMs = Date.now() - startTime
    reportFatalError('early-warning', err, { durationMs })
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
