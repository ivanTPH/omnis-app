import { PrismaClient } from '@prisma/client'
const g = globalThis as any
export const prisma: PrismaClient = g.prisma ?? new PrismaClient({ log: ['error'] })
if (process.env.NODE_ENV !== 'production') g.prisma = prisma
export async function writeAudit(data: { schoolId: string; actorId: string; action: string; targetType: string; targetId: string; metadata?: object }) {
  await prisma.auditLog.create({ data: { ...data, action: data.action as any, metadata: data.metadata ?? {} } })
}
