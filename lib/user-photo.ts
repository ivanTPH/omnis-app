import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

import { photoProxyUrl } from '@/lib/user-photo-url'
export { photoProxyUrl, parseDataUrl } from '@/lib/user-photo-url'

/**
 * Stores a user's photo once, in UserPhoto, and points User.avatarUrl at the
 * photo route. Writes nothing when the photo is unchanged, and never asks the
 * database to send the row back, so a nightly sync costs almost no egress.
 */
export async function saveUserPhoto(
  userId: string, contentType: string, bytes: Buffer,
  /** The stored photo's hash if already known (null = no photo); looked up when omitted. */
  knownHash?: string | null,
): Promise<'unchanged' | 'saved'> {
  const data = new Uint8Array(bytes) // a plain Uint8Array<ArrayBuffer>, as Prisma's Bytes type expects
  const hash = createHash('sha256').update(bytes).digest('hex')
  const existing = knownHash !== undefined
    ? knownHash
    : (await prisma.userPhoto.findUnique({ where: { userId }, select: { hash: true } }))?.hash ?? null
  if (existing === hash) return 'unchanged'
  await prisma.$transaction([
    prisma.userPhoto.upsert({
      where:  { userId },
      create: { userId, contentType, data, hash },
      update: { contentType, data, hash },
      select: { userId: true },
    }),
    prisma.user.update({ where: { id: userId }, data: { avatarUrl: photoProxyUrl(userId) }, select: { id: true } }),
  ])
  return 'saved'
}
