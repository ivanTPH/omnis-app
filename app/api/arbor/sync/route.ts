import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * Arbor MIS Sync — POST /api/arbor/sync
 *
 * Arbor uses a GraphQL API (Arbor Platform API).
 * Required env vars:
 *   ARBOR_API_KEY      — issued per school from Arbor's MIS dashboard
 *   ARBOR_SCHOOL_URN   — school's URN (Unique Reference Number)
 *   ARBOR_API_URL      — base URL, typically https://<school>.arbor.sc/api/rest/v2
 *
 * Data pulled and mapped to Omnis models:
 *   Students          → User (role: STUDENT) + WondeStudent-equivalent
 *   Staff             → User (role: TEACHER / HEAD_OF_DEPT etc.)
 *   Academic years    → TermDate
 *   Registration groups / sets → SchoolClass + Enrolment
 *   Timetable entries → Lesson (scheduledAt)
 *   Behaviour incidents → SendConcern (category: behaviour)
 *   Attendance marks  → SendConcern (category: attendance) when below threshold
 *   Assessment grades → StudentBaseline
 *
 * Status: INTEGRATION READY — client library + sync engine needed.
 * Follow the pattern in lib/wonde-client.ts + lib/wonde-sync.ts.
 *
 * To implement:
 *   1. Create lib/arbor-client.ts  — typed REST/GraphQL client
 *   2. Create lib/arbor-sync.ts    — upsert engine (same pattern as wonde-sync.ts)
 *   3. Add ARBOR_* vars to Vercel environment settings
 *   4. Add admin UI in /admin/arbor (mirror of /admin/wonde)
 */

export const maxDuration = 300

export async function POST() {
  const session = await auth()
  const user = session?.user as { schoolId?: string; role?: string } | undefined
  if (!user || !['SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey    = process.env.ARBOR_API_KEY
  const schoolUrn = process.env.ARBOR_SCHOOL_URN
  const apiUrl    = process.env.ARBOR_API_URL

  if (!apiKey || !schoolUrn || !apiUrl) {
    return NextResponse.json(
      {
        error: 'Arbor credentials not configured',
        required: ['ARBOR_API_KEY', 'ARBOR_SCHOOL_URN', 'ARBOR_API_URL'],
        status: 'not_configured',
      },
      { status: 501 },
    )
  }

  // TODO: replace with runArborSync(user.schoolId!, schoolUrn, apiKey, apiUrl)
  return NextResponse.json(
    {
      error: 'Arbor sync engine not yet implemented',
      note: 'Create lib/arbor-client.ts and lib/arbor-sync.ts following the Wonde pattern',
      status: 'not_implemented',
    },
    { status: 501 },
  )
}

/**
 * GET /api/arbor/sync — returns configuration status for admin UI
 */
export async function GET() {
  const session = await auth()
  const user = session?.user as { role?: string } | undefined
  if (!user || !['SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    provider:    'Arbor MIS',
    configured:  !!(process.env.ARBOR_API_KEY && process.env.ARBOR_SCHOOL_URN),
    implemented: false,
    requiredEnvVars: ['ARBOR_API_KEY', 'ARBOR_SCHOOL_URN', 'ARBOR_API_URL'],
    dataMapping: {
      students:           'User (STUDENT) + enrolments',
      staff:              'User (TEACHER / HOD / HOY)',
      registrationGroups: 'SchoolClass + Enrolment',
      timetable:          'Lesson (scheduledAt)',
      behaviourIncidents: 'SendConcern (category: behaviour)',
      attendanceFlags:    'SendConcern (category: attendance)',
      assessmentGrades:   'StudentBaseline',
    },
    apiDocs: 'https://developers.arbor.sc/docs',
  })
}
