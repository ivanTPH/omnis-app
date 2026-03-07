'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function sendParentMessage(conversationId: string, content: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { id: userId, role } = session.user as any
  if (role !== 'PARENT') throw new Error('Forbidden')

  const conv = await prisma.parentConversation.findFirst({
    where: { id: conversationId, parentId: userId },
  })
  if (!conv) throw new Error('Conversation not found')

  await prisma.$transaction([
    prisma.parentMessage.create({
      data: { conversationId, senderType: 'PARENT', content: content.trim() },
    }),
    prisma.parentConversation.update({
      where: { id: conversationId },
      data:  { updatedAt: new Date() },
    }),
  ])

  revalidatePath('/parent/messages')
}
