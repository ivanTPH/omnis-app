import { prisma, writeAudit } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import { NextRequest }        from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { bufferMatchesMimeType } from '@/lib/uploadValidation'

const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_BYTES     = 5 * 1024 * 1024   // 5 MB

export async function POST(req: NextRequest) {
  const { id: userId, schoolId } = await requireAuth()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return Response.json({ error: 'No file provided.' }, { status: 400 })
  }

  // file.type is whatever Content-Type the client's multipart request
  // declared for this part — trivially spoofable by anyone POSTing directly
  // rather than through the real upload UI. Not itself proof the bytes are
  // really a JPEG/PNG — the magic-byte check below on the actual buffer is
  // what makes that claim mean something. See
  // evidence/phase7-security/manual-hardening-review.md, "File handling".
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Only JPG and PNG images are allowed.' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File must be smaller than 5 MB.' }, { status: 400 })
  }

  const buffer  = Buffer.from(await file.arrayBuffer())

  if (!bufferMatchesMimeType(buffer, file.type)) {
    return Response.json({ error: 'File content does not match its declared type.' }, { status: 400 })
  }

  const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`

  const prev = await prisma.userSettings.findUnique({
    where:  { userId },
    select: { profilePictureUrl: true },
  })

  await prisma.userSettings.upsert({
    where:  { userId },
    create: { userId, profilePictureUrl: dataUrl },
    update: { profilePictureUrl: dataUrl },
  })

  await writeAudit({
    schoolId,
    actorId:    userId,
    action:     'USER_SETTINGS_CHANGED',
    targetType: 'User',
    targetId:   userId,
    metadata:   {
      field: 'profilePictureUrl',
      from:  prev?.profilePictureUrl ? 'had_photo' : null,
      to:    'updated',
    },
  })

  revalidateTag(`avatar-${userId}`, 'default')
  revalidatePath('/', 'layout')
  revalidatePath('/settings')

  return Response.json({ url: dataUrl })
}
