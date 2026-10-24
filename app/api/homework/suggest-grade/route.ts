/**
 * POST /api/homework/suggest-grade  { submissionId }
 *
 * AI grade suggestion for the marking screen. This used to be called as a
 * server action, but Next.js runs a client's server actions one at a time:
 * the marking screen pre-fetches suggestions for up to 6 pupils on open, so
 * "Save Grade" (also a server action) queued behind several AI calls and could
 * take 15-30 seconds. A route handler runs concurrently, so saving never waits.
 *
 * Auth, role (teaching staff only) and school scoping are enforced inside
 * suggestHomeworkGrade itself.
 */
import { NextRequest, NextResponse } from 'next/server'
import { suggestHomeworkGrade } from '@/app/actions/homework'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let submissionId: unknown
  try {
    ({ submissionId } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof submissionId !== 'string' || !submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }
  const suggestion = await suggestHomeworkGrade(submissionId)
  return NextResponse.json(suggestion)
}
