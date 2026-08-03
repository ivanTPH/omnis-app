import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '180px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0f766e 100%)',
          borderRadius: '40px',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '100px',
            fontWeight: '800',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1,
          }}
        >
          O
        </span>
      </div>
    ),
    { width: 180, height: 180 },
  )
}
