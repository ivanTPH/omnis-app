'use server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export interface SignupRow {
  id: string
  name: string
  email: string
  schoolName: string
  jobTitle: string
  schoolSize: string
  appliedAt: string
  reviewed: boolean
  // joined from User
  hasAccount: boolean
  role: string | null
  activated: boolean
  dpaAccepted: boolean
  trialEndsAt: string | null
  trialExpired: boolean
}

export interface SignupStats {
  total: number
  withAccount: number
  activated: number
  dpaAccepted: number
  trialActive: number
}

export async function getSignupDashboard(): Promise<{ rows: SignupRow[]; stats: SignupStats }> {
  await requireAuth('PLATFORM_ADMIN')

  // Deduplicate by email — keep latest application per email
  const apps = await prisma.betaApplication.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Get all users whose email matches any application
  const emails = [...new Set(apps.map(a => a.email))]
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, role: true, activatedAt: true, dpaAcceptedAt: true, trialEndsAt: true },
  })
  const userMap = new Map(users.map(u => [u.email, u]))

  // Deduplicate: one row per email (latest application)
  const seen = new Set<string>()
  const rows: SignupRow[] = []
  const now = new Date()

  for (const app of apps) {
    if (seen.has(app.email)) continue
    seen.add(app.email)

    const u = userMap.get(app.email) ?? null
    const trialEndsAt = u?.trialEndsAt ? u.trialEndsAt.toISOString() : null

    rows.push({
      id:          app.id,
      name:        app.name,
      email:       app.email,
      schoolName:  app.schoolName,
      jobTitle:    app.jobTitle,
      schoolSize:  app.schoolSize,
      appliedAt:   app.createdAt.toISOString(),
      reviewed:    app.reviewed,
      hasAccount:  !!u,
      role:        u?.role ?? null,
      activated:   !!u?.activatedAt,
      dpaAccepted: !!u?.dpaAcceptedAt,
      trialEndsAt,
      trialExpired: trialEndsAt ? new Date(trialEndsAt) < now : false,
    })
  }

  const stats: SignupStats = {
    total:       rows.length,
    withAccount: rows.filter(r => r.hasAccount).length,
    activated:   rows.filter(r => r.activated).length,
    dpaAccepted: rows.filter(r => r.dpaAccepted).length,
    trialActive: rows.filter(r => r.hasAccount && !r.trialExpired).length,
  }

  return { rows, stats }
}

export async function markSignupReviewed(id: string): Promise<void> {
  await requireAuth('PLATFORM_ADMIN')
  await prisma.betaApplication.update({ where: { id }, data: { reviewed: true } })
}
