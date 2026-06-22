import { pdfShell, escHtml } from './templates'

export type ReportCardSubject = {
  subject:        string
  avgGrade:       number | null   // 1–9 GCSE scale
  letterGrade:    string | null   // e.g. "A"
  hwCount:        number
  lastGrade:      number | null
  recentFeedback: string | null
}

export type ReportCardIlpTarget = {
  description:     string
  successCriteria: string
  status:          string
}

export type ReportCardData = {
  schoolName:           string
  generatedAt:          Date
  studentName:          string
  yearGroup:            number | null
  tutorGroup:           string | null
  attendancePercentage: number | null
  sendStatus:           string | null   // "EHCP" | "SEN_SUPPORT" | "NONE" | null
  ilpSummary:           string | null
  openConcerns:         number
  subjects:             ReportCardSubject[]
  ilpTargets:           ReportCardIlpTarget[]
  behaviourCount:       number
}

const GRADE_LETTERS = ['', 'F', 'E', 'D', 'C', 'C+', 'B', 'A', 'A*', 'A**']

function gradeLabel(g: number | null): string {
  if (g == null) return '—'
  const n = Math.round(g)
  return `${n} (${GRADE_LETTERS[n] ?? '?'})`
}

function attendanceRag(pct: number | null): string {
  if (pct == null) return '#6b7280'
  if (pct >= 95) return '#16a34a'
  if (pct >= 90) return '#d97706'
  return '#dc2626'
}

export function reportCardPdf(data: ReportCardData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const attPct = data.attendancePercentage != null
    ? `${data.attendancePercentage.toFixed(1)}%`
    : '—'
  const attColor = attendanceRag(data.attendancePercentage)

  const subjectsHtml = data.subjects.length === 0
    ? '<p class="text-muted">No graded homework submissions recorded for this student yet.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Subject</th>
            <th style="width:80pt;text-align:center;">Avg Grade</th>
            <th style="width:80pt;text-align:center;">Most Recent</th>
            <th style="width:50pt;text-align:center;">HW Done</th>
            <th>Most Recent Teacher Feedback</th>
          </tr>
        </thead>
        <tbody>
          ${data.subjects.map(s => {
            const color = s.avgGrade == null ? '#9ca3af'
              : s.avgGrade >= 7 ? '#16a34a'
              : s.avgGrade >= 5 ? '#2563eb'
              : s.avgGrade >= 4 ? '#d97706'
              : '#dc2626'
            const feedback = s.recentFeedback
              ? escHtml(s.recentFeedback.slice(0, 160)) + (s.recentFeedback.length > 160 ? '…' : '')
              : '<span style="color:#9ca3af;">—</span>'
            return `<tr>
              <td style="font-weight:600;">${escHtml(s.subject)}</td>
              <td style="text-align:center;font-weight:700;color:${color};">${gradeLabel(s.avgGrade)}</td>
              <td style="text-align:center;color:#6b7280;">${gradeLabel(s.lastGrade)}</td>
              <td style="text-align:center;color:#6b7280;">${s.hwCount}</td>
              <td style="font-size:8pt;color:#374151;font-style:italic;">${feedback}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`

  const sendHtml = data.sendStatus && data.sendStatus !== 'NONE'
    ? `<div class="card card-amber" style="margin-bottom:14pt;">
        <p style="font-size:9pt;font-weight:600;color:#92400e;margin:0 0 3pt;">
          SEND Status: ${escHtml(data.sendStatus === 'EHCP' ? 'Education, Health & Care Plan (EHCP)' : 'SEN Support')}
        </p>
        ${data.ilpSummary ? `<p style="font-size:9pt;color:#78350f;margin:0;">${escHtml(data.ilpSummary)}</p>` : ''}
      </div>`
    : ''

  const ilpHtml = data.ilpTargets.length > 0
    ? `<h2>Active ILP Targets</h2>
       <table>
         <thead>
           <tr>
             <th>Target / Goal</th>
             <th style="width:200pt;">Success Criteria</th>
             <th style="width:60pt;text-align:center;">Status</th>
           </tr>
         </thead>
         <tbody>
           ${data.ilpTargets.map(t => `<tr>
             <td style="font-size:9pt;">${escHtml(t.description)}</td>
             <td style="font-size:8pt;color:#6b7280;">${escHtml(t.successCriteria || '—')}</td>
             <td style="text-align:center;font-size:8pt;color:#d97706;font-weight:600;">${escHtml(t.status)}</td>
           </tr>`).join('')}
         </tbody>
       </table>`
    : ''

  const body = `
    <h1>Student Report Card</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:10pt;">
      ${escHtml(data.schoolName)} · Generated ${fmtDate(data.generatedAt)}
    </p>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10pt;margin-bottom:14pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 6pt;font-weight:600;text-transform:uppercase;letter-spacing:0.5pt;">Student</p>
        <p style="font-size:14pt;font-weight:700;color:#111827;margin:0;">${escHtml(data.studentName)}</p>
        ${data.yearGroup ? `<p style="font-size:10pt;color:#6b7280;margin:2pt 0 0;">Year ${data.yearGroup}${data.tutorGroup ? ` · ${escHtml(data.tutorGroup)}` : ''}</p>` : ''}
      </div>
      <div class="card" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;">
        <div>
          <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Attendance</p>
          <p style="font-size:16pt;font-weight:700;color:${attColor};margin:0;">${attPct}</p>
        </div>
        <div>
          <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Open Concerns</p>
          <p style="font-size:16pt;font-weight:700;color:${data.openConcerns > 0 ? '#dc2626' : '#374151'};margin:0;">${data.openConcerns}</p>
        </div>
        <div>
          <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Behaviour Records</p>
          <p style="font-size:16pt;font-weight:700;color:#374151;margin:0;">${data.behaviourCount}</p>
        </div>
      </div>
    </div>

    ${sendHtml}

    <h2>Academic Performance by Subject</h2>
    ${subjectsHtml}

    ${ilpHtml}

    <p style="font-size:8pt;color:#9ca3af;margin-top:12pt;">
      Grades are on the GCSE 1–9 scale. Averages are calculated from all graded and returned homework submissions.
      This report was generated automatically from Omnis and is intended for internal use.
    </p>
  `

  return pdfShell(body, 'Student Report Card', data.schoolName)
}
