'use client'
import { useState } from 'react'
import ClassRosterTab from '@/components/ClassRosterTab'
import StudentSearch from '@/components/StudentSearch'

type ClassOption = { id: string; name: string; subject: string; yearGroup: number }

export default function MyClassesView({ classes, role }: { classes: ClassOption[]; role: string }) {
  const [selectedId, setSelectedId] = useState<string>(classes[0]?.id ?? '')

  if (classes.length === 0) {
    return (
      <>
        <StudentSearch role={role} />
        <p className="text-[13px] text-gray-400 text-center py-16">
          No classes assigned to your account yet.
        </p>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <StudentSearch role={role} />
      {/* Class filter pills */}
      <div className="flex flex-wrap gap-2">
        {classes.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
              selectedId === c.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.name}
            <span className={`ml-1.5 text-[10px] ${selectedId === c.id ? 'text-blue-200' : 'text-gray-400'}`}>
              Yr {c.yearGroup}
            </span>
          </button>
        ))}
      </div>

      {/* Roster for selected class */}
      {selectedId && (
        <ClassRosterTab key={selectedId} classId={selectedId} />
      )}
    </div>
  )
}
