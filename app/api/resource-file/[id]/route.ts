import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SAFE_INLINE_MIME_TYPES } from '@/lib/uploadValidation'

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
    select: { url: true, label: true, type: true, isAiGenerated: true },
  })

  if (!resource?.url?.startsWith('data:')) {
    return new Response('Not found', { status: 404 })
  }

  const commaIdx = resource.url.indexOf(',')
  if (commaIdx === -1) return new Response('Invalid file data', { status: 400 })

  const header   = resource.url.slice(0, commaIdx)   // e.g. "data:application/pdf;base64"
  const b64data  = resource.url.slice(commaIdx + 1)
  const declaredMimeType = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'

  const buffer = Buffer.from(b64data, 'base64')

  // Safe filename for Content-Disposition
  const safeName = encodeURIComponent(resource.label ?? 'file')

  // AI-generated lesson slides/resources are intentionally text/html — the
  // app builds that HTML itself (buildAiSlidesHtml / buildAiResourceHtml,
  // both escape every interpolated value) and it's meant to render inline.
  // Anything else — including text/html on a NON-ai-generated resource —
  // only gets served inline if its declared type is in the allowlist of
  // types that can't carry executable content; otherwise it's forced to
  // download as an opaque octet-stream rather than rendered by the browser.
  // The declared type on a resource's stored dataUrl is user-supplied
  // metadata (see addUploadedResource / lib/uploadValidation.ts) — trusting
  // it blindly for Content-Type + Content-Disposition: inline is exactly
  // the stored-XSS gap fixed here. See
  // evidence/phase7-security/manual-hardening-review.md, "File handling".
  const isTrustedAiHtml = resource.isAiGenerated && declaredMimeType === 'text/html'
  const safeToRenderInline = isTrustedAiHtml || SAFE_INLINE_MIME_TYPES.has(declaredMimeType)

  const contentType = safeToRenderInline ? declaredMimeType : 'application/octet-stream'
  const disposition = safeToRenderInline ? 'inline' : 'attachment'

  return new Response(buffer, {
    headers: {
      'Content-Type':           contentType,
      'Content-Disposition':    `${disposition}; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control':          'private, max-age=3600',
      'Content-Length':         String(buffer.byteLength),
    },
  })
}
