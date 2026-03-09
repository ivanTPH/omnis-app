import type { TimetableRow } from '@/app/actions/admin'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const SUBJECT_CELL_COLOURS: Record<string, string> = {
  English:   'bg-blue-50 border-blue-100 text-blue-900',
  Maths:     'bg-green-50 border-green-100 text-green-900',
  Science:   'bg-teal-50 border-teal-100 text-teal-900',
  History:   'bg-amber-50 border-amber-100 text-amber-900',
  Geography: 'bg-emerald-50 border-emerald-100 text-emerald-900',
  PE:        'bg-orange-50 border-orange-100 text-orange-900',
  French:    'bg-sky-50 border-sky-100 text-sky-900',
  Spanish:   'bg-cyan-50 border-cyan-100 text-cyan-900',
}

function cellColour(subject: string | null) {
  return SUBJECT_CELL_COLOURS[subject ?? ''] ?? 'bg-gray-50 border-gray-100 text-gray-800'
}

type Period = { name: string; startTime: string; endTime: string }

export default function AdminTimetableGrid({ entries }: { entries: TimetableRow[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-400">
        <p className="text-[14px] font-medium">No timetable data</p>
        <p className="text-[12px] mt-1">Run the Wonde sync to import timetable entries</p>
      </div>
    )
  }

  // Collect unique periods, sorted by startTime
  const periodMap = new Map<string, Period>()
  for (const e of entries) {
    if (!periodMap.has(e.periodName)) {
      periodMap.set(e.periodName, {
        name:      e.periodName,
        startTime: e.startTime,
        endTime:   e.endTime,
      })
    }
  }
  const periods = [...periodMap.values()].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  )

  // Build lookup: `${dayOfWeek}-${periodName}` → entry[]
  const grid = new Map<string, TimetableRow[]>()
  for (const e of entries) {
    const key = `${e.dayOfWeek}-${e.periodName}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(e)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-3 text-left font-semibold text-gray-500 border-b border-r border-gray-200 w-24 whitespace-nowrap">
                Period
              </th>
              {DAYS.map(day => (
                <th
                  key={day}
                  className="px-3 py-3 text-center font-semibold text-gray-700 border-b border-r border-gray-100 last:border-r-0 min-w-[140px]"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period, pi) => (
              <tr key={period.name} className={pi % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                <td className="px-3 py-2 border-r border-gray-200 align-top shrink-0">
                  <p className="font-bold text-gray-800 whitespace-nowrap">{period.name}</p>
                  <p className="text-[10px] text-gray-400 whitespace-nowrap">
                    {period.startTime}–{period.endTime}
                  </p>
                </td>
                {DAYS.map((_, dayIdx) => {
                  const dayNum     = dayIdx + 1
                  const dayEntries = grid.get(`${dayNum}-${period.name}`) ?? []
                  return (
                    <td
                      key={dayIdx}
                      className="px-2 py-1.5 border-r border-gray-100 last:border-r-0 align-top"
                    >
                      <div className="space-y-1">
                        {dayEntries.map(e => (
                          <div
                            key={e.id}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] ${cellColour(e.subject)}`}
                          >
                            <p className="font-semibold leading-tight">{e.className}</p>
                            <p className="text-[10px] opacity-60 mt-0.5">{e.teacher}</p>
                            {e.room && (
                              <p className="text-[10px] opacity-50">{e.room}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
