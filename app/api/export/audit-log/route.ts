import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }    from '@/lib/session'
import { prisma }         from '@/lib/prisma'
import { AUDIT_CATEGORIES } from '@/lib/audit-categories'
import type { Prisma }    from '@prisma/client'

function escapeCsv(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: NextRequest) {
  const { schoolId, role } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp       = req.nextUrl.searchParams
  const category = sp.get('category') ?? undefined
  const daysStr  = sp.get('days')
  const days     = daysStr ? Math.max(1, parseInt(daysStr, 10) || 0) || undefined : undefined

  const where: Prisma.AuditLogWhereInput = { schoolId }

  if (category && AUDIT_CATEGORIES[category]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where.action = { in: AUDIT_CATEGORIES[category] as any }
  }

  if (days) {
    where.createdAt = { gte: new Date(Date.now() - days * 86_400_000) }
  }

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { firstName: true, lastName: true, role: true } } },
  })

  const header = ['Timestamp', 'Action', 'Actor', 'Actor Role', 'Target Type', 'Target ID', 'Detail'].join(',')

  const rows = entries.map(e => {
    const actorName = e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : e.actorId
    const actorRole = e.actor?.role ?? ''
    const detail = e.metadata
      ? Object.entries(e.metadata as Record<string, unknown>).map(([k, v]) => `${k}=${v}`).join('; ')
      : ''
    return [
      new Date(e.createdAt).toISOString(),
      e.action,
      actorName,
      actorRole,
      e.targetType,
      e.targetId,
      detail,
    ].map(escapeCsv).join(',')
  })

  const csv = [header, ...rows].join('\n')
  const suffix = category ? `-${category}` : ''
  const filename = `audit-log${suffix}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
