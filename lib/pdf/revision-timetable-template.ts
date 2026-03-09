import { pdfShell, escHtml } from './templates'

export type RevisionSessionPdf = {
  subject:     string
  topic:       string
  scheduledAt: Date
  durationMins:number
  status:      string
}

export type RevisionExamPdf = {
  subject:  string
  examDate: Date
  paperName?: string | null
  examBoard?: string | null
}

const SUBJECT_COLOURS: Record<string, string> = {
  English:   '#7c3aed', Maths: '#2563eb', Science:   '#16a34a',
  Biology:   '#059669', Chemistry: '#b45309', Physics: '#0891b2',
  History:   '#c2410c', Geography: '#0d9488', French:  '#4f46e5',
  Spanish:   '#db2777', German:    '#e11d48', Computing:'#0284c7',
  RE:        '#65a30d', PE:        '#dc2626',
}

function subjectColour(subject: string): string {
  return SUBJECT_COLOURS[subject] ?? '#374151'
}

function daysUntil(date: Date): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86400000)
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function revisionTimetablePdf(
  sessions:   RevisionSessionPdf[],
  exams:      RevisionExamPdf[],
  studentName: string,
  schoolName: string,
  weekStart?: Date,
): string {
  const monday = weekStart ? getMonday(weekStart) : getMonday(new Date())
  const days   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const weekLabel = `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  function sessionsOnDay(day: Date) {
    return sessions.filter(s => {
      const sd = new Date(s.scheduledAt)
      return sd.getFullYear() === day.getFullYear()
        && sd.getMonth() === day.getMonth()
        && sd.getDate() === day.getDate()
    }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }

  const dayColumns = days.map((day, i) => {
    const daySessions = sessionsOnDay(day)
    const cellBg = i >= 5 ? '#f9fafb' : '#ffffff'

    const sessionCells = daySessions.length > 0
      ? daySessions.map(s => {
          const colour = subjectColour(s.subject)
          const time   = new Date(s.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          const statusIcon = s.status === 'completed' ? '✓' : s.status === 'skipped' ? '↷' : ''
          return `
            <div style="border-left:3pt solid ${colour};background:#f8fafc;border-radius:3pt;padding:4pt 6pt;margin-bottom:4pt;font-size:8pt;">
              <strong style="color:${colour};">${escHtml(s.subject)}</strong>
              ${statusIcon ? `<span style="float:right;color:${s.status === 'completed' ? '#16a34a' : '#9ca3af'};">${statusIcon}</span>` : ''}
              <div>${escHtml(s.topic)}</div>
              <div style="color:#6b7280;">${time} · ${s.durationMins}m</div>
            </div>`
        }).join('')
      : '<div style="color:#d1d5db;font-size:8pt;text-align:center;padding-top:8pt;">—</div>'

    return `
      <td style="vertical-align:top;padding:6pt;background:${cellBg};border:0.5pt solid #e5e7eb;width:${100/7}%;">
        <div style="font-weight:700;font-size:9pt;text-align:center;margin-bottom:4pt;color:#374151;">
          ${DAY_NAMES[i].slice(0,3)}<br/>
          <span style="font-weight:400;font-size:8pt;color:#6b7280;">${day.getDate()}</span>
        </div>
        ${sessionCells}
      </td>`
  }).join('')

  const examRows = exams
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime())
    .map(e => {
      const days = daysUntil(e.examDate)
      const colour = days < 14 ? '#dc2626' : days < 28 ? '#d97706' : '#16a34a'
      return `
        <tr>
          <td><strong>${escHtml(e.subject)}</strong></td>
          <td>${escHtml(e.paperName ?? '—')}</td>
          <td>${escHtml(e.examBoard ?? '—')}</td>
          <td>${new Date(e.examDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
          <td style="color:${colour};font-weight:600;">${days < 0 ? 'Past' : `${days} days`}</td>
        </tr>`
    }).join('')

  const summary = sessions.reduce((acc, s) => {
    acc.total++
    if (s.status === 'completed') acc.completed++
    if (s.status === 'skipped')   acc.skipped++
    return acc
  }, { total: 0, completed: 0, skipped: 0 })

  const content = `
    <h1>Revision Timetable</h1>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12pt;">
      <div>
        <p class="meta">Student: <strong>${escHtml(studentName)}</strong></p>
        <p class="meta">Week: ${escHtml(weekLabel)}</p>
      </div>
      <div style="display:flex;gap:12pt;">
        <div class="card" style="text-align:center;padding:6pt 12pt;margin:0;">
          <div style="font-size:16pt;font-weight:700;color:#2563eb;">${summary.total}</div>
          <div class="text-sm text-muted">Sessions</div>
        </div>
        <div class="card" style="text-align:center;padding:6pt 12pt;margin:0;">
          <div style="font-size:16pt;font-weight:700;color:#16a34a;">${summary.completed}</div>
          <div class="text-sm text-muted">Completed</div>
        </div>
      </div>
    </div>

    <table style="table-layout:fixed;">
      <tbody>
        <tr>${dayColumns}</tr>
      </tbody>
    </table>

    ${exams.length > 0 ? `
    <h2>Exam Countdown</h2>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Paper</th>
          <th>Board</th>
          <th>Date</th>
          <th>Days Until</th>
        </tr>
      </thead>
      <tbody>${examRows}</tbody>
    </table>` : ''}

    <div style="margin-top:12pt;padding:8pt;background:#eff6ff;border-radius:4pt;font-size:9pt;color:#1d4ed8;">
      <strong>Key:</strong>
      ✓ = Completed &nbsp;·&nbsp; ↷ = Skipped &nbsp;·&nbsp; Coloured border = subject colour
    </div>`

  return pdfShell(
    content,
    `Revision Timetable — ${weekLabel}`,
    schoolName,
    `body { font-size: 10pt; }`,
  )
}
