import { ImageResponse } from 'next/og'
import { ogImageJsx } from '@/lib/og-image-template'

export const runtime     = 'edge'
export const alt         = 'Omnis Education Platform Features — AI homework, SEND management, MIS sync'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    ogImageJsx({
      category:    'Platform Features',
      title:       'Everything your school needs in one place',
      description: 'AI homework generation · SEND/ILP/EHCP management · MIS sync via Wonde · Adaptive analytics · Revision programs',
    }),
    { width: 1200, height: 630 },
  )
}
