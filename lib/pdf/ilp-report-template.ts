import { pdfShell, escHtml } from './templates'

export type IlpReportTarget = {
  targetDescription: string
  status:            string
  successCriteria?:  string | null
  reviewDate?:       Date | null
}

export type IlpReportEvidence = {
  homeworkTitle: string
  subject?:      string | null
  evidenceType:  string
  aiSummary?:    string | null
  createdAt:     Date
}

export type IlpReportSubmission = {
  homeworkTitle: string
  className:     string
  finalScore?:   number | null
  status:        string
  submittedAt:   Date
}

export type IlpReportData = {
  studentName:   string
  yearGroup:     number | null
  tutorGroup?:   string | null
  sendStatus:    string
  needArea?:     string | null
  schoolName:    string
  generatedAt:   Date
  targets:       IlpReportTarget[]
  evidenceEntries: IlpReportEvidence[]
  recentSubmissions: IlpReportSubmission[]
}

const GCSE_LETTERS = ['','F','E','D','C','C+','B','A','A*','A**'] as const

function gradeLabel(score: number | null | undefined): string {
  if (score == null) return '—'
  const g = Math.min(9, Math.max(1, Math.round(score)))
  return `${g} (${GCSE_LETTERS[g]})`
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active:       'background:#dbeafe;color:#1d4ed8',
    achieved:     'background:#d1fae5;color:#065f46',
    not_achieved: 'background:#fee2e2;color:#991b1b',
    deferred:     'background:#f3f4f6;color:#6b7280',
  }
  const style = map[status] ?? 'background:#f3f4f6;color:#6b7280'
  return `<span style="display:inline-block;padding:1pt 6pt;border-radius:4pt;font-size:8pt;font-weight:600;${style}">${escHtml(status)}</span>`
}

function evidenceBadge(type: string): string {
  const map: Record<string, string> = {
    PROGRESS: 'background:#d1fae5;color:#065f46',
    CONCERN:  'background:#fee2e2;color:#991b1b',
    NEUTRAL:  'background:#f3f4f6;color:#374151',
  }
  const style = map[type] ?? map.NEUTRAL
  return `<span style="display:inline-block;padding:1pt 6pt;border-radius:4pt;font-size:8pt;font-weight:600;${style}">${escHtml(type)}</span>`
}

export function ilpReportPdf(data: IlpReportData): string {
  const fmtDate = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const sendBadgeStyle = data.sendStatus === 'EHCP'
    ? 'background:#ede9fe;color:#6d28d9'
    : 'background:#dbeafe;color:#1d4ed8'

  const achievedCount = data.targets.filter(t => t.status === 'achieved').length

  // ── Targets section ──
  const targetsHtml = data.targets.length === 0
    ? '<p class="text-muted">No active ILP targets recorded.</p>'
    : data.targets.map(t => `
      <div class="card" style="margin-bottom:8pt;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8pt;">
          <p style="font-weight:600;font-size:11pt;margin:0 0 4pt;">${escHtml(t.targetDescription)}</p>
          ${statusBadge(t.status)}
        </div>
        ${t.successCriteria ? `<p style="font-size:9pt;color:#6b7280;margin:4pt 0 0;"><strong>Success criteria:</strong> ${escHtml(t.successCriteria)}</p>` : ''}
        ${t.reviewDate ? `<p style="font-size:9pt;color:#6b7280;margin:2pt 0 0;">Review due: ${fmtDate(t.reviewDate)}</p>` : ''}
      </div>
    `).join('')

  // ── Evidence section ──
  const evidenceHtml = data.evidenceEntries.length === 0
    ? '<p class="text-muted">No evidence entries linked yet.</p>'
    : `<table>
      <thead>
        <tr>
          <th>Homework</th>
          <th>Subject</th>
          <th>Evidence</th>
          <th>AI Note</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${data.evidenceEntries.map(e => `
          <tr>
            <td>${escHtml(e.homeworkTitle)}</td>
            <td>${escHtml(e.subject ?? '—')}</td>
            <td>${evidenceBadge(e.evidenceType)}</td>
            <td style="font-size:9pt;color:#6b7280;">${escHtml(e.aiSummary ?? '—')}</td>
            <td style="white-space:nowrap;">${fmtDate(e.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`

  // ── Recent submissions section ──
  const submissionsHtml = data.recentSubmissions.length === 0
    ? '<p class="text-muted">No recent homework submissions.</p>'
    : `<table>
      <thead>
        <tr>
          <th>Homework</th>
          <th>Class</th>
          <th>Grade</th>
          <th>Status</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        ${data.recentSubmissions.map(s => `
          <tr>
            <td>${escHtml(s.homeworkTitle)}</td>
            <td>${escHtml(s.className)}</td>
            <td>${gradeLabel(s.finalScore)}</td>
            <td>${escHtml(s.status)}</td>
            <td style="white-space:nowrap;">${fmtDate(s.submittedAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`

  const body = `
    <h1>ILP Progress Report — ${escHtml(data.studentName)}</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">${escHtml(data.schoolName)} · Generated ${fmtDate(data.generatedAt)}</p>

    <table style="margin-bottom:16pt;font-size:10pt;">
      <tr>
        <td style="width:120pt;font-weight:600;color:#374151;border:none;padding:3pt 0;">Student</td>
        <td style="border:none;padding:3pt 0;">${escHtml(data.studentName)}</td>
        <td style="width:120pt;font-weight:600;color:#374151;border:none;padding:3pt 0;">Year Group</td>
        <td style="border:none;padding:3pt 0;">${data.yearGroup ? `Year ${data.yearGroup}` : '—'}</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">Tutor Group</td>
        <td style="border:none;padding:3pt 0;">${escHtml(data.tutorGroup ?? '—')}</td>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">SEND Status</td>
        <td style="border:none;padding:3pt 0;">
          <span style="display:inline-block;padding:1pt 8pt;border-radius:4pt;font-size:9pt;font-weight:700;${sendBadgeStyle}">
            ${escHtml(data.sendStatus)}
          </span>
          ${data.needArea ? `&nbsp;<span style="color:#6b7280;font-size:9pt;">${escHtml(data.needArea)}</span>` : ''}
        </td>
      </tr>
    </table>

    <div class="two-col" style="margin-bottom:14pt;">
      <div class="card card-blue">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Total Targets</p>
        <p style="font-size:18pt;font-weight:700;color:#2563eb;margin:0;">${data.targets.length}</p>
      </div>
      <div class="card card-green">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Achieved</p>
        <p style="font-size:18pt;font-weight:700;color:#16a34a;margin:0;">${achievedCount}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Evidence Entries</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.evidenceEntries.length}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Recent Submissions</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${data.recentSubmissions.length}</p>
      </div>
    </div>

    <h2>ILP Targets</h2>
    ${targetsHtml}

    <h2>Evidence Entries</h2>
    ${evidenceHtml}

    <h2>Recent Homework Grades</h2>
    ${submissionsHtml}
  `

  return pdfShell(body, `ILP Report — ${data.studentName}`, data.schoolName)
}
