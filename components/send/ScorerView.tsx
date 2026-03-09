'use client'

import { useState, useTransition } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { searchLessonsWithScores, getOrCreateSendScore } from '@/app/actions/send-scorer'
import type { LessonWithScore } from '@/app/actions/send-scorer'
import ScorerResultRow from './ScorerResultRow'

const KS_OPTIONS = ['ks3', 'ks4', 'ks5']

type Props = {
  canRescore: boolean
  initialSubjects: { slug: string; title: string }[]
}

export default function ScorerView({ canRescore, initialSubjects }: Props) {
  const [query,     setQuery]     = useState('')
  const [subject,   setSubject]   = useState('')
  const [keystage,  setKeystage]  = useState('')
  const [lessons,   setLessons]   = useState<LessonWithScore[]>([])
  const [total,     setTotal]     = useState<number | null>(null)
  const [searched,  setSearched]  = useState(false)

  const [searching, startSearch]   = useTransition()
  const [scoring,   startScoreAll] = useTransition()

  function handleSearch() {
    startSearch(async () => {
      const result = await searchLessonsWithScores({
        query: query.trim() || undefined,
        subject: subject || undefined,
        keystage: keystage || undefined,
        limit: 30,
      })
      setLessons(result.lessons)
      setTotal(result.total)
      setSearched(true)
    })
  }

  function handleScoreAll() {
    startScoreAll(async () => {
      const updated = await Promise.all(
        lessons.map(async l => {
          if (l.sendQualityScore) return l
          const s = await getOrCreateSendScore(l.slug)
          return { ...l, sendQualityScore: s }
        }),
      )
      setLessons(updated)
    })
  }

  const unscoredCount = lessons.filter(l => !l.sendQualityScore).length

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search lesson titles…"
              className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
          >
            {searching ? <Loader2 size={13} className="animate-spin" /> : 'Search'}
          </button>
        </div>

        <div className="flex gap-2">
          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All subjects</option>
            {initialSubjects.map(s => (
              <option key={s.slug} value={s.slug}>{s.title}</option>
            ))}
          </select>

          <select
            value={keystage}
            onChange={e => setKeystage(e.target.value)}
            className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All key stages</option>
            {KS_OPTIONS.map(k => (
              <option key={k} value={k}>{k.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results header */}
      {searched && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-gray-500">
            {total !== null ? `${total} lesson${total !== 1 ? 's' : ''} found` : ''}
            {lessons.length > 0 && unscoredCount > 0 ? ` · ${unscoredCount} unscored` : ''}
          </p>
          {unscoredCount > 0 && (
            <button
              onClick={handleScoreAll}
              disabled={scoring}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {scoring ? <Loader2 size={12} className="animate-spin" /> : null}
              Score all visible ({unscoredCount})
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {lessons.length > 0 && (
        <div className="space-y-2">
          {lessons.map(l => (
            <ScorerResultRow key={l.slug} lesson={l} canRescore={canRescore} />
          ))}
        </div>
      )}

      {searched && lessons.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-[13px]">
          No lessons found. Try a different search term or filter.
        </div>
      )}

      {!searched && (
        <div className="text-center py-12 text-gray-300 text-[13px]">
          Search for Oak National Academy lessons to score them for SEND accessibility.
        </div>
      )}
    </div>
  )
}
