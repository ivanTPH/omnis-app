import { pdfShell, escHtml } from './templates'

export type EarlyWarningFlagRow = {
  studentName: string
  yearGroup:   number | null
  flagType:    string
  severity:    string
  description: string
  createdAt:   Date
  expiresAt:   Date
  isActioned:  boolean
  actionType:  string | null
  actionedByName: string | null
}

export type EarlyWarningReportData = {
  schoolName:  string
  generatedAt: Date
  flags:       EarlyWarningFlagRow[]
}

const FLAG_TYPE_LABELS: Record<string, string> = {
  homework_decline:  'Homework Decline',
  completion_drop:   'Completion Drop',
  score_decline:     'Score Decline',
  pattern_absence:   'Attendance Pattern',
  multiple_concerns: 'Multiple Concerns',
}

const SEVERITY_STYLE: Record<string, string> = {
  high:   'background:#fee2e2;color:#991b1b',
  medium: 'background:#fffbeb;color:#92400e',
  low:    'background:#f3f4f6;color:#374151',
}

export function earlyWarningReportPdf(data: EarlyWarningReportData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const activeFlags    = data.flags.filter(f => !f.isActioned)
  const actionedFlags  = data.flags.filter(f => f.isActioned)
  const highCount      = activeFlags.filter(f => f.severity === 'high').length
  const mediumCount    = activeFlags.filter(f => f.severity === 'medium').length

  // Group active flags by type
  const byType = new Map<string, EarlyWarningFlagRow[]>()
  for (const f of activeFlags) {
    if (!byType.has(f.flagType)) byType.set(f.flagType, [])
    byType.get(f.flagType)!.push(f)
  }

  const renderFlagTable = (flags: EarlyWarningFlagRow[]) => `<table>
    <thead>
      <tr>
        <th>Student</th>
        <th style="width:40pt;">Year</th>
        <th style="width:70pt;">Severity</th>
        <th>Description</th>
        <th style="width:65pt;">Flagged</th>
        <th style="width:65pt;">Expires</th>
        ${flags.some(f => f.isActioned) ? '<th>Action</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${flags.map(f => {
        const sevStyle = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.low
        const actionCell = f.isActioned
          ? `<td style="font-size:9pt;color:#6b7280;">${escHtml(f.actionType ?? '—')}${f.actionedByName ? ` — ${escHtml(f.actionedByName)}` : ''}</td>`
          : ''
        return `<tr>
          <td style="font-weight:600;">${escHtml(f.studentName)}</td>
          <td style="text-align:center;">${f.yearGroup ?? '—'}</td>
          <td><span style="display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:700;${sevStyle}">${f.severity.toUpperCase()}</span></td>
          <td style="font-size:9pt;">${escHtml(f.description)}</td>
          <td style="font-size:9pt;white-space:nowrap;">${fmtDate(f.createdAt)}</td>
          <td style="font-size:9pt;white-space:nowrap;color:#6b7280;">${fmtDate(f.expiresAt)}</td>
          ${actionCell}
        </tr>`
      }).join('')}
    </tbody>
  </table>`

  const activeSections = [...byType.entries()].map(([type, flags]) => `
    <h3>${escHtml(FLAG_TYPE_LABELS[type] ?? type)} (${flags.length})</h3>
    ${renderFlagTable(flags)}
  `).join('')

  const body = `
    <h1>Early Warning Report</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      ${escHtml(data.schoolName)} · Generated ${fmtDate(data.generatedAt)}
    </p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:14pt;">
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Total Active</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${activeFlags.length}</p>
      </div>
      <div class="card card-red">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">High Severity</p>
        <p style="font-size:18pt;font-weight:700;color:#dc2626;margin:0;">${highCount}</p>
      </div>
      <div class="card card-amber">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Medium Severity</p>
        <p style="font-size:18pt;font-weight:700;color:#d97706;margin:0;">${mediumCount}</p>
      </div>
      <div class="card">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Actioned</p>
        <p style="font-size:18pt;font-weight:700;color:#374151;margin:0;">${actionedFlags.length}</p>
      </div>
    </div>

    <h2>Active Flags by Type</h2>
    ${activeFlags.length === 0
      ? '<p class="text-muted">No active early warning flags.</p>'
      : activeSections}

    ${actionedFlags.length > 0 ? `
    <h2>Actioned Flags</h2>
    ${renderFlagTable(actionedFlags)}
    ` : ''}
  `

  return pdfShell(body, 'Early Warning Report', data.schoolName)
}
