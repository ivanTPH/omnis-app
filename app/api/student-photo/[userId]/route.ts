/**
 * /api/student-photo/[userId]
 *
 * Serves a user's photo to signed-in staff and pupils of the same school.
 *
 *   1. A stored photo (UserPhoto, written by the MIS sync) is served as-is.
 *   2. Legacy: a data: URL or an external URL in User.avatarUrl (Wonde URLs are
 *      fetched with Basic auth, which a browser <img> cannot supply).
 *   3. Pupils in a demo school with no photo get a cartoon avatar generated
 *      here, seeded by their id, so demo pages look real without sending any
 *      name to a third-party service.
 *   4. Everyone else gets an initials SVG.
 *
 * Responses are privately cached for an hour.
 */

import { auth }   from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { createAvatar } from '@dicebear/core'
import { avataaars } from '@dicebear/collection'

const CACHE = 'private, max-age=3600'

function svgInitials(firstName: string | null, lastName: string | null): NextResponse {
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  // Pick a stable colour from initials char code
  // 700 shades: white initials meet WCAG AA contrast (4.5:1) on every colour.
  const colours = ['#4338ca','#0e7490','#047857','#b45309','#b91c1c','#6d28d9','#be185d']
  const bg = colours[(initials.charCodeAt(0) ?? 0) % colours.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="64" fill="${bg}"/>
  <text x="64" y="64" dy="0.35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="52" font-weight="600" fill="white">${initials}</text>
</svg>`
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth()
  const caller = session?.user as { schoolId?: string } | undefined
  if (!caller?.schoolId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { userId } = await params

  // ── 1. Read User.avatarUrl + names directly — scoped to the caller's own
  // school so one school can never fetch another school's student/staff photos ─
  const user = await prisma.user.findFirst({
    where:  { id: userId, schoolId: caller.schoolId },
    select: {
      avatarUrl: true, firstName: true, lastName: true, role: true,
      school: { select: { isDemo: true } },
      photo:  { select: { contentType: true, data: true } },
    },
  })

  if (user?.photo) {
    return new NextResponse(new Uint8Array(user.photo.data), {
      status:  200,
      headers: { 'Content-Type': user.photo.contentType, 'Cache-Control': CACHE },
    })
  }

  // A link back to this route (or no URL at all) means there is no stored photo.
  const photoUrl = user?.avatarUrl && !user.avatarUrl.startsWith('/api/student-photo/') ? user.avatarUrl : null
  if (!user || !photoUrl) {
    if (user?.school.isDemo && user.role === 'STUDENT') {
      const svg = createAvatar(avataaars, { seed: userId, backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'] }).toString()
      return new NextResponse(svg, { status: 200, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': CACHE } })
    }
    return svgInitials(user?.firstName ?? null, user?.lastName ?? null)
  }

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
    return svgInitials(user.firstName, user.lastName)
  }

  if (!photoRes.ok) {
    return svgInitials(user.firstName, user.lastName)
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
