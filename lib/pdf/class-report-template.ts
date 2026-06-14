import { pdfShell, escHtml } from './templates'
import { GCSE_LETTERS } from '@/lib/grading'

export type ClassReportStudent = {
  firstName:    string
  lastName:     string
  sendStatus:   'NONE' | 'SEN_SUPPORT' | 'EHCP'
  avgScore:     number | null   // 0–9 scale
  submitted:    number
  total:        number
}

export type ClassReportHomework = {
  title:       string
  dueAt:       string
  type:        string
  submitted:   number
  enrolled:    number
  avgGrade:    number | null   // 0–9 scale
}

export type ClassReportData = {
  className:   string
  subject:     string
  yearGroup:   number
  teachers:    string[]
  examBoard:   string | null
  schoolName:  string
  generatedAt: string
  students:    ClassReportStudent[]
  homework:    ClassReportHomework[]
  overallAvg:  number | null   // from ClassPerformanceAggregate
}

function gradeChip(score: number | null): string {
  if (score == null) return '<span style="color:#9ca3af;">—</span>'
  const g = Math.min(9, Math.max(1, Math.round(score))) as keyof typeof GCSE_LETTERS
  const bg    = g >= 7 ? '#f0fdf4' : g >= 5 ? '#eff6ff' : g >= 4 ? '#fffbeb' : '#fef2f2'
  const color = g >= 7 ? '#15803d' : g >= 5 ? '#1d4ed8' : g >= 4 ? '#b45309' : '#b91c1c'
  return `<span style="background:${bg};color:${color};padding:1pt 5pt;border-radius:3pt;font-size:9pt;font-weight:700;">${g} (${GCSE_LETTERS[g]})</span>`
}

function sendBadge(status: string): string {
  if (status === 'EHCP')        return '<span style="background:#f3e8ff;color:#6b21a8;padding:1pt 4pt;border-radius:3pt;font-size:8pt;font-weight:700;">EHCP</span>'
  if (status === 'SEN_SUPPORT') return '<span style="background:#dbeafe;color:#1d4ed8;padding:1pt 4pt;border-radius:3pt;font-size:8pt;font-weight:700;">SEN</span>'
  return ''
}

function pctBar(pct: number): string {
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
  return `<div style="display:flex;align-items:center;gap:5pt;">
    <div style="flex:1;background:#e5e7eb;border-radius:3pt;height:5pt;overflow:hidden;min-width:40pt;">
      <div style="width:${Math.min(pct,100)}%;height:100%;background:${color};"></div>
    </div>
    <span style="font-size:8pt;color:${color};font-weight:600;min-width:24pt;">${pct}%</span>
  </div>`
}

export function classReportPdf(data: ClassReportData): string {
  const completionPct = data.homework.length > 0
    ? Math.round(
        data.homework.reduce((s, h) => s + (h.enrolled > 0 ? h.submitted / h.enrolled : 0), 0)
        / data.homework.length * 100
      )
    : null

  const sendCount = data.students.filter(s => s.sendStatus !== 'NONE').length

  // ── Summary strip ──────────────────────────────────────────────────────────
  const summaryStrip = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card card-blue">
        <div style="font-size:20pt;font-weight:800;color:#2563eb;">${data.students.length}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">Students</div>
      </div>
      <div class="card">
        <div style="font-size:20pt;font-weight:800;color:#6b21a8;">${sendCount}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">SEND</div>
      </div>
      <div class="card card-green">
        <div style="font-size:20pt;font-weight:800;color:#16a34a;">${gradeChip(data.overallAvg)}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">Class Average</div>
      </div>
      <div class="card card-amber">
        <div style="font-size:20pt;font-weight:800;color:#d97706;">${completionPct != null ? completionPct + '%' : '—'}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">Avg Completion</div>
      </div>
    </div>`

  // ── Student table ──────────────────────────────────────────────────────────
  const sortedStudents = [...data.students].sort((a, b) => a.lastName.localeCompare(b.lastName))
  const studentRows = sortedStudents.map(s => {
    const completionPct = s.total > 0 ? Math.round(s.submitted / s.total * 100) : null
    return `<tr>
      <td>${escHtml(s.lastName)}, ${escHtml(s.firstName)} ${sendBadge(s.sendStatus)}</td>
      <td style="text-align:center;">${gradeChip(s.avgScore)}</td>
      <td>${completionPct != null ? pctBar(completionPct) : '—'}</td>
      <td style="text-align:center;font-size:9pt;color:#6b7280;">${s.submitted}/${s.total}</td>
    </tr>`
  }).join('')

  const studentSection = `
    <h2>Student Performance</h2>
    <table>
      <thead><tr>
        <th>Student</th>
        <th style="text-align:center;">Avg Grade</th>
        <th>Completion</th>
        <th style="text-align:center;">Submitted</th>
      </tr></thead>
      <tbody>${studentRows || '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">No students enrolled</td></tr>'}</tbody>
    </table>`

  // ── Homework summary ───────────────────────────────────────────────────────
  const hwRows = data.homework.map(h => {
    const pct = h.enrolled > 0 ? Math.round(h.submitted / h.enrolled * 100) : 0
    return `<tr>
      <td>${escHtml(h.title)}</td>
      <td style="font-size:9pt;color:#6b7280;">${h.type.replace(/_/g,' ').toLowerCase()}</td>
      <td style="font-size:9pt;color:#6b7280;">${new Date(h.dueAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
      <td>${pctBar(pct)}</td>
      <td style="text-align:center;">${gradeChip(h.avgGrade)}</td>
    </tr>`
  }).join('')

  const hwSection = `
    <h2>Homework Summary (Last 10)</h2>
    <table>
      <thead><tr>
        <th>Title</th><th>Type</th><th>Due</th><th>Completion</th><th style="text-align:center;">Avg Grade</th>
      </tr></thead>
      <tbody>${hwRows || '<tr><td colspan="5" style="color:#9ca3af;text-align:center;">No homework set</td></tr>'}</tbody>
    </table>`

  const body = `
    <h1>${escHtml(data.className)} — Class Report</h1>
    <p class="meta">
      ${escHtml(data.subject)} · Year ${data.yearGroup}
      ${data.examBoard ? ` · ${escHtml(data.examBoard)}` : ''}
      · ${data.teachers.map(escHtml).join(', ')}
    </p>
    <p class="meta">Generated ${escHtml(data.generatedAt)} · ${escHtml(data.schoolName)}</p>
    <div class="spacer"></div>
    ${summaryStrip}
    ${studentSection}
    ${hwSection}
  `

  return pdfShell(body, `${data.className} Class Report`, data.schoolName)
}
