'use server'

import { revalidatePath } from 'next/cache'
import type { Role } from '@prisma/client'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { ASSIGNABLE_STAFF_ROLES } from '@/lib/mis-review-roles'

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
