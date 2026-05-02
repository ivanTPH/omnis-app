import Link from 'next/link'
import Icon from '@/components/ui/Icon'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  action,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 pb-5 border-b border-gray-200 mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 w-fit mb-1"
        >
          <Icon name="arrow_back" size="sm" />
          <span>{backLabel}</span>
        </Link>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs mb-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <Icon name="chevron_right" size="sm" className="text-gray-400" />}
              {crumb.href ? (
                <Link href={crumb.href} className="text-gray-500 hover:text-gray-700">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-gray-400">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-page-title">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}

export default PageHeader
