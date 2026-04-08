/**
 * /api/student-photo/[userId]
 *
 * Server-side proxy for student photos.
 *
 * Wonde photo URLs require an Authorization: Basic header which browsers
 * cannot supply via a plain <img src="...">. This route:
 *   1. Verifies the caller is authenticated (NextAuth session)
 *   2. Reads User.avatarUrl directly from the DB
 *   3. If avatarUrl is a data URI, decodes and returns it directly (no fetch)
 *   4. Otherwise fetches it server-side — Wonde URLs get Basic auth, public URLs get none
 *   5. Returns the image bytes with a 1-hour private cache header
 *   6. Returns 404 if avatarUrl is null
 *
 * The Wonde sync stores the raw photo URL in User.avatarUrl.
 * StudentAvatar always requests /api/student-photo/{userId} so the browser
 * never needs to supply an Authorization header.
 */

import { auth }   from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { userId } = await params

  // ── 1. Read User.avatarUrl directly ──────────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { avatarUrl: true },
  })

  if (!user?.avatarUrl) {
    return NextResponse.json({ error: 'No photo available' }, { status: 404 })
  }

  const photoUrl = user.avatarUrl

  // ── 2. Data URIs — return directly without a network fetch ───────────────
  if (photoUrl.startsWith('data:')) {
    const [header, b64] = photoUrl.split(',')
    const contentType   = header.replace('data:', '').replace(';base64', '')
    const bytes         = Buffer.from(b64, 'base64')
    return new NextResponse(bytes, {
      status:  200,
      headers: {
        'Content-Type':  contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  }

  // ── 3. Fetch — Basic auth for Wonde URLs, unauthenticated for public CDNs ─
  const token   = process.env.WONDE_API_TOKEN
  const isWonde = photoUrl.includes('wonde')
  const fetchHeaders: Record<string, string> = {}
  if (isWonde && token) {
    fetchHeaders['Authorization'] =
      'Basic ' + Buffer.from(token + ':').toString('base64')
  }

  let photoRes: Response
  try {
    photoRes = await fetch(photoUrl, {
      headers: fetchHeaders,
      signal:  AbortSignal.timeout(10_000),
    })
  } catch {
    return NextResponse.json({ error: 'Photo fetch timeout' }, { status: 504 })
  }

  if (!photoRes.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${photoRes.status}` },
      { status: photoRes.status },
    )
  }

  // ── 3. Stream image bytes back to client ──────────────────────────────────
  const blob        = await photoRes.blob()
  const contentType = photoRes.headers.get('content-type') ?? 'image/jpeg'

  return new NextResponse(blob, {
    status:  200,
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
