'use client'
import Icon from '@/components/ui/Icon'
import { toCSV, downloadCSV } from '@/lib/csv'

type Student = {
  firstName: string; lastName: string
  yearGroup: number | null; tutorGroup: string | null
  attendancePercentage: number | null
  sendStatus: { activeStatus: string } | null
}

export default function AttendanceExportButton({ students }: { students: Student[] }) {
  return (
    <button
      onClick={() => {
        const csv = toCSV(
          ['First Name', 'Last Name', 'Year', 'Form', 'SEND', 'Attendance %'],
          students.map(s => [
            s.firstName, s.lastName,
            s.yearGroup ?? '', s.tutorGroup ?? '',
            s.sendStatus?.activeStatus !== 'NONE' ? (s.sendStatus?.activeStatus ?? '') : '',
            s.attendancePercentage != null ? s.attendancePercentage.toFixed(1) : '',
          ]),
        )
        downloadCSV(`attendance-${new Date().toISOString().slice(0, 10)}.csv`, csv)
      }}
      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition"
    >
      <Icon name="download" size="sm" />
      Export CSV
    </button>
  )
}
