/**
 * /api/student-photo/[userId]
 *
 * Server-side proxy for Wonde student photos.
 *
 * Wonde photo URLs require an Authorization: Bearer header which browsers
 * cannot supply via a plain <img src="...">. This route:
 *   1. Verifies the caller is authenticated (NextAuth session)
 *   2. Looks up the matching WondeStudent by firstName + lastName within the school
 *   3. Fetches WondeStudent.photoUrl with the WONDE_API_TOKEN
 *   4. Returns the image bytes with a 1-hour private cache header
 *
 * The sync stores /api/student-photo/{userId} as User.avatarUrl so that
 * StudentAvatar renders correctly without any per-component auth logic.
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

  // ── 1. Find the user to get their name + school ───────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { firstName: true, lastName: true, schoolId: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── 2. Find matching WondeStudent by name within school ───────────────────
  const wondeStudent = await prisma.wondeStudent.findFirst({
    where: {
      schoolId:  user.schoolId,
      firstName: user.firstName,
      lastName:  user.lastName,
    },
    select: { photoUrl: true },
  })

  if (!wondeStudent?.photoUrl) {
    return NextResponse.json({ error: 'No photo available' }, { status: 404 })
  }

  // ── 3. Fetch photo from Wonde with API token ──────────────────────────────
  const token = process.env.WONDE_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Wonde not configured' }, { status: 503 })
  }

  let photoRes: Response
  try {
    photoRes = await fetch(wondeStudent.photoUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(10_000),
    })
  } catch (err) {
    return NextResponse.json({ error: 'Photo fetch timeout' }, { status: 504 })
  }

  if (!photoRes.ok) {
    return NextResponse.json(
      { error: `Wonde returned ${photoRes.status}` },
      { status: photoRes.status },
    )
  }

  // ── 4. Stream image bytes back to client ──────────────────────────────────
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
