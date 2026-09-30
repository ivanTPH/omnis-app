import { prisma } from '@/lib/prisma'

/**
 * Links a parent account to every child whose MIS contact record carries the
 * parent's email address AND parental responsibility. Returns how many new
 * links were made. Links are only ever made from school records, never from
 * anything the parent types in, so a parent cannot attach themselves to
 * another family's child.
 */
export async function linkParentToChildren(schoolId: string, parentId: string, email: string): Promise<number> {
  const contacts = await prisma.wondeContact.findMany({
    where: {
      schoolId,
      parentalResponsibility: true,
      email: { equals: email.trim(), mode: 'insensitive' },
    },
    select: { studentId: true, relationship: true },
  })
  if (contacts.length === 0) return 0

  const children = await prisma.user.findMany({
    where:  { schoolId, role: 'STUDENT', wondeId: { in: contacts.map(c => c.studentId) } },
    select: { id: true, wondeId: true },
  })

  let made = 0
  for (const child of children) {
    const rel = contacts.find(c => c.studentId === child.wondeId)?.relationship ?? 'guardian'
    const existing = await prisma.parentChildLink.findUnique({
      where: { parentId_childId: { parentId, childId: child.id } },
      select: { id: true },
    })
    if (existing) continue
    await prisma.parentChildLink.create({
      data: { parentId, childId: child.id, verified: true, relationshipType: rel },
    })
    made++
  }
  return made
}

/** True if the email belongs to a parent with parental responsibility in this school's MIS records. */
export async function isKnownParentEmail(schoolId: string, email: string): Promise<boolean> {
  const n = await prisma.wondeContact.count({
    where: { schoolId, parentalResponsibility: true, email: { equals: email.trim(), mode: 'insensitive' } },
  })
  return n > 0
}
