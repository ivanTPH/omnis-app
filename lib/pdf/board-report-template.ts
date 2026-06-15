import { pdfShell, escHtml } from './templates'

export type BoardReportData = {
  schoolName:           string
  generatedAt:          Date
  totalStudents:        number
  totalStaff:           number
  totalClasses:         number
  avgAttendance:        number | null   // 0–100
  sendCount:            number
  sendPct:              number          // 0–100
  ilpCount:             number
  ehcpCount:            number
  openConcerns:         number
  totalHomework:        number
  avgCompletion:        number          // 0–100
  avgGrade:             number | null   // 0–9 GCSE scale
  pendingMark:          number          // submissions awaiting marking
  integrityFlagged:     number          // signals flagged in last 30 days
  subjectSummaries: {
    subject:     string
    classCount:  number
    avgGrade:    number | null
    completion:  number         // 0–100
  }[]
}

const GCSE_LETTERS: Record<number, string> = { 9:'A**',8:'A*',7:'A',6:'B',5:'C+',4:'C',3:'D',2:'E',1:'F' }

function gradeLabel(g: number | null): string {
  if (g == null) return '—'
  const n = Math.round(g)
  return `${n} (${GCSE_LETTERS[n] ?? '?'})`
}

function rag(val: number, goodGte: number, warnGte: number): string {
  if (val >= goodGte) return '#16a34a'
  if (val >= warnGte) return '#d97706'
  return '#dc2626'
}

export function boardReportPdf(data: BoardReportData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const attColor = rag(data.avgAttendance ?? 0, 95, 90)
  const compColor = rag(data.avgCompletion, 80, 60)

  const subjectRows = data.subjectSummaries.map(s => `<tr>
    <td style="font-weight:600;">${escHtml(s.subject)}</td>
    <td style="text-align:center;">${s.classCount}</td>
    <td style="text-align:center;font-weight:700;color:${s.avgGrade != null ? rag(s.avgGrade, 6, 4) : '#9ca3af'};">${gradeLabel(s.avgGrade)}</td>
    <td style="text-align:center;color:${rag(s.completion, 80, 60)};">${s.completion.toFixed(0)}%</td>
  </tr>`).join('')

  const body = `
    <h1>Board Report</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      ${escHtml(data.schoolName)} · Generated ${fmtDate(data.generatedAt)}
    </p>
    <p style="font-size:9pt;color:#9ca3af;margin-bottom:14pt;">
      Prepared for governors and trustees. All figures reflect current live data.
    </p>

    <h2>School Overview</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Students</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.totalStudents}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Staff</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.totalStaff}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Classes</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.totalClasses}</p>
      </div>
      <div class="card" style="background:#${data.avgAttendance != null && data.avgAttendance < 90 ? 'fee2e2' : 'f0fdf4'};">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Avg Attendance</p>
        <p style="font-size:18pt;font-weight:700;color:${attColor};margin:0;">${data.avgAttendance != null ? data.avgAttendance.toFixed(1) + '%' : '—'}</p>
      </div>
    </div>

    <h2>SEND Summary</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card card-amber">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">On SEND Register</p>
        <p style="font-size:18pt;font-weight:700;color:#d97706;margin:0;">${data.sendCount} <span style="font-size:11pt;font-weight:400;color:#9ca3af;">(${data.sendPct.toFixed(1)}%)</span></p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Active ILPs</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.ilpCount}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">EHCPs</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.ehcpCount}</p>
      </div>
      <div class="card ${data.openConcerns > 5 ? 'card-red' : ''}">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Open Concerns</p>
        <p style="font-size:18pt;font-weight:700;color:${data.openConcerns > 5 ? '#dc2626' : '#374151'};margin:0;">${data.openConcerns}</p>
      </div>
    </div>

    <h2>Academic Performance</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Homework Set</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.totalHomework}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Avg Completion</p>
        <p style="font-size:18pt;font-weight:700;color:${compColor};margin:0;">${data.avgCompletion.toFixed(0)}%</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">School Avg Grade</p>
        <p style="font-size:18pt;font-weight:700;color:${data.avgGrade != null ? rag(data.avgGrade, 6, 4) : '#9ca3af'};margin:0;">${gradeLabel(data.avgGrade)}</p>
      </div>
      <div class="card ${data.pendingMark > 20 ? 'card-amber' : ''}">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Awaiting Marking</p>
        <p style="font-size:18pt;font-weight:700;color:${data.pendingMark > 20 ? '#d97706' : '#374151'};margin:0;">${data.pendingMark}</p>
      </div>
    </div>

    ${data.subjectSummaries.length > 0 ? `
    <h2>Performance by Subject</h2>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th style="text-align:center;width:60pt;">Classes</th>
          <th style="text-align:center;width:80pt;">Avg Grade</th>
          <th style="text-align:center;width:80pt;">Completion</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
    </table>` : ''}

    <p style="font-size:8pt;color:#9ca3af;margin-top:12pt;">
      Grades are on the GCSE 1–9 scale. Completion rates are based on homework submitted vs assigned.
      Attendance data sourced from MIS sync. Document produced by Omnis School Platform.
    </p>
  `

  return pdfShell(body, 'Board Report', data.schoolName)
}
