import { pdfShell, escHtml } from './templates'

export type RevisionExamRow = {
  subject:     string
  examBoard:   string | null
  paperName:   string | null
  examDate:    Date
  daysUntil:   number
  sessionsCompleted: number
  sessionsTotal:     number
}

export type RevisionTopicRow = {
  subject:     string
  topic:       string
  confidence:  number | null  // 1–5
  lastRevised: Date | null
  nextReview:  Date | null
}

export type RevisionProgressData = {
  schoolName:   string
  generatedAt:  Date
  studentName:  string
  yearGroup:    number | null
  exams:        RevisionExamRow[]
  topics:       RevisionTopicRow[]
  totalPlanned: number
  totalCompleted: number
  totalSkipped: number
  avgConfidence: number | null
}

const CONF_LABEL = ['', 'Not confident', 'Slightly confident', 'Fairly confident', 'Confident', 'Very confident']
const CONF_COLOR = ['', '#dc2626', '#d97706', '#ca8a04', '#16a34a', '#15803d']

function fmtDateShort(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function revisionProgressPdf(data: RevisionProgressData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const completionPct = data.totalPlanned > 0
    ? Math.round(data.totalCompleted / data.totalPlanned * 100)
    : 0

  const examsHtml = data.exams.length === 0
    ? '<p class="text-muted">No exams registered.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Exam Board</th>
            <th>Paper</th>
            <th style="width:70pt;">Exam Date</th>
            <th style="width:55pt;text-align:center;">Days Left</th>
            <th style="width:80pt;text-align:center;">Sessions</th>
          </tr>
        </thead>
        <tbody>
          ${data.exams.map(e => {
            const urgency = e.daysUntil <= 14 ? '#dc2626' : e.daysUntil <= 30 ? '#d97706' : '#374151'
            return `<tr>
              <td style="font-weight:600;">${escHtml(e.subject)}</td>
              <td style="color:#6b7280;font-size:9pt;">${escHtml(e.examBoard ?? '—')}</td>
              <td style="font-size:9pt;">${escHtml(e.paperName ?? '—')}</td>
              <td style="white-space:nowrap;">${fmtDateShort(e.examDate)}</td>
              <td style="text-align:center;font-weight:700;color:${urgency};">${e.daysUntil > 0 ? e.daysUntil : 'Past'}</td>
              <td style="text-align:center;">${e.sessionsCompleted}/${e.sessionsTotal}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`

  const topicsHtml = data.topics.length === 0
    ? '<p class="text-muted">No topics tracked.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Topic</th>
            <th style="width:120pt;">Confidence</th>
            <th style="width:80pt;">Last Revised</th>
            <th style="width:80pt;">Next Review</th>
          </tr>
        </thead>
        <tbody>
          ${data.topics.map(t => {
            const confLabel = t.confidence != null ? (CONF_LABEL[t.confidence] ?? '—') : '—'
            const confColor = t.confidence != null ? (CONF_COLOR[t.confidence] ?? '#9ca3af') : '#9ca3af'
            return `<tr>
              <td style="font-weight:600;font-size:9pt;">${escHtml(t.subject)}</td>
              <td style="font-size:9pt;">${escHtml(t.topic)}</td>
              <td>
                ${t.confidence != null ? `<span style="display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600;background:${confColor}22;color:${confColor};">${escHtml(confLabel)} (${t.confidence}/5)</span>` : '<span style="color:#9ca3af;">—</span>'}
              </td>
              <td style="font-size:9pt;color:#6b7280;">${t.lastRevised ? fmtDateShort(t.lastRevised) : '—'}</td>
              <td style="font-size:9pt;color:#6b7280;">${t.nextReview ? fmtDateShort(t.nextReview) : '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`

  const body = `
    <h1>Revision Progress Report</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      ${escHtml(data.schoolName)} · ${escHtml(data.studentName)}${data.yearGroup ? ` · Year ${data.yearGroup}` : ''} · Generated ${fmtDate(data.generatedAt)}
    </p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Sessions Planned</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.totalPlanned}</p>
      </div>
      <div class="card card-green">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Completed</p>
        <p style="font-size:18pt;font-weight:700;color:#16a34a;margin:0;">${data.totalCompleted} <span style="font-size:11pt;font-weight:400;color:#9ca3af;">(${completionPct}%)</span></p>
      </div>
      <div class="card ${data.totalSkipped > 0 ? 'card-amber' : ''}">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Skipped</p>
        <p style="font-size:18pt;font-weight:700;color:${data.totalSkipped > 0 ? '#d97706' : '#374151'};margin:0;">${data.totalSkipped}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Avg Confidence</p>
        <p style="font-size:18pt;font-weight:700;color:${data.avgConfidence != null ? CONF_COLOR[Math.round(data.avgConfidence)] ?? '#374151' : '#9ca3af'};margin:0;">${data.avgConfidence != null ? data.avgConfidence.toFixed(1) + '/5' : '—'}</p>
      </div>
    </div>

    <h2>Upcoming Exams</h2>
    ${examsHtml}

    <h2>Topic Confidence Tracker</h2>
    ${topicsHtml}
  `

  return pdfShell(body, 'Revision Progress Report', data.schoolName)
}
