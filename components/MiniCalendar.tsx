'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['M','T','W','T','F','S','S']

export default function MiniCalendar() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const prev = () => month === 0  ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1)
  const next = () => month === 11 ? (setMonth(0),  setYear(y => y + 1)) : setMonth(m => m + 1)

  // Week starts Monday: Mon=0 … Sun=6
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (d: number | null) =>
    d !== null &&
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  // col index 5 = Saturday, 6 = Sunday
  const isWeekend = (i: number) => i % 7 >= 5

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prev}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={15} className="text-gray-400" />
        </button>

        <div className="text-center">
          <span className="text-sm font-semibold text-gray-900 tracking-tight">
            {MONTHS[month]}
          </span>
          <span className="text-sm text-gray-400 ml-1.5">{year}</span>
        </div>

        <button
          onClick={next}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={15} className="text-gray-400" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div
            key={i}
            className={`text-center text-[11px] font-medium py-1 ${
              i >= 5 ? 'text-gray-300' : 'text-gray-400'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const today_ = isToday(day)
          const weekend = isWeekend(i)
          return (
            <div key={i} className="flex items-center justify-center py-0.5">
              <div
                className={`
                  w-8 h-8 flex items-center justify-center rounded-full text-[13px]
                  ${today_
                    ? 'bg-red-500 text-white font-semibold'
                    : day
                    ? weekend
                      ? 'text-gray-400 hover:bg-gray-50 cursor-default'
                      : 'text-gray-800 hover:bg-gray-100 cursor-default'
                    : ''
                  }
                `}
              >
                {day ?? ''}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
