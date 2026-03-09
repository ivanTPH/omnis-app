import { pdfShell, escHtml } from './templates'

export type HomeworkSummaryItem = {
  title:        string
  subject:      string
  className?:   string | null
  type:         string
  setAt:        Date
  dueAt:        Date
  status:       string   // homework status
  submission?:  {
    status:     string
    finalScore: number | null
    maxScore:   number | null
  } | null
}

export function homeworkSummaryPdf(
  homeworks:   HomeworkSummaryItem[],
  studentName: string,
  schoolName:  string,
): string {
  const now = new Date()

  const stats = {
    total:     homeworks.length,
    submitted: homeworks.filter(h => h.submission).length,
    pending:   homeworks.filter(h => !h.submission && new Date(h.dueAt) > now && h.status === 'PUBLISHED').length,
    overdue:   homeworks.filter(h => !h.submission && new Date(h.dueAt) < now && h.status === 'PUBLISHED').length,
  }

  function statusLabel(hw: HomeworkSummaryItem): { label: string; colour: string } {
    if (hw.submission) {
      const s = hw.submission.status
      if (s === 'MARKED' || s === 'RETURNED') return { label: 'Marked', colour: '#16a34a' }
      return { label: 'Submitted', colour: '#2563eb' }
    }
    if (hw.status === 'DRAFT')   return { label: 'Draft',   colour: '#6b7280' }
    if (hw.status === 'CLOSED')  return { label: 'Closed',  colour: '#6b7280' }
    const overdue = new Date(hw.dueAt) < now
    if (overdue) return { label: 'Overdue', colour: '#dc2626' }
    return { label: 'Pending', colour: '#d97706' }
  }

  function scoreDisplay(hw: HomeworkSummaryItem): string {
    if (!hw.submission?.finalScore || !hw.submission?.maxScore) return '—'
    const pct = Math.round((hw.submission.finalScore / hw.submission.maxScore) * 100)
    return `${hw.submission.finalScore}/${hw.submission.maxScore} (${pct}%)`
  }

  const rows = homeworks
    .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime())
    .map(hw => {
      const { label, colour } = statusLabel(hw)
      return `
        <tr>
          <td><strong>${escHtml(hw.subject)}</strong>${hw.className ? `<br/><span class="text-sm text-muted">${escHtml(hw.className)}</span>` : ''}</td>
          <td>${escHtml(hw.title)}</td>
          <td><span class="badge">${escHtml(hw.type.replace(/_/g, ' '))}</span></td>
          <td>${new Date(hw.setAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
          <td>${new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
          <td style="color:${colour};font-weight:600;">${escHtml(label)}</td>
          <td>${escHtml(scoreDisplay(hw))}</td>
        </tr>`
    }).join('')

  const content = `
    <div style="margin-bottom:14pt;">
      <h1>Homework Summary</h1>
      <p class="meta">Student: <strong>${escHtml(studentName)}</strong></p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10pt;margin-bottom:16pt;">
      <div class="card" style="text-align:center;">
        <div style="font-size:22pt;font-weight:700;color:#2563eb;">${stats.total}</div>
        <div class="text-sm text-muted">Total Set</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:22pt;font-weight:700;color:#16a34a;">${stats.submitted}</div>
        <div class="text-sm text-muted">Submitted</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:22pt;font-weight:700;color:#d97706;">${stats.pending}</div>
        <div class="text-sm text-muted">Pending</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:22pt;font-weight:700;color:#dc2626;">${stats.overdue}</div>
        <div class="text-sm text-muted">Overdue</div>
      </div>
    </div>

    ${homeworks.length === 0 ? '<p class="text-muted">No homework records found.</p>' : `
    <h2>All Homework</h2>
    <table>
      <thead>
        <tr>
          <th style="width:80pt;">Subject</th>
          <th>Title</th>
          <th style="width:70pt;">Type</th>
          <th style="width:50pt;">Set</th>
          <th style="width:50pt;">Due</th>
          <th style="width:60pt;">Status</th>
          <th style="width:70pt;">Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`}`

  return pdfShell(
    content,
    `Homework Summary — ${studentName}`,
    schoolName,
  )
}
