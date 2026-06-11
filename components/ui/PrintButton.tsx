'use client'

import Icon from '@/components/ui/Icon'

export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition print:hidden"
    >
      <Icon name="print" size="sm" />
      {label}
    </button>
  )
}
