'use client'
import { useState, useEffect, useRef, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import StudentFilePanel from '@/components/students/StudentFilePanel'
import { searchStudents, getStudentFile } from '@/app/actions/students'
import type { StudentSearchResult, StudentFileData } from '@/app/actions/students'

export default function StudentSearch({ role }: { role: string }) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<StudentSearchResult[]>([])
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [panelData, setPanelData] = useState<StudentFileData | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [fetching,  startFetch]   = useTransition()

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search — fires after 300 ms, min 2 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await searchStudents(query)
        setResults(r)
        setOpen(r.length > 0)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSelect(studentId: string) {
    setOpen(false)
    setQuery('')
    startFetch(async () => {
      const data = await getStudentFile(studentId)
      if (data) {
        setPanelData(data)
        setPanelOpen(true)
      }
    })
  }

  const busy = loading || fetching

  return (
    <>
      {/* Search box */}
      <div ref={containerRef} className="relative mb-4">
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search students by name…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {busy && (
            <Icon
              name="refresh"
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
            />
          )}
          {!busy && query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {open && results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {results.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-blue-700">
                    {s.firstName[0]}{s.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900">{s.firstName} {s.lastName}</p>
                  {s.yearGroup != null && (
                    <p className="text-[11px] text-gray-400">Year {s.yearGroup}</p>
                  )}
                </div>
                <Icon name="chevron_right" size="sm" className="text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Student file slide-over */}
      {panelOpen && panelData && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPanelOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-2xl bg-gray-50 overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-gray-700">Student File</span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <Icon name="close" size="md" className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <StudentFilePanel data={panelData} role={role} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
