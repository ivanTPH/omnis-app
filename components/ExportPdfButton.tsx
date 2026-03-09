'use client'

import { useState } from 'react'
import { Download, Loader2, AlertCircle } from 'lucide-react'

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
  const [error,   setError]   = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
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
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <button
        onClick={() => setError(null)}
        className={`flex items-center gap-1.5 text-[11px] text-red-600 hover:text-red-700 ${className ?? ''}`}
        title={error}
      >
        <AlertCircle size={12} />
        {error.length > 30 ? 'Export failed' : error}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 ${className ?? ''}`}
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : <Download size={12} />}
      {loading ? 'Generating…' : label}
    </button>
  )
}
