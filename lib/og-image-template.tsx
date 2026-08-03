/**
 * Shared OG image template — pure JSX for use with next/og ImageResponse.
 * No Node.js imports; safe for edge runtime.
 */
export function ogImageJsx({
  category,
  title,
  description,
}: {
  category: string
  title: string
  description: string
}) {
  return (
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #0f766e 100%)',
        padding: '56px 72px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Logo row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            background: 'white',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            fontWeight: '800',
            color: '#1e3a8a',
          }}
        >
          O
        </div>
        <span
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: '20px',
            fontWeight: '600',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}
        >
          Omnis Education
        </span>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <span
          style={{
            color: 'rgba(147, 197, 253, 0.9)',
            fontSize: '17px',
            fontWeight: '600',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
          }}
        >
          {category}
        </span>
        <span
          style={{
            color: 'white',
            fontSize: '58px',
            fontWeight: '800',
            lineHeight: '1.1',
            maxWidth: '940px',
          }}
        >
          {title}
        </span>
        <span
          style={{
            color: 'rgba(191, 219, 254, 0.85)',
            fontSize: '22px',
            lineHeight: '1.55',
            maxWidth: '840px',
          }}
        >
          {description}
        </span>
      </div>

      {/* Bottom bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#34d399',
          }}
        />
        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '16px', fontWeight: '500' }}>
          UK Secondary Schools · AI-Powered · GDPR Compliant
        </span>
      </div>
    </div>
  )
}
