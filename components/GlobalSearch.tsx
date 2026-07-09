'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { globalSearch, type SearchResult, type SearchResultType } from '@/app/actions/search'

const TYPE_ICON: Record<SearchResultType, string> = {
  student:  'person',
  staff:    'badge',
  homework: 'assignment',
  resource: 'folder_open',
}

const TYPE_LABEL: Record<SearchResultType, string> = {
  student:  'Students',
  staff:    'Staff',
  homework: 'Homework',
  resource: 'Resources',
}

export default function GlobalSearch() {
  const router                      = useRouter()
  const [open,    setOpen]          = useState(false)
  const [query,   setQuery]         = useState('')
  const [results, setResults]       = useState<SearchResult[]>([])
  const [active,  setActive]        = useState(0)
  const [, startTransition]         = useTransition()
  const inputRef                    = useRef<HTMLInputElement>(null)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cmd+K / Ctrl+K opens the palette
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearch(q)
        setResults(r)
        setActive(0)
      })
    }, 250)
  }, [])

  function handleInput(value: string) {
    setQuery(value)
    if (value.trim().length >= 2) search(value)
    else setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) navigate(results[active].href)
    }
  }

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  if (!open) return null

  // Group results by type
  const grouped = results.reduce<Record<SearchResultType, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {} as Record<SearchResultType, SearchResult[]>)

  const types = (Object.keys(grouped) as SearchResultType[])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Icon name="search" size="md" className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search students, homework, staff…"
            className="flex-1 text-[14px] text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 py-2">
            {types.map(type => (
              <div key={type}>
                <p className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {TYPE_LABEL[type]}
                </p>
                {grouped[type].map(r => {
                  const idx = results.indexOf(r)
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(r.href)}
                      onMouseEnter={() => setActive(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                        active === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                        active === idx ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Icon name={TYPE_ICON[r.type]} size="sm" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{r.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{r.subtitle}</p>
                      </div>
                      {active === idx && (
                        <Icon name="arrow_forward" size="sm" className="ml-auto text-blue-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-gray-400">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {query.length < 2 && (
          <div className="px-4 py-5 text-center text-[12px] text-gray-400">
            Type at least 2 characters to search
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-gray-200 font-mono text-[9px]">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-gray-200 font-mono text-[9px]">↵</kbd> open
          </span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-gray-200 font-mono text-[9px]">ESC</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
