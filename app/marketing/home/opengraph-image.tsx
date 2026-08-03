import { ImageResponse } from 'next/og'
import { ogImageJsx } from '@/lib/og-image-template'

export const runtime     = 'edge'
export const alt         = 'Omnis Education — AI-powered learning & SEND platform for UK secondary schools'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    ogImageJsx({
      category:    'AI School Platform',
      title:       'AI-Powered Learning & SEND for UK Schools',
      description: 'Lesson planning, adaptive homework, ILP/EHCP management, and MIS sync — all in one platform built for UK secondary schools.',
    }),
    { width: 1200, height: 630 },
  )
}
