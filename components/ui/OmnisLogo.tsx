const LogoSvg = ({ size }: { size: number }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,4 28,10 16,16 4,10" fill="white"/>
    <path d="M10,13 L10,20 Q10,22 16,23 Q22,22 22,20 L22,13 L16,16 Z" fill="white" opacity="0.85"/>
    <line x1="4" y1="10" x2="4" y2="20" stroke="white" strokeWidth="1.4"/>
    <circle cx="4" cy="20" r="1" fill="white"/>
    <line x1="3" y1="20" x2="2.5" y2="23" stroke="white" strokeWidth="0.9"/>
    <line x1="4" y1="20" x2="4" y2="23.5" stroke="white" strokeWidth="0.9"/>
    <line x1="5" y1="20" x2="5.5" y2="23" stroke="white" strokeWidth="0.9"/>
  </svg>
)

export default function OmnisLogo({ variant = 'sidebar' }: { variant?: 'sidebar' | 'login' }) {
  if (variant === 'login') {
    return (
      <div className="flex flex-col items-center gap-2.5">
        <div className="w-14 h-14 bg-blue-700 rounded-xl flex items-center justify-center">
          <LogoSvg size={34} />
        </div>
        <span className="text-2xl font-semibold text-gray-900 tracking-tight">omnis</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
        <LogoSvg size={24} />
      </div>
      <span className="text-lg font-semibold text-gray-900 tracking-tight">omnis</span>
    </div>
  )
}
