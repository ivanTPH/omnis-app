'use client'

import { useRouter } from 'next/navigation'
import type { StaffTeacher } from '@/app/actions/analytics-staff'

export default function TeacherSelector({
  teachers,
  selectedId,
}: {
  teachers: StaffTeacher[]
  selectedId?: string
}) {
  const router = useRouter()

  return (
    <select
      className="w-full sm:w-80 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      value={selectedId ?? ''}
      onChange={e => {
        if (e.target.value) router.push(`/analytics/teacher?teacherId=${e.target.value}`)
      }}
    >
      <option value="">— Select a teacher —</option>
      {teachers.map(t => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.department} · {t.classCount} class{t.classCount !== 1 ? 'es' : ''})
        </option>
      ))}
    </select>
  )
}
