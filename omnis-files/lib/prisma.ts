import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Immutability guard — AuditLog can never be updated or deleted
prisma.$use(async (params, next) => {
  if (params.model === 'AuditLog') {
    const blocked = ['update', 'updateMany', 'delete', 'deleteMany', 'upsert']
    if (blocked.includes(params.action)) {
      throw new Error('AuditLog is immutable')
    }
  }
  return next(params)
})

export async function writeAudit({
  schoolId,
  actorId,
  action,
  targetType,
  targetId,
  metadata,
}: {
  schoolId: string
  actorId: string
  action: string
  targetType: string
  targetId: string
  metadata?: object
}) {
  await prisma.auditLog.create({
    data: {
      schoolId,
      actorId,
      action: action as any,
      targetType,
      targetId,
      metadata: metadata ?? {},
    },
  })
}
