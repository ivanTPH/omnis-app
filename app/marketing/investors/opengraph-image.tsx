import { ImageResponse } from 'next/og'
import { ogImageJsx } from '@/lib/og-image-template'

export const runtime     = 'edge'
export const alt         = 'Omnis Education — investor information, UK EdTech'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    ogImageJsx({
      category:    'Investor Relations',
      title:       'Building the intelligence layer for UK schools',
      description: '3,600+ secondary schools · £2.4bn EdTech market · 1 in 5 pupils with SEND needs · AI-powered platform at beta stage.',
    }),
    { width: 1200, height: 630 },
  )
}
