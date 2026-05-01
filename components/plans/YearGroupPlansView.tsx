'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { toast, ToastContainer } from '@/components/ui/Toast'
import {
  upsertYearGroupPlan,
  submitForApproval,
  approvePlan,
  deletePlan,
  type YearGroupPlanData,
} from '@/app/actions/year-group-plans'

// All staff can create/edit; only HOD/SLT/Admin can approve
const EDIT_ROLES    = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT']
const APPROVE_ROLES = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

const ALL_SUBJECTS = [
  'English', 'English Literature', 'Mathematics', 'Science', 'Biology', 'Chemistry', 'Physics',
  'History', 'Geography', 'Religious Studies', 'PSHE', 'Art', 'Drama', 'Music',
  'Physical Education', 'Design Technology', 'Food Technology', 'Computer Science',
  'Business Studies', 'Economics', 'French', 'Spanish', 'German', 'Media Studies',
  'Sociology', 'Psychology',
]

const YEAR_GROUPS = [7, 8, 9, 10, 11]

type ModalState = {
  open:            boolean
  plan?:           YearGroupPlanData
  yearGroup:       number
  subject:         string
  content:         string
  fileUrl:         string
  submitAfterSave: boolean
}

const DEFAULT_MODAL: ModalState = {
  open:            false,
  plan:            undefined,
  yearGroup:       7,
  subject:         '',
  content:         '',
  fileUrl:         '',
  submitAfterSave: false,
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Icon name="check_circle" size="sm" className="text-green-600" />
        Approved
      </span>
    )
  }
  if (status === 'SUBMITTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <Icon name="pending" size="sm" className="text-amber-600" />
        Submitted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <Icon name="edit_note" size="sm" className="text-gray-400" />
      Draft
    </span>
  )
}

