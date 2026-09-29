import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveWondeTarget, runLoggedWondeSync } from '@/lib/wonde-sync-runner'
import { revalidatePath, revalidateTag } from 'next/cache'

// Allow up to 300 seconds on Vercel Pro / Enterprise
export const maxDuration = 300

export async function POST() {
  const session = await auth()
  const user = session?.user as { schoolId?: string; role?: string; id?: string } | undefined
  if (!user?.schoolId || !user?.role || !['SCHOOL_ADMIN', 'SLT'].includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only the school linked to the configured Wonde school may sync it —
  // see lib/wonde-sync-runner.ts for why.
  const target = await resolveWondeTarget(user.schoolId)
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: 403 })
  }

  const run = await runLoggedWondeSync(target, 'full')

  if (run.error) {
    return NextResponse.json({ error: run.error, logId: run.logId }, { status: 500 })
  }

  revalidatePath('/admin/wonde')
  revalidateTag('class-rosters', 'default')  // Wonde sync can change enrolments — bust all roster caches
  // `success` reflects per-phase errors too (log status 'partial'), not just
  // whether the run threw.
  return NextResponse.json({ success: run.success, result: run.result, logId: run.logId })
}
