import { NextRequest, NextResponse } from 'next/server'
import { exportStudentData } from '@/app/actions/gdpr'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ dsrId: string }> },
) {
  const { dsrId } = await params
  try {
    const data = await exportStudentData(dsrId)
    const json = JSON.stringify(data, null, 2)
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type':        'application/json',
        'Content-Disposition': `attachment; filename="gdpr-data-export-${dsrId.slice(0, 8)}.json"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
