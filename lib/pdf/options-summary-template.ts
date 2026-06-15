import { pdfShell, escHtml } from './templates'

export type OptionsSummaryRow = {
  subject:      string
  isCore:       boolean
  studentCount: number
  classCount:   number
  levels:       string[]   // e.g. ['GCSE', 'A-Level']
}

export type OptionsSummaryData = {
  schoolName:  string
  yearGroup:   number
  generatedAt: Date
  rows:        OptionsSummaryRow[]
}

export function optionsSummaryPdf(data: OptionsSummaryData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const coreRows    = data.rows.filter(r => r.isCore)
  const optionRows  = data.rows.filter(r => !r.isCore)
  const totalStudents = data.rows.reduce((sum, r) => sum + r.studentCount, 0)

  const renderTable = (rows: OptionsSummaryRow[]) => {
    if (rows.length === 0) return '<p class="text-muted">No subjects recorded.</p>'
    return `<table>
      <thead>
        <tr>
          <th>Subject</th>
          <th style="width:80pt;">Level(s)</th>
          <th style="width:60pt;text-align:center;">Students</th>
          <th style="width:70pt;text-align:center;">Classes</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const levelBadges = r.levels.length > 0
            ? r.levels.map(l => `<span style="display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600;background:#eff6ff;color:#1d4ed8;margin-right:3pt;">${escHtml(l)}</span>`).join('')
            : '<span style="color:#9ca3af;">—</span>'
          const classCell = r.classCount > 0
            ? `<span style="color:#374151;">${r.classCount}</span>`
            : `<span style="color:#f59e0b;font-weight:600;">None set</span>`
          return `<tr>
            <td style="font-weight:600;">${escHtml(r.subject)}</td>
            <td>${levelBadges}</td>
            <td style="text-align:center;">${r.studentCount}</td>
            <td style="text-align:center;">${classCell}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`
  }

  const body = `
    <h1>Subject Options Summary</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      ${escHtml(data.schoolName)} · Year ${data.yearGroup} · Generated ${fmtDate(data.generatedAt)}
    </p>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10pt;margin-bottom:16pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Total Subjects</p>
        <p style="font-size:20pt;font-weight:700;color:#374151;margin:0;">${data.rows.length}</p>
      </div>
      <div class="card card-blue">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Core Subjects</p>
        <p style="font-size:20pt;font-weight:700;color:#1d4ed8;margin:0;">${coreRows.length}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Option Subjects</p>
        <p style="font-size:20pt;font-weight:700;color:#374151;margin:0;">${optionRows.length}</p>
      </div>
    </div>

    <h2>Core Subjects</h2>
    ${renderTable(coreRows)}

    <h2>Option Subjects</h2>
    ${renderTable(optionRows)}

    <p style="font-size:9pt;color:#9ca3af;margin-top:8pt;">
      Total student-subject enrolments: ${totalStudents}
    </p>
  `

  return pdfShell(body, `Subject Options — Year ${data.yearGroup}`, data.schoolName)
}
