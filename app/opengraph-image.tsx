import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt     = 'Omnis Education — AI-powered learning & SEND management for UK secondary schools'
export const size    = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          width: '100%',
          height: '100%',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0d9488 100%)',
        }}
      >
        {/* Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '999px',
          padding: '6px 18px',
          marginBottom: '28px',
        }}>
          <span style={{ color: '#bfdbfe', fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Beta programme — UK secondary schools
          </span>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: '72px',
          fontWeight: 800,
          color: '#ffffff',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          marginBottom: '24px',
          maxWidth: '900px',
        }}>
          The SEND-intelligent school platform
        </div>

        {/* Sub */}
        <div style={{
          fontSize: '26px',
          color: '#bfdbfe',
          lineHeight: 1.4,
          maxWidth: '800px',
          marginBottom: '48px',
        }}>
          AI homework · ILP/EHCP management · MIS sync · Analytics
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#ffffff',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '22px', height: '22px', background: '#1d4ed8', borderRadius: '5px' }} />
          </div>
          <span style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700 }}>omnis.education</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
