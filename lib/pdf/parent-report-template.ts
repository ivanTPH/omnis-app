import { pdfShell, escHtml } from './templates'

export type ParentReportData = {
  studentName:    string
  yearGroup:      number | null
  formClass:      string | null
  schoolName:     string
  generatedDate:  Date
  // Attendance
  attendancePct:  number | null
  // Recent homework grades
  recentHomework: { title: string; subject: string; grade: string; returnedAt: Date }[]
  // Active ILP targets (if any — shown in summary form only)
  ilpTargets:     { target: string; status: string; targetDate: Date }[]
  // Upcoming exam dates (revision exams)
  upcomingExams:  { subject: string; title: string; examDate: Date }[]
  // Open SEND concerns count (no detail — privacy)
  openConcerns:   number
}

const GRADE_COLOR: Record<string, string> = {
  '9': '#16a34a', '8': '#16a34a', '7': '#2563eb',
  '6': '#2563eb', '5': '#d97706', '4': '#d97706',
  '3': '#dc2626', '2': '#dc2626', '1': '#dc2626',
}

const ILP_STATUS_LABEL: Record<string, string> = {
  active:       'Active',
  achieved:     'Achieved',
  not_achieved: 'Not achieved',
  deferred:     'Deferred',
}

function gradeColor(grade: string): string {
  const digit = grade.match(/\d/)?.[0] ?? ''
  return GRADE_COLOR[digit] ?? '#6b7280'
}

export function parentReportPdf(data: ParentReportData): string {
  const {
    studentName, yearGroup, formClass, schoolName, generatedDate,
    attendancePct, recentHomework, ilpTargets, upcomingExams, openConcerns,
  } = data

  const dateStr = generatedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const yearStr = yearGroup ? `Year ${yearGroup}` : ''
  const formStr = formClass ? ` · Form ${escHtml(formClass)}` : ''

  // ── Attendance ────────────────────────────────────────────────────────────────
  let attendanceHtml = ''
  if (attendancePct != null) {
    const color = attendancePct < 85 ? '#dc2626' : attendancePct < 90 ? '#d97706' : '#16a34a'
    const barWidth = Math.min(100, attendancePct).toFixed(1)
    attendanceHtml = `
      <h2>Attendance</h2>
      <div class="card">
        <p style="font-size:22pt;font-weight:700;color:${color};margin-bottom:4pt">${attendancePct.toFixed(1)}%</p>
        <div style="background:#e5e7eb;border-radius:4pt;height:8pt;overflow:hidden;max-width:300pt">
          <div style="background:${color};height:8pt;width:${barWidth}%;border-radius:4pt"></div>
        </div>
        <p class="meta" style="margin-top:6pt">
          ${attendancePct >= 95
            ? 'Excellent attendance — on track.'
            : attendancePct >= 90
              ? 'Good attendance — just below the 95% target.'
              : attendancePct >= 85
                ? 'Attendance is below 90% — please speak to the school.'
                : 'Attendance is below 85% — this is a concern. Please contact the school urgently.'}
        </p>
      </div>`
  }

  // ── Recent homework ───────────────────────────────────────────────────────────
  let hwHtml = ''
  if (recentHomework.length > 0) {
    const rows = recentHomework.map(h => {
      const color = gradeColor(h.grade)
      return `<tr>
        <td>${escHtml(h.title)}</td>
        <td>${escHtml(h.subject)}</td>
        <td style="font-weight:700;color:${color}">${escHtml(h.grade)}</td>
        <td class="meta">${h.returnedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
      </tr>`
    }).join('')

    hwHtml = `
      <h2>Recent Homework Grades</h2>
      <table>
        <thead><tr>
          <th>Assignment</th>
          <th>Subject</th>
          <th>Grade</th>
          <th>Returned</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
  }

  // ── ILP targets ───────────────────────────────────────────────────────────────
  let ilpHtml = ''
  if (ilpTargets.length > 0) {
    const items = ilpTargets.map(t => {
      const statusLabel = ILP_STATUS_LABEL[t.status] ?? t.status
      const dueDateStr  = t.targetDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      return `<li>${escHtml(t.target)} <span class="meta">(${escHtml(statusLabel)} · Due ${dueDateStr})</span></li>`
    }).join('')

    ilpHtml = `
      <h2>Learning Targets</h2>
      <div class="card card-blue">
        <p class="meta" style="margin-bottom:6pt">
          Your child has an Individual Learning Plan (ILP) with the following active targets:
        </p>
        <ul>${items}</ul>
        <p class="meta" style="margin-top:8pt">For full details, please speak with the school's SENCO.</p>
      </div>`
  }

  // ── Upcoming exams ────────────────────────────────────────────────────────────
  let examsHtml = ''
  if (upcomingExams.length > 0) {
    const rows = upcomingExams.map(e => `<tr>
      <td>${escHtml(e.subject)}</td>
      <td>${escHtml(e.title)}</td>
      <td>${e.examDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
    </tr>`).join('')

    examsHtml = `
      <h2>Upcoming Exams</h2>
      <table>
        <thead><tr><th>Subject</th><th>Exam</th><th>Date</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
  }

  // ── Concerns note ─────────────────────────────────────────────────────────────
  const concernsHtml = openConcerns > 0
    ? `<div class="card card-amber" style="margin-top:12pt">
        <p><strong>Note:</strong> There ${openConcerns === 1 ? 'is' : 'are'} ${openConcerns} open SEND concern${openConcerns !== 1 ? 's' : ''} recorded for your child. Please contact the school to discuss.</p>
      </div>`
    : ''

  const content = `
    <div style="margin-bottom:16pt">
      <h1>${escHtml(studentName)}</h1>
      <p class="meta">${yearStr}${formStr} · ${escHtml(schoolName)}</p>
      <p class="meta">Report generated: ${dateStr}</p>
    </div>
    ${attendanceHtml}
    ${hwHtml}
    ${ilpHtml}
    ${examsHtml}
    ${concernsHtml}
    <hr class="divider" style="margin-top:20pt" />
    <p class="meta">This report was generated by Omnis School Platform and is intended for the parent/carer of the named student only.</p>
  `

  return pdfShell(content, `Student Report — ${studentName}`, schoolName)
}
