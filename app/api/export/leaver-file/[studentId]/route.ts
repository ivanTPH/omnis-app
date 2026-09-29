import { NextRequest, NextResponse } from 'next/server'
import { exportLeaverFile } from '@/app/actions/gdpr'

// The pupil's statutory file (SEND, safeguarding, behaviour) as a JSON
// download, for the school to keep before Omnis deletes it. Admin/SLT only
// (enforced in exportLeaverFile); every download is audit-logged.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params
  try {
    const data = await exportLeaverFile(studentId)
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="leaver-file-${studentId.slice(0, 8)}.json"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
