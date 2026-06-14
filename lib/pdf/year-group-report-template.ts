import { pdfShell, escHtml } from './templates'

export type YearGroupReportClass = {
  name:         string
  subject:      string
  studentCount: number
  submitted:    number
  total:        number       // total homework submissions expected
  avgGrade:     number | null // 0–9 scale
}

export type YearGroupReportData = {
  yearGroup:   number
  schoolName:  string
  generatedAt: string
  teacherName: string
  studentCount:number
  sendCount:   number
  ehcpCount:   number
  avgAttendance: number | null  // 0–100
  lowAttendance: number         // below 90%
  openConcerns:  number
  classes:     YearGroupReportClass[]
}

function ragBar(pct: number | null): string {
  if (pct == null) return '<span style="color:#9ca3af;">—</span>'
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
  return `<div style="display:flex;align-items:center;gap:5pt;">
    <div style="flex:1;background:#e5e7eb;border-radius:3pt;height:5pt;overflow:hidden;min-width:40pt;">
      <div style="width:${Math.min(pct,100)}%;height:100%;background:${color};"></div>
    </div>
    <span style="font-size:8pt;color:${color};font-weight:600;min-width:24pt;">${pct}%</span>
  </div>`
}

function gradeChip(score: number | null): string {
  if (score == null) return '<span style="color:#9ca3af;">—</span>'
  const g = Math.min(9, Math.max(1, Math.round(score)))
  const bg    = g >= 7 ? '#f0fdf4' : g >= 5 ? '#eff6ff' : g >= 4 ? '#fffbeb' : '#fef2f2'
  const color = g >= 7 ? '#15803d' : g >= 5 ? '#1d4ed8' : g >= 4 ? '#b45309' : '#b91c1c'
  const letters = ['','F','E','D','C','C+','B','A','A*','A**'] as const
  return `<span style="background:${bg};color:${color};padding:1pt 5pt;border-radius:3pt;font-size:9pt;font-weight:700;">${g} (${letters[g]})</span>`
}

export function yearGroupReportPdf(data: YearGroupReportData): string {
  const attendColor = data.avgAttendance == null ? '#6b7280'
    : data.avgAttendance >= 95 ? '#15803d'
    : data.avgAttendance >= 90 ? '#d97706' : '#b91c1c'

  // ── Summary strip ─────────────────────────────────────────────────────────────
  const summaryStrip = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card card-blue">
        <div style="font-size:20pt;font-weight:800;color:#2563eb;">${data.studentCount}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">Students</div>
      </div>
      <div class="card">
        <div style="font-size:20pt;font-weight:800;color:#6b21a8;">${data.sendCount}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">SEND Register</div>
      </div>
      <div class="card">
        <div style="font-size:20pt;font-weight:800;color:#9333ea;">${data.ehcpCount}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">EHCPs</div>
      </div>
      <div class="card ${data.avgAttendance != null && data.avgAttendance < 90 ? 'card-red' : 'card-green'}">
        <div style="font-size:20pt;font-weight:800;color:${attendColor};">${data.avgAttendance != null ? data.avgAttendance + '%' : '—'}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">Avg Attendance</div>
      </div>
      <div class="card ${data.openConcerns > 0 ? 'card-amber' : ''}">
        <div style="font-size:20pt;font-weight:800;color:${data.openConcerns > 0 ? '#b45309' : '#6b7280'};">${data.openConcerns}</div>
        <div style="font-size:8pt;color:#6b7280;margin-top:2pt;">Open Concerns</div>
      </div>
    </div>`

  // ── SEND highlight row ─────────────────────────────────────────────────────────
  const sendHighlight = data.sendCount > 0 ? `
    <div class="card card-amber" style="margin-bottom:14pt;">
      <div style="display:flex;gap:24pt;align-items:center;">
        <div><span style="font-size:18pt;font-weight:800;color:#b45309;">${data.sendCount}</span>
          <span style="font-size:9pt;color:#92400e;margin-left:4pt;">on SEND register</span></div>
        <div><span style="font-size:18pt;font-weight:800;color:#9333ea;">${data.ehcpCount}</span>
          <span style="font-size:9pt;color:#6b21a8;margin-left:4pt;">with EHCP</span></div>
        <div><span style="font-size:18pt;font-weight:800;color:#dc2626;">${data.lowAttendance}</span>
          <span style="font-size:9pt;color:#991b1b;margin-left:4pt;">below 90% attendance</span></div>
      </div>
    </div>` : ''

  // ── Classes table ─────────────────────────────────────────────────────────────
  const classRows = data.classes.map(c => {
    const pct = c.total > 0 ? Math.round(c.submitted / c.total * 100) : null
    return `<tr>
      <td style="font-weight:600;">${escHtml(c.name)}</td>
      <td style="font-size:9pt;color:#6b7280;">${escHtml(c.subject)}</td>
      <td style="text-align:center;">${c.studentCount}</td>
      <td>${ragBar(pct)}</td>
      <td style="text-align:center;">${gradeChip(c.avgGrade)}</td>
    </tr>`
  }).join('')

  const classSection = `
    <h2>Class Performance</h2>
    <table>
      <thead><tr>
        <th>Class</th><th>Subject</th><th style="text-align:center;">Students</th><th>HW Completion</th><th style="text-align:center;">Avg Grade</th>
      </tr></thead>
      <tbody>${classRows || '<tr><td colspan="5" style="color:#9ca3af;text-align:center;">No classes in this year group</td></tr>'}</tbody>
    </table>`

  const body = `
    <h1>Year ${data.yearGroup} — Pastoral Report</h1>
    <p class="meta">
      Head of Year: ${escHtml(data.teacherName)}
      · Generated ${escHtml(data.generatedAt)}
      · ${escHtml(data.schoolName)}
    </p>
    <div class="spacer"></div>
    ${summaryStrip}
    ${sendHighlight}
    ${classSection}
  `

  return pdfShell(body, `Year ${data.yearGroup} Pastoral Report`, data.schoolName)
}
