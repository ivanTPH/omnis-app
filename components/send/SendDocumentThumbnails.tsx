'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import dynamic from 'next/dynamic'
import { getStudentSendDocuments, type StudentSendDocuments } from '@/app/actions/send-support'

const SendDocumentSlideOver = dynamic(() => import('./SendDocumentSlideOver'), { ssr: false })

type DocType = 'kPlan' | 'ilp' | 'ehcp'

type Props = {
  studentId:   string
  studentName: string
  userRole:    string
}

type DocConfig = {
  type:    DocType
  label:   string
  icon:    React.ReactNode
  bg:      string
  border:  string
  iconBg:  string
  iconCls: string
}

const DOC_CONFIGS: DocConfig[] = [
  {
    type:    'kPlan',
    label:   'K Plan',
    icon:    <Icon name="menu_book" size="md" />,
    bg:      'bg-amber-50 hover:bg-amber-100',
    border:  'border-amber-200',
    iconBg:  'bg-amber-100',
    iconCls: 'text-amber-600',
  },
  {
    type:    'ilp',
    label:   'ILP',
    icon:    <Icon name="favorite_border" size="md" />,
    bg:      'bg-blue-50 hover:bg-blue-100',
    border:  'border-blue-200',
    iconBg:  'bg-blue-100',
    iconCls: 'text-blue-600',
  },
  {
    type:    'ehcp',
    label:   'EHCP',
    icon:    <Icon name="verified_user" size="md" />,
    bg:      'bg-purple-50 hover:bg-purple-100',
    border:  'border-purple-200',
    iconBg:  'bg-purple-100',
    iconCls: 'text-purple-600',
  },
]

function statusPill(status: string) {
  if (status === 'APPROVED' || status === 'active') {
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">Approved</span>
  }
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Draft</span>
}

export default function SendDocumentThumbnails({ studentId, studentName, userRole }: Props) {
  const [docs,    setDocs]    = useState<StudentSendDocuments | null>(null)
  const [loading, setLoading] = useState(true)
  const [active,  setActive]  = useState<DocType | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await getStudentSendDocuments(studentId)
        if (!cancelled) setDocs(result)
      } catch {
        if (!cancelled) setDocs(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [studentId])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Icon name="refresh" size="sm" className="animate-spin" /> Loading documents…
      </div>
    )
  }

  if (!docs) return null

  // Only render cards for documents that exist
  const available = DOC_CONFIGS.filter(cfg => docs[cfg.type] !== null)
  if (available.length === 0) return null

  const activeDoc = active ? docs[active] : null

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {available.map(cfg => {
          const doc = docs[cfg.type]!
          const updatedAt = 'updatedAt' in doc ? doc.updatedAt : null
          return (
            <button
              key={cfg.type}
              onClick={() => setActive(cfg.type)}
              className={`flex-shrink-0 w-40 h-20 flex flex-col justify-between p-3 rounded-xl border transition-colors ${cfg.bg} ${cfg.border}`}
            >
              <div className="flex items-center justify-between">
                <span className={`p-1 rounded-lg ${cfg.iconBg} ${cfg.iconCls}`}>{cfg.icon}</span>
                {'status' in doc && statusPill(doc.status)}
              </div>
              <div className="text-left">
                <p className={`text-[11px] font-bold ${cfg.iconCls}`}>{cfg.label}</p>
                {updatedAt && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Updated {new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {active && activeDoc && (
        <SendDocumentSlideOver
          docType={active}
          doc={activeDoc}
          studentName={studentName}
          studentId={studentId}
          userRole={userRole}
          onClose={() => setActive(null)}
        />
      )}
    </>
  )
}
