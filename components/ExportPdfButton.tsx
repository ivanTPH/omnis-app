'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { toast } from '@/components/ui/Toast'

export default function ExportPdfButton({
  href,
  filename,
  label = 'Export PDF',
  className,
}: {
  href:       string
  filename:   string
  label?:     string
  className?: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(href)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? `Export failed (${res.status})`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 ${className ?? ''}`}
    >
      {loading
        ? <Icon name="refresh" size="sm" className="animate-spin" />
        : <Icon name="download" size="sm" />}
      {loading ? 'Generating…' : label}
    </button>
  )
}
