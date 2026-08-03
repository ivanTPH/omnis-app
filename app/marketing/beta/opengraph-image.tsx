import { ImageResponse } from 'next/og'
import { ogImageJsx } from '@/lib/og-image-template'

export const runtime     = 'edge'
export const alt         = 'Request beta access to Omnis Education — free for UK secondary schools'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    ogImageJsx({
      category:    'Beta Programme',
      title:       'Join the first schools on Omnis',
      description: 'Full platform access, dedicated onboarding, and direct input into the roadmap — free during the beta period for UK secondary schools.',
    }),
    { width: 1200, height: 630 },
  )
}
