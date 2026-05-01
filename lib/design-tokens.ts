// ─── Design tokens — Omnis visual language ───────────────────────────────────
// Source of truth for colours, badge styles, button styles.
// Import in components to keep the design consistent.

export const colors = {
  primary:      'blue-700',
  primaryHover: 'blue-800',
  primaryLight: 'blue-50',
  secondary:    'gray-600',
  success:      'green-600',
  warning:      'amber-500',
  danger:       'red-500',
  send:         'blue-500',
  ehcp:         'purple-500',
  kplan:        'green-600',
}

export const badges = {
  senSupport:  'bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full border border-blue-200',
  ehcp:        'bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full border border-purple-200',
  kplan:       'bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full border border-green-200',
  ilp:         'bg-blue-50 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-full border border-blue-100',
  onTrack:     'bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full',
  developing:  'bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full',
  attention:   'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full',
  published:   'bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full',
  draft:       'bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full',
  returned:    'bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full',
  missing:     'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full',
  overdue:     'bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full',
  closed:      'bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full',
}

export const buttons = {
  primary:   'bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg transition-colors',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium px-4 py-2 rounded-lg transition-colors',
  danger:    'bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors',
  ghost:     'hover:bg-gray-100 text-gray-600 font-medium px-3 py-1.5 rounded-lg transition-colors',
}
