/**
 * Loads the list of person names that must never be sent to the AI provider.
 *
 * Covers everyone Omnis knows about: platform users (pupils, parents/carers,
 * staff) and MIS-synced records that may not have an account yet (Wonde
 * pupils, contacts and employees). Cached in memory for 10 minutes so AI
 * calls do not each hit the database.
 */
import { prisma } from '@/lib/prisma'
import type { NameDirectory } from './pseudonymise'
import { buildDirectory } from './name-directory-core'

const TTL_MS = 10 * 60 * 1000
let cache: { at: number; dir: NameDirectory } | null = null
let inflight: Promise<NameDirectory> | null = null

async function load(): Promise<NameDirectory> {
  const sel = { firstName: true, lastName: true } as const
  const [users, wStudents, wContacts, wEmployees] = await Promise.all([
    prisma.user.findMany({ select: sel }),
    prisma.wondeStudent.findMany({ select: sel }),
    prisma.wondeContact.findMany({ select: sel }),
    prisma.wondeEmployee.findMany({ select: sel }),
  ])
  return buildDirectory([...users, ...wStudents, ...wContacts, ...wEmployees])
}

export async function getNameDirectory(): Promise<NameDirectory> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.dir
  if (!inflight) {
    inflight = load()
      .then((dir) => {
        cache = { at: Date.now(), dir }
        return dir
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}
