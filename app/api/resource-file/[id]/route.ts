import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const schoolId = session.user.schoolId as string

  const resource = await prisma.resource.findFirst({
    where: { id, schoolId },
    select: { url: true, label: true, type: true },
  })

  if (!resource?.url?.startsWith('data:')) {
    return new Response('Not found', { status: 404 })
  }

  const commaIdx = resource.url.indexOf(',')
  if (commaIdx === -1) return new Response('Invalid file data', { status: 400 })

  const header   = resource.url.slice(0, commaIdx)   // e.g. "data:application/pdf;base64"
  const b64data  = resource.url.slice(commaIdx + 1)
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'

  const buffer = Buffer.from(b64data, 'base64')

  // Safe filename for Content-Disposition
  const safeName = encodeURIComponent(resource.label ?? 'file')

  return new Response(buffer, {
    headers: {
      'Content-Type':        mimeType,
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control':       'private, max-age=3600',
      'Content-Length':      String(buffer.byteLength),
    },
  })
}
