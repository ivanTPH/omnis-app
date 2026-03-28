// Shared Material Icons wrapper
// Usage: <Icon name="edit" size="md" color="#6b7280" />
// Icon names: https://fonts.google.com/icons

const sizeMap: Record<string, string> = {
  sm: '16px',
  md: '20px',
  lg: '24px',
}

export default function Icon({
  name,
  size = 'md',
  color,
  className = '',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}) {
  return (
    <span
      className={`material-icons select-none leading-none ${className}`}
      style={{ fontSize: sizeMap[size], color, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
