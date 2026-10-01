'use server'

import { revalidatePath } from 'next/cache'
import type { Role } from '@prisma/client'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { ASSIGNABLE_STAFF_ROLES } from '@/lib/mis-review-roles'
import { parseClassImport } from '@/lib/accounts/class-filter'
import { placeholderEmail } from '@/lib/accounts/placeholder'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const ADMIN = ['SCHOOL_ADMIN', 'SLT']

async function requireAdmin() {
  const u = await requireAuth()
  if (!ADMIN.includes(u.role)) throw new Error('Only the school admin or senior leaders can do this.')
  return u
}

export async function assignClassTeacher(classId: string, userId: string): Promise<void> {
  const u = await requireAdmin()
  const [cls, teacher] = await Promise.all([
    prisma.schoolClass.findFirst({ where: { id: classId, schoolId: u.schoolId }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: userId, schoolId: u.schoolId, role: { notIn: ['STUDENT', 'PARENT'] } }, select: { id: true } }),
  ])
  if (!cls || !teacher) throw new Error('Class or member of staff not found.')
  await prisma.classTeacher.createMany({ data: [{ classId, userId }], skipDuplicates: true })
  await writeAudit({ schoolId: u.schoolId, actorId: u.id, action: 'USER_CLASS_ASSIGNED', targetType: 'class', targetId: classId, metadata: { teacherId: userId, source: 'mis-review' } })
  revalidatePath('/admin/mis-review')
  revalidatePath('/admin/go-live')
}

export async function setStaffRole(userId: string, role: string): Promise<void> {
  const u = await requireAdmin()
  if (!(ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(role)) throw new Error('That role cannot be set here.')
  if (userId === u.id) throw new Error('You cannot change your own role here.')
  const target = await prisma.user.findFirst({
    where: { id: userId, schoolId: u.schoolId, role: { notIn: ['STUDENT', 'PARENT', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'ACADEMY_ADMIN'] } },
    select: { id: true, role: true },
  })
  if (!target) throw new Error('Member of staff not found.')
  if (u.role === 'SLT' && (role === 'SCHOOL_ADMIN' || target.role === 'SCHOOL_ADMIN')) {
    throw new Error('Only the school admin can change admin roles.')
  }
  await prisma.user.update({ where: { id: userId }, data: { role: role as Role } })
  await writeAudit({ schoolId: u.schoolId, actorId: u.id, action: 'USER_ROLE_CHANGED', targetType: 'user', targetId: userId, metadata: { from: target.role, to: role } })
  revalidatePath('/admin/mis-review')
  revalidatePath('/admin/go-live')
}

/** Save which MIS classes to bring in. Applied at the next sync. */
export async function saveClassImport(formGroups: boolean, excludedSubjects: string[]): Promise<void> {
  const u = await requireAdmin()
  const settings = parseClassImport({ formGroups, excludedSubjects })
  await prisma.school.update({ where: { id: u.schoolId }, data: { misClassImport: settings } })
  await writeAudit({ schoolId: u.schoolId, actorId: u.id, action: 'SCHOOL_SETTINGS_UPDATED', targetType: 'school', targetId: u.schoolId, metadata: { misClassImport: settings } })
  revalidatePath('/admin/mis-review')
}

async function loadPupilForReview(schoolId: string, wondeId: string) {
  const [pupil, alreadyLinked] = await Promise.all([
    prisma.wondeStudent.findFirst({ where: { id: wondeId, schoolId, isLeaver: false }, select: { id: true, firstName: true, lastName: true, yearGroup: true } }),
    prisma.user.findFirst({ where: { wondeId }, select: { id: true } }),
  ])
  if (!pupil) throw new Error('Pupil not found in the MIS data.')
  if (alreadyLinked) throw new Error('This pupil is already linked to an account.')
  return pupil
}

/** Link an MIS pupil to an existing (unlinked) pupil account in the same school. */
export async function linkPupilToAccount(wondeId: string, userId: string): Promise<void> {
  const u = await requireAdmin()
  await loadPupilForReview(u.schoolId, wondeId)
  const account = await prisma.user.findFirst({ where: { id: userId, schoolId: u.schoolId, role: 'STUDENT', wondeId: null }, select: { id: true } })
  if (!account) throw new Error('That account cannot be linked (not found, or already linked to another MIS pupil).')
  await prisma.user.update({ where: { id: userId }, data: { wondeId } })
  await writeAudit({ schoolId: u.schoolId, actorId: u.id, action: 'USER_SETTINGS_CHANGED', targetType: 'user', targetId: userId, metadata: { change: 'linked-to-mis-pupil', wondeId, source: 'mis-review' } })
  revalidatePath('/admin/mis-review')
}

/** Create a new pupil account for an MIS pupil (no email is sent). */
export async function createPupilAccount(wondeId: string): Promise<void> {
  const u = await requireAdmin()
  const pupil = await loadPupilForReview(u.schoolId, wondeId)
  // Placeholder address; the next sync swaps in the pupil's school email if the MIS has one.
  const email = placeholderEmail(wondeId)
  const created = await prisma.user.create({
    data: {
      email, role: 'STUDENT', schoolId: u.schoolId, wondeId,
      firstName: pupil.firstName, lastName: pupil.lastName, yearGroup: pupil.yearGroup,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
    },
    select: { id: true },
  })
  await writeAudit({ schoolId: u.schoolId, actorId: u.id, action: 'USER_PROVISIONED', targetType: 'user', targetId: created.id, metadata: { role: 'STUDENT', source: 'mis-review', wondeId } })
  revalidatePath('/admin/mis-review')
}