export default function YearGroupPlansView({
  plans,
  userRole,
}: {
  plans:    YearGroupPlanData[]
  userRole: string
}) {
  const router     = useRouter()
  const canEdit    = EDIT_ROLES.includes(userRole)
  const canApprove = APPROVE_ROLES.includes(userRole)

  const subjects = useMemo(() => {
    const fromPlans = plans.map(p => p.subject)
    return Array.from(new Set([...fromPlans, ...ALL_SUBJECTS])).sort()
  }, [plans])

  const [activeSubject,    setActiveSubject]    = useState<string>(subjects[0] ?? ALL_SUBJECTS[0])
  const [expandedId,       setExpandedId]       = useState<string | null>(null)
  const [modal,            setModal]            = useState<ModalState>(DEFAULT_MODAL)
  const [saving,           setSaving]           = useState(false)
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null)
  const [helpDismissed,    setHelpDismissed]    = useState(false)

  const planIndex = useMemo(() => {
    const idx: Record<string, Record<number, YearGroupPlanData>> = {}
    for (const p of plans) {
      if (!idx[p.subject]) idx[p.subject] = {}
      idx[p.subject][p.yearGroup] = p
    }
    return idx
  }, [plans])

  function openCreate(subject: string, yearGroup: number) {
    const existing = planIndex[subject]?.[yearGroup]
    if (existing) {
      setModal({ open: true, plan: existing, yearGroup, subject, content: existing.planContent, fileUrl: existing.uploadedFileUrl ?? '', submitAfterSave: false })
    } else {
      setModal({ open: true, plan: undefined, yearGroup, subject, content: '', fileUrl: '', submitAfterSave: false })
    }
  }

  async function handleSave() {
    if (!modal.subject.trim() || !modal.content.trim()) {
      toast('Subject and plan content are required', 'error')
      return
    }
    setSaving(true)
    try {
      await upsertYearGroupPlan({
        id:              modal.plan?.id,
        yearGroup:       modal.yearGroup,
        subject:         modal.subject.trim(),
        planContent:     modal.content.trim(),
        uploadedFileUrl: modal.fileUrl.trim() || null,
      })
      if (modal.submitAfterSave) {
        toast('Plan saved and submitted for approval')
      } else {
        toast('Plan saved as draft')
      }
      setModal(DEFAULT_MODAL)
      router.refresh()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to save plan', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(id: string) {
    try {
      await submitForApproval(id)
      toast('Plan submitted for approval')
      router.refresh()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to submit', 'error')
    }
  }

  async function handleApprove(id: string) {
    try {
      await approvePlan(id)
      toast('Plan approved', 'success')
      router.refresh()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to approve', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePlan(id)
      toast('Plan deleted')
      setConfirmDeleteId(null)
      router.refresh()
    } catch (err: any) {
      toast(err?.message ?? 'Failed to delete', 'error')
    }
  }

  const subjectsWithPlans    = subjects.filter(s =>  planIndex[s] && Object.keys(planIndex[s]).length > 0)
  const subjectsWithoutPlans = subjects.filter(s => !planIndex[s] || Object.keys(planIndex[s]).length === 0)
  const orderedSubjects      = [...subjectsWithPlans, ...subjectsWithoutPlans]

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Year Group Plans</h1>
            <p className="text-sm text-gray-500 mt-0.5">Scheme of Work — curriculum plans by subject and year group</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setModal({ ...DEFAULT_MODAL, open: true, subject: activeSubject })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
            >
              <Icon name="add" size="sm" />
              New Plan
            </button>
          )}
        </div>
      </div>

      {/* Help banner */}
      {!helpDismissed && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Icon name="info" size="sm" className="text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-blue-800">
                <strong>Year Group Plans</strong> are your scheme of work for each subject and year.
                Once approved by a Head of Department, they automatically feed into AI homework and
                revision generation — ensuring content aligns with your curriculum.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Click <strong>+ Create Plan</strong> on any row to add a scheme of work. Teachers create drafts; HODs approve them.
              </p>
            </div>
            <button
              onClick={() => setHelpDismissed(true)}
              className="text-blue-400 hover:text-blue-600 shrink-0"
              title="Dismiss"
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">

        {/* Subject sidebar */}
        <div className="w-52 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subjects</span>
            </div>
            <nav className="py-1 max-h-[70vh] overflow-y-auto">
              {orderedSubjects.map(subject => {
                const hasPlan = !!(planIndex[subject] && Object.keys(planIndex[subject]).length > 0)
                const active  = activeSubject === subject
                return (
                  <button
                    key={subject}
                    onClick={() => setActiveSubject(subject)}
                    className={`w-full text-left flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{subject}</span>
                    {hasPlan && <span className="shrink-0 ml-1 w-2 h-2 rounded-full bg-blue-400" />}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Main table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Icon name="menu_book" size="md" className="text-blue-600" />
                {activeSubject}
              </h2>
              {canEdit && (
                <button
                  onClick={() => setModal({ ...DEFAULT_MODAL, open: true, subject: activeSubject })}
                  className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 font-medium"
                >
                  <Icon name="add" size="sm" />
                  Add plan
                </button>
              )}
            </div>

            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 w-24">Year</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-36">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Created by</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-36">Last updated</th>
                  <th className="px-4 py-3 w-56" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {YEAR_GROUPS.map(yg => {
                  const plan   = planIndex[activeSubject]?.[yg]
                  const isOpen = plan && expandedId === plan.id
                  return [
                    <tr
                      key={yg}
                      className={`hover:bg-gray-50 transition-colors ${plan ? 'cursor-pointer' : ''}`}
                      onClick={() => plan && setExpandedId(isOpen ? null : plan.id)}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-sm text-gray-900">Year {yg}</span>
                      </td>

                      <td className="px-4 py-3.5">
                        {plan
                          ? <StatusBadge status={plan.status} />
                          : canEdit
                            ? (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); openCreate(activeSubject, yg) }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                              >
                                <Icon name="add" size="sm" />
                                + Create Plan
                              </button>
                            )
                            : <span className="text-xs text-gray-400 italic">No plan</span>
                        }
                      </td>

                      <td className="px-4 py-3.5 text-sm text-gray-600">
                        {plan ? plan.createdByName : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500">
                        {plan
                          ? new Date(plan.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'
                        }
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                          {/* View button — always visible when plan exists */}
                          {plan && (
                            <button
                              title="View full plan"
                              onClick={e => { e.stopPropagation(); setExpandedId(isOpen ? null : plan.id) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-700 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Icon name={isOpen ? 'visibility_off' : 'visibility'} size="sm" />
                              {isOpen ? 'Hide' : 'View'}
                            </button>
                          )}

                          {/* Edit button */}
                          {plan && canEdit && (
                            <button
                              title="Edit plan"
                              onClick={() => openCreate(activeSubject, yg)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-700 bg-gray-100 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Icon name="edit" size="sm" />
                              Edit
                            </button>
                          )}

                          {/* Submit for approval */}
                          {plan && canEdit && plan.status === 'DRAFT' && (
                            <button
                              onClick={() => handleSubmit(plan.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                            >
                              <Icon name="send" size="sm" />
                              Submit
                            </button>
                          )}

                          {/* Approve */}
                          {plan && canApprove && plan.status === 'SUBMITTED' && (
                            <button
                              onClick={() => handleApprove(plan.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                            >
                              <Icon name="check_circle" size="sm" />
                              Approve
                            </button>
                          )}

                          {/* Delete */}
                          {plan && canEdit && (
                            <button
                              onClick={() => setConfirmDeleteId(plan.id)}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete plan"
                            >
                              <Icon name="delete" size="sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,

                    /* Expanded content row */
                    isOpen && plan ? (
                      <tr key={`${yg}-expanded`} className="bg-blue-50/40">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            {plan.approvedByName && (
                              <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                                <Icon name="verified" size="sm" />
                                Approved by {plan.approvedByName}
                              </span>
                            )}
                            {plan.uploadedFileUrl && (
                              <a
                                href={plan.uploadedFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                                onClick={e => e.stopPropagation()}
                              >
                                <Icon name="attach_file" size="sm" />
                                View attached file
                              </a>
                            )}
                          </div>
                          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto leading-relaxed">
                            {plan.planContent}
                          </pre>
                        </td>
                      </tr>
                    ) : null,
                  ]
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">
                  {modal.plan ? 'Edit Plan' : 'Create Plan'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {modal.subject} · Year {modal.yearGroup}
                </p>
              </div>
              <button
                onClick={() => setModal(DEFAULT_MODAL)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                  <input
                    list="subject-options"
                    value={modal.subject}
                    onChange={e => setModal(m => ({ ...m, subject: e.target.value }))}
                    placeholder="e.g. English, Mathematics"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="subject-options">
                    {ALL_SUBJECTS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Year Group</label>
                  <select
                    value={modal.yearGroup}
                    onChange={e => setModal(m => ({ ...m, yearGroup: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {YEAR_GROUPS.map(yg => <option key={yg} value={yg}>Year {yg}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Plan Content
                  <span className="text-gray-400 font-normal ml-1">(describe your scheme of work — topics, terms, key texts)</span>
                </label>
                <textarea
                  value={modal.content}
                  onChange={e => setModal(m => ({ ...m, content: e.target.value }))}
                  rows={14}
                  placeholder={`Example for English Year 9:\n\nTerm 1 — An Inspector Calls\n- Characters: Birling family, Inspector Goole\n- Themes: responsibility, class, gender\n- Assessment: character analysis essay\n\nTerm 2 — Poetry Anthology\n- AQA Power and Conflict cluster\n- Comparative essay technique\n\nTerm 3 — Language Paper 1 & 2\n- Fiction reading / descriptive writing\n- Non-fiction reading / persuasive writing`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  File URL
                  <span className="text-gray-400 font-normal ml-1">(optional — link to PDF or Google Doc)</span>
                </label>
                <input
                  type="url"
                  value={modal.fileUrl}
                  onChange={e => setModal(m => ({ ...m, fileUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={modal.submitAfterSave}
                  onChange={e => setModal(m => ({ ...m, submitAfterSave: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Submit for HOD approval after saving</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                {modal.plan ? 'Changes save over the existing draft.' : 'Saved as Draft — submit when ready for HOD approval.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModal(DEFAULT_MODAL)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? <><Icon name="refresh" size="sm" className="animate-spin" />Saving…</>
                    : modal.submitAfterSave
                      ? <><Icon name="send" size="sm" />Save & Submit</>
                      : <><Icon name="save" size="sm" />Save as Draft</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Icon name="delete" size="md" className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Delete plan?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-5">This will permanently delete the scheme of work. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
