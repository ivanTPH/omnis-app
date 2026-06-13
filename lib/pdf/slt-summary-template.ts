import { pdfShell, escHtml } from './templates'
import { GCSE_LETTERS } from '@/lib/grading'

export type SltSummaryData = {
  schoolName:      string
  termLabel:       string
  generatedAt:     string
  // Attendance
  schoolAvgPct:    number | null
  yearAttendance:  Array<{ year: number; avg: number | null; below90: number; total: number }>
  // GCSE grades per subject
  subjectGrades:   Array<{ subject: string; yearGroup: number; avgScore: number | null; classCount: number }>
  // SEND headline
  sendTotal:       number
  ehcpCount:       number
  senSupportCount: number
  activeIlps:      number
  // Homework completion
  totalAssigned:   number
  totalSubmitted:  number
}

function gradeCell(avgScore: number | null): string {
  if (avgScore == null) return '<span style="color:#9ca3af;">—</span>'
  const g = Math.round(avgScore)
  const clamped = Math.min(9, Math.max(1, g)) as keyof typeof GCSE_LETTERS
  const bg =
    clamped >= 7 ? '#f0fdf4' :
    clamped >= 5 ? '#eff6ff' :
    clamped >= 4 ? '#fffbeb' :
    '#fef2f2'
  const color =
    clamped >= 7 ? '#15803d' :
    clamped >= 5 ? '#1d4ed8' :
    clamped >= 4 ? '#b45309' :
    '#b91c1c'
  return `<span style="background:${bg};color:${color};padding:1pt 6pt;border-radius:3pt;font-size:9pt;font-weight:700;">
    ${clamped} (${GCSE_LETTERS[clamped]})
  </span>`
}

function pctBar(pct: number | null): string {
  if (pct == null) return '—'
  const color = pct >= 95 ? '#16a34a' : pct >= 90 ? '#d97706' : pct >= 85 ? '#ea580c' : '#dc2626'
  return `<div style="display:flex;align-items:center;gap:6pt;">
    <div style="flex:1;background:#e5e7eb;border-radius:3pt;height:6pt;overflow:hidden;">
      <div style="width:${Math.min(pct, 100)}%;height:100%;background:${color};border-radius:3pt;"></div>
    </div>
    <span style="font-size:9pt;font-weight:600;color:${color};min-width:34pt;">${pct.toFixed(1)}%</span>
  </div>`
}

