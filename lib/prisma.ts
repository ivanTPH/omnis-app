import { PrismaClient, AuditAction } from '@prisma/client'

// ─── Singleton factory ─────────────────────────────────────────────────────────
// $extends returns a distinct type so we derive it from the factory rather than
// annotating with PrismaClient directly.

function createPrismaClient() {
  return new PrismaClient({ log: ['error'] }).$extends({
    query: {
      auditLog: {
        // Immutability guard — AuditLog rows must never be mutated or deleted.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ operation, args, query }: any) {
          const blocked = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert'])
          if (blocked.has(operation)) {
            throw new Error(`AuditLog is immutable — attempted operation: ${operation}`)
          }
          return query(args)
        },
      },
    },
  })
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

/** Use this instead of `PrismaClient` when typing function parameters that receive `prisma`. */
export type OmnisPrismaClient = ExtendedPrismaClient

// ─── Audit helpers ─────────────────────────────────────────────────────────────

export async function writeAudit(data: {
  schoolId: string
  actorId: string
  action: AuditAction
  targetType: string
  targetId: string
  metadata?: object
}) {
  await prisma.auditLog.create({ data: { ...data, metadata: data.metadata ?? {} } })
}

export async function writeAPDRAudit(data: {
  apdrId: string
  userId: string
  userName: string
  userRole: string
  fieldChanged: string
  previousValue: string
  newValue: string
  changeType: 'ADDED' | 'EDITED' | 'DELETED'
}) {
  await prisma.apdrAuditEntry.create({ data })
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
