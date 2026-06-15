import { pdfShell, escHtml } from './templates'

export type IntegritySignalRow = {
  studentName:    string
  homeworkTitle:  string
  className:      string
  riskLevel:      string
  pasteRatio:     number | null
  focusLostCount: number | null
  pastedChars:    number | null
  typedChars:     number | null
  createdAt:      Date
  lastReviewAction?: string | null
  lastReviewerName?: string | null
}

export type IntegrityPatternCaseRow = {
  studentName:     string
  status:          string
  triggerCount:    number
  subjectCount:    number
  openedAt:        Date
  notes?:          string | null
  escalatedAt?:    Date | null
  escalatedByName?: string | null
}

export type IntegrityReportData = {
  schoolName:   string
  reportScope:  string   // e.g. "Year 9" or "All year groups"
  generatedAt:  Date
  signals:      IntegritySignalRow[]
  patternCases: IntegrityPatternCaseRow[]
}

const RISK_STYLE: Record<string, string> = {
  HIGH:   'background:#fee2e2;color:#991b1b',
  MEDIUM: 'background:#fffbeb;color:#92400e',
  LOW:    'background:#f3f4f6;color:#374151',
}

const CASE_STATUS_STYLE: Record<string, string> = {
  OPEN:      'background:#dbeafe;color:#1d4ed8',
  ESCALATED: 'background:#fee2e2;color:#991b1b',
  CLOSED:    'background:#f3f4f6;color:#6b7280',
}

export function integrityReportPdf(data: IntegrityReportData): string {
  const fmtDate = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const highCount   = data.signals.filter(s => s.riskLevel === 'HIGH').length
  const openCases   = data.patternCases.filter(c => c.status === 'OPEN').length
  const escalated   = data.patternCases.filter(c => c.status === 'ESCALATED').length

  const signalsHtml = data.signals.length === 0
    ? '<p class="text-muted">No integrity signals recorded.</p>'
    : `<table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Homework</th>
          <th>Class</th>
          <th style="width:60pt;">Risk</th>
          <th style="width:55pt;">Paste %</th>
          <th style="width:60pt;">Focus Lost</th>
          <th style="width:70pt;">Date</th>
          <th>Last Review</th>
        </tr>
      </thead>
      <tbody>
        ${data.signals.map(s => {
          const rStyle = RISK_STYLE[s.riskLevel] ?? RISK_STYLE.LOW
          const pct = s.pasteRatio != null ? `${(s.pasteRatio * 100).toFixed(0)}%` : '—'
          return `<tr>
            <td style="font-weight:600;">${escHtml(s.studentName)}</td>
            <td style="font-size:9pt;">${escHtml(s.homeworkTitle)}</td>
            <td style="font-size:9pt;color:#6b7280;">${escHtml(s.className)}</td>
            <td><span style="display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:700;${rStyle}">${escHtml(s.riskLevel)}</span></td>
            <td style="text-align:center;">${pct}</td>
            <td style="text-align:center;">${s.focusLostCount ?? '—'}</td>
            <td style="white-space:nowrap;font-size:9pt;">${fmtDate(s.createdAt)}</td>
            <td style="font-size:9pt;color:#6b7280;">${s.lastReviewAction ? `${escHtml(s.lastReviewAction)}${s.lastReviewerName ? ` — ${escHtml(s.lastReviewerName)}` : ''}` : 'Pending'}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  const casesHtml = data.patternCases.length === 0
    ? '<p class="text-muted">No pattern cases recorded.</p>'
    : `<table>
      <thead>
        <tr>
          <th>Student</th>
          <th style="width:80pt;">Status</th>
          <th style="width:60pt;">Triggers</th>
          <th style="width:60pt;">Subjects</th>
          <th style="width:70pt;">Opened</th>
          <th>Notes / Escalation</th>
        </tr>
      </thead>
      <tbody>
        ${data.patternCases.map(c => {
          const cStyle = CASE_STATUS_STYLE[c.status] ?? CASE_STATUS_STYLE.OPEN
          const note = c.notes
            ? escHtml(c.notes.slice(0, 80)) + (c.notes.length > 80 ? '…' : '')
            : ''
          const escalation = c.escalatedAt
            ? `Escalated ${fmtDate(c.escalatedAt)}${c.escalatedByName ? ` by ${escHtml(c.escalatedByName)}` : ''}`
            : ''
          return `<tr>
            <td style="font-weight:600;">${escHtml(c.studentName)}</td>
            <td><span style="display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:700;${cStyle}">${escHtml(c.status)}</span></td>
            <td style="text-align:center;">${c.triggerCount}</td>
            <td style="text-align:center;">${c.subjectCount}</td>
            <td style="white-space:nowrap;font-size:9pt;">${fmtDate(c.openedAt)}</td>
            <td style="font-size:9pt;color:#6b7280;">${escalation || note || '—'}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  const body = `
    <h1>Academic Integrity Report</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      ${escHtml(data.schoolName)} · ${escHtml(data.reportScope)} · Generated ${fmtDate(data.generatedAt)}
    </p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10pt;margin-bottom:16pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Total Signals</p>
        <p style="font-size:20pt;font-weight:700;color:#374151;margin:0;">${data.signals.length}</p>
      </div>
      <div class="card card-red">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">High Risk</p>
        <p style="font-size:20pt;font-weight:700;color:#dc2626;margin:0;">${highCount}</p>
      </div>
      <div class="card card-amber">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Open Cases</p>
        <p style="font-size:20pt;font-weight:700;color:#d97706;margin:0;">${openCases}</p>
      </div>
      <div class="card card-red">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Escalated</p>
        <p style="font-size:20pt;font-weight:700;color:#dc2626;margin:0;">${escalated}</p>
      </div>
    </div>

    <h2>Integrity Signals</h2>
    ${signalsHtml}

    <h2>Pattern Cases</h2>
    ${casesHtml}
  `

  return pdfShell(body, 'Academic Integrity Report', data.schoolName)
}
