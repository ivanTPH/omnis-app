import { pdfShell, escHtml } from './templates'

export type WelfareAlertRow = {
  studentName: string
  yearGroup:   number | null
  alerts:      string[]
  riskLevel:   'urgent' | 'monitor'
  sendStatus:  string | null
}

export type WelfareConcernRow = {
  studentName: string
  category:    string
  status:      string
  daysOpen:    number
  raiserName:  string
  description: string
}

export type WelfareFlagRow = {
  studentName: string
  flagType:    string
  severity:    string
  description: string
  daysActive:  number
}

export type WelfareIlpRow = {
  studentName:  string
  reviewDate:   string
  daysUntil:    number
  sendCategory: string
}

export type WelfareReportData = {
  schoolName:               string
  yearGroup:                number | null
  totalStudents:            number
  studentsNeedingAttention: number
  openConcernsCount:        number
  highFlagsCount:           number
  missedHwStudentsCount:    number
  ilpReviewsDue14d:         number
  alerts:                   WelfareAlertRow[]
  concerns:                 WelfareConcernRow[]
  flags:                    WelfareFlagRow[]
  ilpReviews:               WelfareIlpRow[]
}

const SEVERITY_STYLE: Record<string, string> = {
  high:   'color:#dc2626;font-weight:700',
  medium: 'color:#d97706;font-weight:600',
  low:    'color:#6b7280',
}

export function welfareReportPdf(d: WelfareReportData): string {
  const scope = d.yearGroup ? `Year ${d.yearGroup}` : 'All Year Groups'

  const statsHtml = `
    <div class="two-col" style="margin-bottom:14pt">
      <div class="card card-red">
        <div style="font-size:20pt;font-weight:700;color:#dc2626">${d.studentsNeedingAttention}</div>
        <div class="meta">Students needing attention</div>
      </div>
      <div class="card card-amber">
        <div style="font-size:20pt;font-weight:700;color:#d97706">${d.openConcernsCount}</div>
        <div class="meta">Open SEND concerns</div>
      </div>
      <div class="card card-red">
        <div style="font-size:20pt;font-weight:700;color:#dc2626">${d.highFlagsCount}</div>
        <div class="meta">High-severity flags</div>
      </div>
      <div class="card card-amber">
        <div style="font-size:20pt;font-weight:700;color:#d97706">${d.missedHwStudentsCount}</div>
        <div class="meta">Missed homework (3+)</div>
      </div>
      <div class="card card-blue">
        <div style="font-size:20pt;font-weight:700;color:#2563eb">${d.ilpReviewsDue14d}</div>
        <div class="meta">ILP reviews due ≤14 days</div>
      </div>
      <div class="card">
        <div style="font-size:20pt;font-weight:700;color:#374151">${d.totalStudents}</div>
        <div class="meta">Total students (${scope})</div>
      </div>
    </div>`

  // Students needing attention
  const alertsHtml = d.alerts.length === 0
    ? '<p class="text-muted">No students currently flagged for attention.</p>'
    : `<table>
        <thead><tr>
          <th>Student</th><th>Year</th><th>Risk</th><th>SEND</th><th>Alerts</th>
        </tr></thead>
        <tbody>
          ${d.alerts.map(a => `
            <tr>
              <td>${escHtml(a.studentName)}</td>
              <td>${a.yearGroup ?? '—'}</td>
              <td style="${a.riskLevel === 'urgent' ? 'color:#dc2626;font-weight:700' : 'color:#d97706'}">${a.riskLevel === 'urgent' ? 'Urgent' : 'Monitor'}</td>
              <td>${a.sendStatus ? escHtml(a.sendStatus.replace('_', ' ')) : '—'}</td>
              <td>${a.alerts.map(escHtml).join(' · ')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`

  // Open concerns
  const concernsHtml = d.concerns.length === 0
    ? '<p class="text-muted">No open concerns.</p>'
    : `<table>
        <thead><tr>
          <th>Student</th><th>Category</th><th>Status</th><th>Days Open</th><th>Raised By</th><th>Description</th>
        </tr></thead>
        <tbody>
          ${d.concerns.map(c => `
            <tr>
              <td>${escHtml(c.studentName)}</td>
              <td>${escHtml(c.category)}</td>
              <td>${escHtml(c.status.replace(/_/g, ' '))}</td>
              <td style="${c.daysOpen >= 30 ? 'color:#dc2626;font-weight:600' : ''}">${c.daysOpen}d</td>
              <td>${escHtml(c.raiserName)}</td>
              <td class="text-sm">${escHtml(c.description.slice(0, 100))}${c.description.length > 100 ? '…' : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>`

  // Active flags
  const flagsHtml = d.flags.length === 0
    ? '<p class="text-muted">No active early warning flags.</p>'
    : `<table>
        <thead><tr>
          <th>Student</th><th>Flag Type</th><th>Severity</th><th>Days Active</th><th>Description</th>
        </tr></thead>
        <tbody>
          ${d.flags.map(f => `
            <tr>
              <td>${escHtml(f.studentName)}</td>
              <td>${escHtml(f.flagType.replace(/_/g, ' '))}</td>
              <td style="${SEVERITY_STYLE[f.severity] ?? ''}">${escHtml(f.severity)}</td>
              <td>${f.daysActive}d</td>
              <td class="text-sm">${escHtml(f.description.slice(0, 120))}${f.description.length > 120 ? '…' : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>`

  // ILP reviews due
  const ilpHtml = d.ilpReviews.length === 0
    ? '<p class="text-muted">No ILP reviews due in the next 14 days.</p>'
    : `<table>
        <thead><tr>
          <th>Student</th><th>SEND Category</th><th>Review Date</th><th>Days Until</th>
        </tr></thead>
        <tbody>
          ${d.ilpReviews.map(r => `
            <tr>
              <td>${escHtml(r.studentName)}</td>
              <td>${escHtml(r.sendCategory)}</td>
              <td>${new Date(r.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td style="${r.daysUntil <= 3 ? 'color:#dc2626;font-weight:700' : r.daysUntil <= 7 ? 'color:#d97706;font-weight:600' : ''}">${r.daysUntil}d</td>
            </tr>`).join('')}
        </tbody>
      </table>`

  const content = `
    <h1>Pastoral Welfare Report</h1>
    <p class="meta">${escHtml(d.schoolName)} · ${scope} · ${d.totalStudents} students</p>
    <hr class="divider">

    ${statsHtml}

    <h2>Students Needing Attention</h2>
    ${alertsHtml}

    <h2>Open SEND Concerns</h2>
    ${concernsHtml}

    <h2>Active Early Warning Flags</h2>
    ${flagsHtml}

    <h2>ILP Reviews Due (≤14 days)</h2>
    ${ilpHtml}
  `

  return pdfShell(content, 'Pastoral Welfare Report', d.schoolName)
}
