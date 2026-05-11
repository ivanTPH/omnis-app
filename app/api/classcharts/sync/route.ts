import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * ClassCharts Sync — POST /api/classcharts/sync
 *
 * ClassCharts REST API — used for behaviour, seating, homework and attendance.
 * Required env vars:
 *   CLASSCHARTS_API_KEY     — teacher/school API key from ClassCharts dashboard
 *   CLASSCHARTS_SCHOOL_ID   — numeric school ID from ClassCharts
 *
 * Data pulled and mapped to Omnis models:
 *   Students (pupils)       → User (role: STUDENT) — for identity matching
 *   Behaviour incidents     → SendConcern (category: behaviour, source: 'classcharts')
 *   Positive behaviours     → IlpEvidenceEntry (evidenceType: PROGRESS) or ignored
 *   Homework assignments    → Homework (linked to existing class)
 *   Homework completions    → Submission (status: SUBMITTED)
 *   Attendance data         → SendConcern (category: attendance) when below threshold
 *   Detentions              → SendConcern (category: behaviour) with escalation note
 *
 * Identity matching strategy:
 *   Match ClassCharts pupil by (firstName + lastName + DOB) to existing User records.
 *   No separate WondeStudent-style table needed — concerns link directly to User.id.
 *
 * Status: INTEGRATION READY — client library + sync engine needed.
 * Follow the pattern in lib/wonde-client.ts + lib/wonde-sync.ts.
 *
 * To implement:
 *   1. Create lib/classcharts-client.ts  — typed REST client (Bearer token auth)
 *   2. Create lib/classcharts-sync.ts    — pull incidents, create SendConcern records
 *   3. Add CLASSCHARTS_* vars to Vercel environment settings
 *   4. Add admin UI panel in /admin/classcharts
 *   5. (Optional) Add to Vercel cron: daily pull of new incidents
 */

export const maxDuration = 120

export async function POST() {
  const session = await auth()
  const user = session?.user as { schoolId?: string; role?: string } | undefined
  if (!user || !['SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey   = process.env.CLASSCHARTS_API_KEY
  const schoolId = process.env.CLASSCHARTS_SCHOOL_ID

  if (!apiKey || !schoolId) {
    return NextResponse.json(
      {
        error: 'ClassCharts credentials not configured',
        required: ['CLASSCHARTS_API_KEY', 'CLASSCHARTS_SCHOOL_ID'],
        status: 'not_configured',
      },
      { status: 501 },
    )
  }

  // TODO: replace with runClassChartsSync(user.schoolId!, schoolId, apiKey)
  return NextResponse.json(
    {
      error: 'ClassCharts sync engine not yet implemented',
      note: 'Create lib/classcharts-client.ts and lib/classcharts-sync.ts',
      status: 'not_implemented',
    },
    { status: 501 },
  )
}

/**
 * GET /api/classcharts/sync — returns configuration status for admin UI
 */
export async function GET() {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (!user || !['SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    provider:    'ClassCharts',
    configured:  !!(process.env.CLASSCHARTS_API_KEY && process.env.CLASSCHARTS_SCHOOL_ID),
    implemented: false,
    requiredEnvVars: ['CLASSCHARTS_API_KEY', 'CLASSCHARTS_SCHOOL_ID'],
    dataMapping: {
      behaviourIncidents:  'SendConcern (category: behaviour, source: classcharts)',
      positiveIncidents:   'IlpEvidenceEntry (evidenceType: PROGRESS) — optional',
      homeworkAssignments: 'Homework',
      homeworkCompletions: 'Submission (status: SUBMITTED)',
      attendanceFlags:     'SendConcern (category: attendance)',
      detentions:          'SendConcern (category: behaviour) with escalation note',
    },
    identityMatching: 'firstName + lastName + DOB against existing User records',
    apiDocs: 'https://api.classcharts.com/docs',
  })
}
