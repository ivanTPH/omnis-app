'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import RaiseConcernModal from './RaiseConcernModal'

type Props = {
  studentId: string
  studentName: string
  variant?: 'icon' | 'button'
}

export default function RaiseConcernButton({ studentId, studentName, variant = 'button' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          title={`Raise concern about ${studentName}`}
          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
        >
          <Icon name="warning" size="sm" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-medium"
        >
          <Icon name="warning" size="sm" />
          Raise Concern
        </button>
      )}
      {open && (
        <RaiseConcernModal
          studentId={studentId}
          studentName={studentName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
