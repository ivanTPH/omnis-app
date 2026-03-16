'use client'
import { useState, useEffect, useTransition } from 'react'
import { X, Download, Plus, Loader2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { getOakLesson, addOakLessonToLesson } from '@/app/actions/oak'

type OakDetail = Awaited<ReturnType<typeof getOakLesson>>

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left hover:bg-gray-100 transition-colors"
      >
        <span className="text-[12px] font-semibold text-gray-700">{title}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  )
}

export default function ResourcePreviewModal({
  slug,
  lessonId,
  onClose,
  onAdded,
}: {
  slug:      string
  lessonId:  string
  onClose:   () => void
  onAdded?:  () => void
}) {
  const [detail,   setDetail]   = useState<OakDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [added,    setAdded]    = useState(false)
  const [, startAdd]            = useTransition()

  useEffect(() => {
    setLoading(true)
    getOakLesson(slug).then(d => {
      setDetail(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

  function handleAdd() {
    startAdd(async () => {
      await addOakLessonToLesson(lessonId, slug)
      setAdded(true)
      onAdded?.()
    })
  }

  const keywords     = (detail?.lessonKeywords     as { keyword: string; description?: string }[] | null) ?? []
  const learningPts  = (detail?.keyLearningPoints  as { keyLearningPoint: string }[]              | null) ?? []
  const starterQuiz  = (detail?.starterQuiz         as { question: string; answers?: string[] }[] | null) ?? []
  const exitQuiz     = (detail?.exitQuiz            as { question: string; answers?: string[] }[] | null) ?? []

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                <BookOpen size={9} />Oak National
              </span>
              {detail?.keystage && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{detail.keystage}</span>
              )}
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 leading-tight">
              {loading ? 'Loading…' : (detail?.title ?? 'Unknown lesson')}
            </h2>
            {detail?.unit?.title && (
              <p className="text-[11px] text-gray-400 mt-0.5">{detail.unit.title}</p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-gray-500 text-center py-8">Could not load lesson details.</p>
          ) : (
            <>
              {/* Pupil lesson outcome */}
              {detail.pupilLessonOutcome && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Learning outcome</p>
                  <p className="text-[13px] text-gray-800 leading-relaxed">{detail.pupilLessonOutcome}</p>
                </div>
              )}

              {/* Key learning points */}
              {learningPts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Key learning points</p>
                  <ul className="space-y-1.5">
                    {learningPts.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                        <span className="w-4 h-4 shrink-0 mt-0.5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] font-bold">{i + 1}</span>
                        {pt.keyLearningPoint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Keywords */}
              {keywords.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Key vocabulary</p>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw, i) => (
                      <span
                        key={i}
                        title={kw.description}
                        className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-[11px] font-medium border border-amber-200 cursor-help"
                      >
                        {kw.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Starter quiz */}
              {starterQuiz.length > 0 && (
                <CollapsibleSection title={`Starter quiz (${starterQuiz.length} questions)`}>
                  <ol className="space-y-2">
                    {starterQuiz.slice(0, 5).map((q, i) => (
                      <li key={i} className="text-[12px] text-gray-700">
                        <span className="font-medium">{i + 1}. </span>{q.question}
                      </li>
                    ))}
                    {starterQuiz.length > 5 && (
                      <li className="text-[11px] text-gray-400">…and {starterQuiz.length - 5} more</li>
                    )}
                  </ol>
                </CollapsibleSection>
              )}

              {/* Exit quiz */}
              {exitQuiz.length > 0 && (
                <CollapsibleSection title={`Exit quiz (${exitQuiz.length} questions)`}>
                  <ol className="space-y-2">
                    {exitQuiz.slice(0, 5).map((q, i) => (
                      <li key={i} className="text-[12px] text-gray-700">
                        <span className="font-medium">{i + 1}. </span>{q.question}
                      </li>
                    ))}
                    {exitQuiz.length > 5 && (
                      <li className="text-[11px] text-gray-400">…and {exitQuiz.length - 5} more</li>
                    )}
                  </ol>
                </CollapsibleSection>
              )}

              {/* Downloads */}
              {(detail.worksheetUrl || detail.presentationUrl) && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Downloads</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.worksheetUrl && (
                      <a
                        href={detail.worksheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Download size={12} /> Worksheet
                      </a>
                    )}
                    {detail.presentationUrl && (
                      <a
                        href={detail.presentationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Download size={12} /> Slides
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
          <button
            onClick={handleAdd}
            disabled={added || loading || !detail}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
              added
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white'
            }`}
          >
            {added ? '✓ Added to lesson' : <><Plus size={14} /> Add to lesson</>}
          </button>
        </div>
      </div>
    </div>
  )
}