export function sltSummaryPdf(data: SltSummaryData): string {
  const completionPct = data.totalAssigned > 0
    ? Math.round((data.totalSubmitted / data.totalAssigned) * 100)
    : null

  // ── Summary strip ────────────────────────────────────────────────────────
  const summaryStrip = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10pt;margin-bottom:16pt;">
      <div class="card card-blue">
        <div style="font-size:22pt;font-weight:800;color:#2563eb;">${data.schoolAvgPct != null ? data.schoolAvgPct.toFixed(1) + '%' : '—'}</div>
        <div style="font-size:9pt;color:#6b7280;margin-top:2pt;">School Avg Attendance</div>
      </div>
      <div class="card card-green">
        <div style="font-size:22pt;font-weight:800;color:#16a34a;">${data.sendTotal}</div>
        <div style="font-size:9pt;color:#6b7280;margin-top:2pt;">Students on SEND Register</div>
      </div>
      <div class="card card-amber">
        <div style="font-size:22pt;font-weight:800;color:#d97706;">${data.activeIlps}</div>
        <div style="font-size:9pt;color:#6b7280;margin-top:2pt;">Active ILPs</div>
      </div>
      <div class="card" style="border-left:3pt solid #6b21a8;background:#faf5ff;">
        <div style="font-size:22pt;font-weight:800;color:#6b21a8;">${completionPct != null ? completionPct + '%' : '—'}</div>
        <div style="font-size:9pt;color:#6b7280;margin-top:2pt;">Homework Completion</div>
      </div>
    </div>`

  // ── Attendance by year group ──────────────────────────────────────────────
  const attendanceRows = data.yearAttendance.length === 0
    ? '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">No attendance data</td></tr>'
    : data.yearAttendance.map(yr => `
        <tr>
          <td><strong>Year ${yr.year}</strong></td>
          <td>${pctBar(yr.avg)}</td>
          <td style="text-align:center;font-size:9pt;color:${yr.below90 > 0 ? '#dc2626' : '#6b7280'};">${yr.below90}</td>
          <td style="text-align:center;font-size:9pt;color:#6b7280;">${yr.total}</td>
        </tr>`).join('')

  const attendanceSection = `
    <h2>Attendance Overview</h2>
    <table>
      <thead><tr><th>Year Group</th><th>Average</th><th style="text-align:center;">Below 90%</th><th style="text-align:center;">Students</th></tr></thead>
      <tbody>${attendanceRows}</tbody>
    </table>`

  // ── GCSE grade distribution by subject ───────────────────────────────────
  const subjectMap = new Map<string, typeof data.subjectGrades>()
  for (const row of data.subjectGrades) {
    if (!subjectMap.has(row.subject)) subjectMap.set(row.subject, [])
    subjectMap.get(row.subject)!.push(row)
  }

  const subjectRows = [...subjectMap.entries()].map(([subject, rows]) => {
    const sortedRows = rows.sort((a, b) => a.yearGroup - b.yearGroup)
    return sortedRows.map((r, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${sortedRows.length}"><strong>${escHtml(subject)}</strong></td>` : ''}
        <td>Year ${r.yearGroup}</td>
        <td>${gradeCell(r.avgScore)}</td>
        <td style="text-align:center;font-size:9pt;color:#6b7280;">${r.classCount}</td>
      </tr>`).join('')
  }).join('')

  const gradesSection = `
    <h2>GCSE Grade Distribution by Subject</h2>
    <table>
      <thead><tr><th>Subject</th><th>Year Group</th><th>Avg Grade</th><th style="text-align:center;">Classes</th></tr></thead>
      <tbody>${subjectRows || '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">No grade data</td></tr>'}</tbody>
    </table>`

  // ── SEND register ─────────────────────────────────────────────────────────
  const sendSection = `
    <h2>SEND Register</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10pt;margin-bottom:10pt;">
      <div class="card">
        <div style="font-size:18pt;font-weight:800;color:#6b21a8;">${data.ehcpCount}</div>
        <div style="font-size:9pt;color:#6b7280;">EHCP Plans</div>
      </div>
      <div class="card">
        <div style="font-size:18pt;font-weight:800;color:#1d4ed8;">${data.senSupportCount}</div>
        <div style="font-size:9pt;color:#6b7280;">SEN Support</div>
      </div>
      <div class="card">
        <div style="font-size:18pt;font-weight:800;color:#15803d;">${data.activeIlps}</div>
        <div style="font-size:9pt;color:#6b7280;">Active ILPs</div>
      </div>
    </div>`

  // ── Homework completion ───────────────────────────────────────────────────
  const hwSection = `
    <h2>Homework Completion (This Term)</h2>
    <div class="card">
      <div style="display:flex;align-items:center;gap:16pt;">
        <div>
          <span style="font-size:28pt;font-weight:800;color:#6b21a8;">${completionPct != null ? completionPct + '%' : '—'}</span>
          <span style="font-size:10pt;color:#6b7280;margin-left:8pt;">overall completion rate</span>
        </div>
        <div style="color:#6b7280;font-size:9pt;">
          ${data.totalSubmitted.toLocaleString()} submitted out of ${data.totalAssigned.toLocaleString()} assigned
        </div>
      </div>
    </div>`

  const body = `
    <h1>${escHtml(data.termLabel)} — Termly Summary</h1>
    <p class="meta">Generated ${escHtml(data.generatedAt)} · ${escHtml(data.schoolName)}</p>
    <div class="spacer"></div>
    ${summaryStrip}
    ${attendanceSection}
    ${gradesSection}
    ${sendSection}
    ${hwSection}
  `

  return pdfShell(body, `${data.termLabel} Termly Summary`, data.schoolName)
}
