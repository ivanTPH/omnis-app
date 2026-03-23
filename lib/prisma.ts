import { PrismaClient } from '@prisma/client'
const g = globalThis as any
export const prisma: PrismaClient = g.prisma ?? new PrismaClient({ log: ['error'] })
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
export async function writeAudit(data: { schoolId: string; actorId: string; action: string; targetType: string; targetId: string; metadata?: object }) {
  await prisma.auditLog.create({ data: { ...data, action: data.action as any, metadata: data.metadata ?? {} } })
}

export async function writeEHCPAudit(data: {
  ehcpId: string
  userId: string
  userName: string
  userRole: string
  fieldChanged: string
  previousValue: string
  newValue: string
  changeType: 'ADDED' | 'EDITED' | 'DELETED'
}) {
  await prisma.ehcpAuditEntry.create({ data })
}

export async function writeILPAudit(data: {
  ilpId: string
  userId: string
  userName: string
  userRole: string
  fieldChanged: string
  previousValue: string
  newValue: string
  changeType: 'ADDED' | 'EDITED' | 'DELETED'
}) {
  await prisma.ilpAuditEntry.create({ data })
}
