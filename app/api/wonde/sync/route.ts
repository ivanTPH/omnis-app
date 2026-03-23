import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runWondeSync } from '@/lib/wonde-sync'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Allow up to 300 seconds on Vercel Pro / Enterprise
export const maxDuration = 300

export async function POST() {
  const session = await auth()
  const user = session?.user as { schoolId?: string; role?: string } | undefined
  if (!user || !['SCHOOL_ADMIN', 'SLT'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token      = process.env.WONDE_API_TOKEN
  const wondeSchId = process.env.WONDE_SCHOOL_ID
  const schoolId   = user.schoolId

  if (!token || !wondeSchId || !schoolId) {
    return NextResponse.json({ error: 'Wonde credentials not configured' }, { status: 500 })
  }

  // Mark any stale "running" logs as failed before starting a new run
  await prisma.wondeSyncLog.updateMany({
    where:  { schoolId, status: 'running' },
    data:   { status: 'failed', errors: ['Superseded by a new sync run'], completedAt: new Date() },
  })

  // Create sync log entry
  const log = await prisma.wondeSyncLog.create({
    data: { schoolId, syncType: 'full', status: 'running', startedAt: new Date() },
  })

  try {
    const result = await runWondeSync(schoolId, wondeSchId, token)

    const totalRecords =
      result.employees.upserted +
      result.students.upserted +
      result.contacts.upserted +
      result.groups.upserted +
      result.classes.upserted +
      result.enrolments.upserted +
      result.periods.upserted +
      result.timetable.upserted

    await prisma.wondeSyncLog.update({
      where: { id: log.id },
      data: {
        status:           result.errors.length > 0 ? 'partial' : 'success',
        recordsProcessed: totalRecords,
        errors:           result.errors,
        completedAt:      new Date(),
      },
    })

    revalidatePath('/admin/wonde')
    return NextResponse.json({ success: true, result, logId: log.id })
  } catch (err) {
    await prisma.wondeSyncLog.update({
      where: { id: log.id },
      data: { status: 'failed', errors: [String(err)], completedAt: new Date() },
    })
    return NextResponse.json({ error: String(err), logId: log.id }, { status: 500 })
  }
}
