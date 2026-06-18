'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
import { redirect } from 'next/navigation'

const ALLOWED = ['HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export type PastoralNoteRow = {
  id:         string
  content:    string
  category:   string
  visibility: string
  authorName: string
  createdAt:  string
  isOwn:      boolean
}

export async function getPastoralNotes(studentId: string): Promise<PastoralNoteRow[]> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const rows = await prisma.pastoralNote.findMany({
    where: {
      studentId,
      schoolId,
      // SENCO can only see SENCO_VISIBLE notes; SLT/HOY/admin see all
      ...(role === 'SENCO' ? { visibility: 'SENCO_VISIBLE' } : {}),
    },
    select: {
      id: true, content: true, category: true, visibility: true, createdAt: true, authorId: true,
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(r => ({
    id:         r.id,
    content:    r.content,
    category:   r.category,
    visibility: r.visibility,
    authorName: `${r.author.firstName} ${r.author.lastName}`,
    createdAt:  r.createdAt.toISOString(),
    isOwn:      r.authorId === userId,
  }))
}

export async function addPastoralNote(
  studentId: string,
  content:   string,
  category:  string,
  visibility: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!ALLOWED.includes(role)) return { ok: false, error: 'Unauthorised' }
  if (!content.trim()) return { ok: false, error: 'Content required' }

  await prisma.pastoralNote.create({
    data: { schoolId, studentId, authorId: userId, content: content.trim(), category, visibility },
  })

  void writeAudit({
    schoolId, actorId: userId, action: 'PASTORAL_NOTE_ADDED',
    targetType: 'User', targetId: studentId,
    metadata: { category },
  })

  return { ok: true }
}

export async function deletePastoralNote(
  noteId:    string,
  studentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { schoolId, role, id: userId } = await requireAuth()
  if (!ALLOWED.includes(role)) return { ok: false, error: 'Unauthorised' }

  const note = await prisma.pastoralNote.findFirst({
    where: { id: noteId, schoolId, studentId },
  })
  if (!note) return { ok: false, error: 'Not found' }

  // Only the author or SLT/SCHOOL_ADMIN can delete
  if (note.authorId !== userId && !['SLT', 'SCHOOL_ADMIN'].includes(role)) {
    return { ok: false, error: 'Not permitted' }
  }

  await prisma.pastoralNote.delete({ where: { id: noteId } })

  void writeAudit({
    schoolId, actorId: userId, action: 'PASTORAL_NOTE_DELETED',
    targetType: 'User', targetId: studentId,
  })

  return { ok: true }
}
