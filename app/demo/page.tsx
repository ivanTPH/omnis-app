import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DemoRolePicker from './DemoRolePicker'

export const metadata = { title: 'Demo — Omnis' }

export default async function DemoPage() {
  const user = await requireAuth('PLATFORM_ADMIN')
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } })
  if (dbUser?.email !== 'ivanyardley@me.com') redirect('/platform-admin/dashboard')
  return <DemoRolePicker firstName={user.firstName} />
}
