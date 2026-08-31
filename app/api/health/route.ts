/**
 * GET /api/health
 *
 * Lightweight, unauthenticated health check for external uptime monitoring
 * (e.g. UptimeRobot, Better Uptime, Pingdom). Not behind auth — excluded from
 * the auth middleware matcher along with the rest of /api (see middleware.ts).
 *
 * Runs a trivial DB query so the check actually reflects whether the app can
 * reach the database, not just that the Node process is alive — but the
 * query is deliberately as cheap as possible (SELECT 1, no table scan) and
 * wrapped so a DB hiccup returns a clear 503 instead of throwing and
 * producing a 500 / cold Next.js error page that would be harder for a
 * monitor to distinguish from "the whole app is down."
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', timestamp })
  } catch {
    return NextResponse.json(
      { status: 'error', timestamp, detail: 'database unreachable' },
      { status: 503 },
    )
  }
}
