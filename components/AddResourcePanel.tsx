'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import {
  Library, Link2, Upload, Plus, Search, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, X, ExternalLink, Pencil, RefreshCw,
} from 'lucide-react'
import { ResourceType } from '@prisma/client'
import {
  getSchoolResourceLibrary,
  addUrlResource,
  addUploadedResource,
  addLibraryResource,
  reReviewResource,
} from '@/app/actions/lessons'
import type { ReviewResult } from '@/lib/sendReview'

// ── helpers ──────────────────────────────────────────────────────────────────

type LibraryResource = Awaited<ReturnType<typeof getSchoolResourceLibrary>>[0]

const TYPE_LABELS: Record<string, string> = {
  PLAN: 'Plan', SLIDES: 'Slides', WORKSHEET: 'Worksheet',
  VIDEO: 'Video', LINK: 'Link', OTHER: 'Other',
}
const TYPE_COLORS: Record<string, string> = {
  PLAN: 'bg-green-100 text-green-700', SLIDES: 'bg-blue-100 text-blue-700',
  WORKSHEET: 'bg-purple-100 text-purple-700', VIDEO: 'bg-rose-100 text-rose-700',
  LINK: 'bg-amber-100 text-amber-700', OTHER: 'bg-gray-100 text-gray-600',
}
function scoreColor(s: number) {
  if (s >= 8) return 'bg-green-100 text-green-700'
  if (s >= 5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}
function scoreBarColor(s: number) {
  if (s >= 8) return 'bg-green-500'
  if (s >= 5) return 'bg-amber-500'
  return 'bg-red-500'
}
function labelFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

type Section = 'library' | 'link' | 'upload'

// ── SEND Result panel ─────────────────────────────────────────────────────────

type ResourceResult = {
  review: ReviewResult
  resourceId: string
  label: string
  description?: string
}

function SendResult({
  result: initialResult,
  onDismiss,
}: {
  result: ResourceResult
  onDismiss: () => void
}) {
  const [review,      setReview]      = useState(initialResult.review)
  const [editMode,    setEditMode]    = useState(false)
  const [editLabel,   setEditLabel]   = useState(initialResult.label)
  const [editDesc,    setEditDesc]    = useState(initialResult.description ?? '')
  const [rereviewing, startReReview]  = useTransition()

  function handleReReview() {
    startReReview(async () => {
      const { review: newReview } = await reReviewResource(initialResult.resourceId, {
        label:       editLabel,
        description: editDesc || undefined,
      })
      setReview(newReview)
      setEditMode(false)
    })
  }

  const bgClass =
    review.score >= 8 ? 'bg-green-50 border-green-200' :
    review.score >= 5 ? 'bg-amber-50 border-amber-200' :
    'bg-red-50 border-red-200'

  return (
    <div className={`rounded-xl border p-4 mt-3 ${bgClass}`}>

      {/* Resource label — double-click to enter edit mode */}
      <div
        className="flex items-center gap-2 mb-3 cursor-pointer group"
        onDoubleClick={() => !editMode && setEditMode(true)}
        title="Double-click to edit label and description"
      >
        <span className="text-[12px] font-semibold text-gray-800 flex-1 truncate">{editLabel}</span>
        <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          double-click to edit
        </span>
      </div>

      {/* Score header + bar */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">SEND Accessibility Score</p>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${scoreColor(review.score)}`}>
          {review.score} / 10
        </span>
      </div>
      <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-3 border border-black/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${scoreBarColor(review.score)}`}
          style={{ width: `${review.score * 10}%` }}
        />
      </div>

      {/* Improvement suggestions — always shown */}
      <div className="mb-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Suggestions for improvement</p>
        {review.suggestions.length > 0 ? (
          <ul className="space-y-1.5">
            {review.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700 leading-snug">
                <div className="w-4 h-4 rounded-full bg-white/70 border border-black/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-gray-500">{i + 1}</span>
                </div>
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-gray-500 italic">
            {review.score >= 8
              ? 'Great score — this resource appears well-suited for SEND learners.'
              : 'Add a description (below) to get specific improvement suggestions from the AI.'}
          </p>
        )}
      </div>

      {/* Inline edit panel — also opened by double-clicking the label */}
      {editMode ? (
        <div className="space-y-2 border-t border-black/10 pt-3 mt-1">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Resource label</label>
            <input
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
              Description
              <span className="text-gray-400 normal-case font-normal ml-1">(AI uses this to score SEND accessibility)</span>
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Describe differentiation, visual supports, readability level, accessibility features…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReReview}
              disabled={rereviewing || !editLabel}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
            >
              {rereviewing
                ? <><Loader2 size={12} className="animate-spin" /> Re-scoring…</>
                : <><RefreshCw size={12} /> Save &amp; re-score SEND</>}
            </button>
            <button
              onClick={() => setEditMode(false)}
              disabled={rereviewing}
              className="px-3 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 rounded-lg text-[12px] font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div className="flex gap-2 border-t border-black/10 pt-3">
          <button
            onClick={() => setEditMode(true)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
          >
            <Pencil size={12} /> Edit &amp; improve
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
          >
            <CheckCircle2 size={12} className="text-green-600" /> Use as-is
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AddResourcePanel({
  lessonId,
  onAdded,
  wizardExpanded = false,
}: {
  lessonId: string
  onAdded: () => void
  wizardExpanded?: boolean
}) {
  const [open,        setOpen]        = useState(wizardExpanded)
  const [activeSection, setActiveSection] = useState<Section>('library')

  // Library state
  const [library,     setLibrary]     = useState<LibraryResource[]>([])
  const [libLoading,  setLibLoading]  = useState(false)
  const [libSearch,   setLibSearch]   = useState('')
  const [libPending,  startLibAdd]    = useTransition()

  // Link form state
  const [linkUrl,     setLinkUrl]     = useState('')
  const [linkLabel,   setLinkLabel]   = useState('')
  const [linkType,    setLinkType]    = useState<ResourceType>('LINK')
  const [linkDesc,    setLinkDesc]    = useState('')
  const [linkPending, startLinkAdd]   = useTransition()
  const [linkResult,  setLinkResult]  = useState<ResourceResult | null>(null)
  const [linkError,   setLinkError]   = useState<string | null>(null)

  // Upload form state
  const fileRef                       = useRef<HTMLInputElement>(null)
  const [uploadLabel,  setUploadLabel]  = useState('')
  const [uploadType,   setUploadType]   = useState<ResourceType>('SLIDES')
  const [uploadFile,   setUploadFile]   = useState<File | null>(null)
  const [uploadDesc,   setUploadDesc]   = useState('')
  const [uploadPending, startUploadAdd] = useTransition()
  const [uploadResult, setUploadResult] = useState<ResourceResult | null>(null)
  const [uploadError,  setUploadError]  = useState<string | null>(null)

  // Load library when panel opens on library tab (reload if lessonId changes)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || activeSection !== 'library') return
    setLibLoading(true)
    setLibrary([])
    getSchoolResourceLibrary(lessonId).then(res => {
      setLibrary(res)
      setLibLoading(false)
    })
  }, [open, activeSection, lessonId])

  // When wizardExpanded is toggled on, auto-open
  useEffect(() => {
    if (wizardExpanded) setOpen(true)
  }, [wizardExpanded])
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredLibrary = library.filter(r =>
    r.label.toLowerCase().includes(libSearch.toLowerCase())
  )

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setUploadFile(f)
    if (f && !uploadLabel) setUploadLabel(labelFromFileName(f.name))
    setUploadResult(null)
  }

  function handleLinkSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!linkUrl || !linkLabel) return
    setLinkResult(null)
    setLinkError(null)
    startLinkAdd(async () => {
      try {
        const { resourceId, review } = await addUrlResource(lessonId, {
          label: linkLabel, type: linkType, url: linkUrl,
          description: linkDesc || undefined,
        })
        setLinkResult({ review, resourceId, label: linkLabel, description: linkDesc || undefined })
      } catch (err) {
        setLinkError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    })
  }

  function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile || !uploadLabel) return
    setUploadResult(null)
    setUploadError(null)
    startUploadAdd(async () => {
      try {
        const { resourceId, review } = await addUploadedResource(lessonId, {
          label: uploadLabel, type: uploadType,
          fileName: uploadFile.name,
          description: uploadDesc || undefined,
        })
        setUploadResult({ review, resourceId, label: uploadLabel, description: uploadDesc || undefined })
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    })
  }

  function dismissLinkResult() {
    setLinkResult(null)
    setLinkUrl(''); setLinkLabel(''); setLinkDesc('')
    onAdded()
  }

  function dismissUploadResult() {
    setUploadResult(null)
    setUploadLabel(''); setUploadDesc(''); setUploadFile(null)
    if (fileRef.current) fileRef.current.value = ''
    onAdded()
  }

  const LINK_TYPES: ResourceType[] = ['LINK', 'VIDEO', 'WORKSHEET', 'OTHER']
  const UPLOAD_TYPES: ResourceType[] = ['SLIDES', 'PLAN', 'WORKSHEET', 'OTHER']

  return (
    <div className={wizardExpanded ? '' : 'mt-4'}>
      {/* Toggle button — hidden in wizard mode */}
      {!wizardExpanded && (
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[12px] font-semibold transition-colors"
        >
          {open ? <ChevronUp size={13} /> : <Plus size={13} />}
          Add Resource
        </button>
      )}

      {!open ? null : (
        <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">

          {/* Section tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {([
              { id: 'library', icon: <Library size={12} />,  label: 'School Library' },
              { id: 'link',    icon: <Link2   size={12} />,  label: 'Add Link'       },
              { id: 'upload',  icon: <Upload  size={12} />,  label: 'Upload File'    },
            ] as { id: Section; icon: React.ReactNode; label: string }[]).map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2.5 text-[11px] font-semibold transition-colors ${
                  activeSection === s.id
                    ? 'bg-white text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.icon}{s.label}
              </button>
            ))}
          </div>

          {/* ── Library ── */}
          {activeSection === 'library' && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={libSearch}
                  onChange={e => setLibSearch(e.target.value)}
                  placeholder="Search resources…"
                  className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
              </div>

              {libLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              ) : filteredLibrary.length === 0 ? (
                <p className="text-[12px] text-gray-400 text-center py-6">
                  {libSearch ? 'No resources match your search' : 'No resources in school library yet'}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-auto">
                  {filteredLibrary.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[r.type]}
                      </span>
                      <span className="flex-1 text-[12px] text-gray-800 truncate">{r.label}</span>
                      {r.review && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${scoreColor(r.review.sendScore)}`}>
                          {r.review.sendScore}/10
                        </span>
                      )}
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-gray-500 shrink-0">
                          <ExternalLink size={11} />
                        </a>
                      )}
                      <button
                        disabled={libPending}
                        onClick={() => startLibAdd(async () => {
                          await addLibraryResource(lessonId, r.id)
                          onAdded()
                        })}
                        className="shrink-0 w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded transition-colors"
                      >
                        {libPending ? <Loader2 size={10} className="animate-spin" /> : <Plus size={11} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Add Link ── */}
          {activeSection === 'link' && (
            <div className="p-4">
              {!linkResult ? (
                <form onSubmit={handleLinkSubmit} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">URL *</label>
                    <input
                      type="url"
                      required
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      placeholder="https://www.bbc.co.uk/bitesize/…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label *</label>
                      <input
                        required
                        value={linkLabel}
                        onChange={e => setLinkLabel(e.target.value)}
                        placeholder="e.g. BBC Bitesize — Macbeth"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Type</label>
                      <select
                        value={linkType}
                        onChange={e => setLinkType(e.target.value as ResourceType)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        {LINK_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Description <span className="text-gray-400 normal-case font-normal">(helps Claude score accurately)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={linkDesc}
                      onChange={e => setLinkDesc(e.target.value)}
                      placeholder="e.g. Visual summary with diagrams — suitable for all learners"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={linkPending || !linkUrl || !linkLabel}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-colors"
                  >
                    {linkPending
                      ? <><Loader2 size={13} className="animate-spin" /> Adding &amp; reviewing for SEND…</>
                      : 'Add & Review for SEND'
                    }
                  </button>
                  {linkError && (
                    <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">{linkError}</p>
                  )}
                </form>
              ) : (
                <SendResult result={linkResult} onDismiss={dismissLinkResult} />
              )}
            </div>
          )}

          {/* ── Upload File ── */}
          {activeSection === 'upload' && (
            <div className="p-4">
              {!uploadResult ? (
                <form onSubmit={handleUploadSubmit} className="space-y-3">
                  {/* File picker */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">File *</label>
                    <label className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-4 cursor-pointer transition-colors ${
                      uploadFile ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300'
                    }`}>
                      <Upload size={18} className={uploadFile ? 'text-blue-500' : 'text-gray-400'} />
                      <div className="flex-1 min-w-0">
                        {uploadFile ? (
                          <p className="text-[12px] font-semibold text-blue-700 truncate">{uploadFile.name}</p>
                        ) : (
                          <>
                            <p className="text-[12px] font-medium text-gray-600">Click to choose file</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">PDF, PPTX, DOCX supported</p>
                          </>
                        )}
                      </div>
                      {uploadFile && (
                        <button
                          type="button"
                          onClick={e => { e.preventDefault(); setUploadFile(null); setUploadLabel(''); if (fileRef.current) fileRef.current.value = '' }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,.pptx,.ppt,.docx,.doc"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Label *</label>
                      <input
                        required
                        value={uploadLabel}
                        onChange={e => setUploadLabel(e.target.value)}
                        placeholder="Resource name"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Type</label>
                      <select
                        value={uploadType}
                        onChange={e => setUploadType(e.target.value as ResourceType)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                      >
                        {UPLOAD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Description <span className="text-gray-400 normal-case font-normal">(helps Claude score accurately)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={uploadDesc}
                      onChange={e => setUploadDesc(e.target.value)}
                      placeholder="e.g. Differentiated worksheet with visual prompts for all ability levels"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploadPending || !uploadFile || !uploadLabel}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-colors"
                  >
                    {uploadPending
                      ? <><Loader2 size={13} className="animate-spin" /> Uploading &amp; reviewing for SEND…</>
                      : 'Upload & Review for SEND'
                    }
                  </button>
                  {uploadError && (
                    <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">{uploadError}</p>
                  )}
                </form>
              ) : (
                <SendResult result={uploadResult} onDismiss={dismissUploadResult} />
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
