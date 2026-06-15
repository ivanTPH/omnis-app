import { pdfShell, escHtml } from './templates'

export type ConcernsReportCategoryCount = {
  category: string
  count:     number
}

export type ConcernsReportYearGroup = {
  yearGroup:  number | null
  open:       number
  underReview: number
  escalated:  number
  categories: ConcernsReportCategoryCount[]
}

export type ConcernsReportData = {
  schoolName:   string
  generatedAt:  Date
  totalOpen:    number
  totalReview:  number
  totalEscalated: number
  yearGroups:   ConcernsReportYearGroup[]
}

const CATEGORY_LABELS: Record<string, string> = {
  literacy:         'Literacy',
  numeracy:         'Numeracy',
  behaviour:        'Behaviour',
  attendance:       'Attendance',
  social_emotional: 'Social & Emotional',
  communication:    'Communication',
  physical:         'Physical',
  sensory:          'Sensory',
  other:            'Other',
}

export function concernsReportPdf(data: ConcernsReportData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const yearGroupsHtml = data.yearGroups.length === 0
    ? '<p class="text-muted">No open or under-review concerns recorded.</p>'
    : data.yearGroups.map(yg => {
        const total = yg.open + yg.underReview + yg.escalated
        const catBadges = yg.categories.map(c =>
          `<span style="display:inline-block;padding:1pt 6pt;border-radius:3pt;font-size:8pt;font-weight:600;background:#f3f4f6;color:#374151;margin:1pt 2pt 1pt 0;">${escHtml(CATEGORY_LABELS[c.category] ?? c.category)} (${c.count})</span>`
        ).join('')
        return `
          <div class="card" style="margin-bottom:10pt;page-break-inside:avoid;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6pt;">
              <p style="font-weight:700;font-size:12pt;color:#1e3a5f;margin:0;">
                ${yg.yearGroup != null ? `Year ${yg.yearGroup}` : 'Unassigned'}
              </p>
              <span style="font-size:10pt;font-weight:600;color:#374151;">${total} total</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6pt;margin-bottom:8pt;">
              <div style="background:#fee2e2;padding:6pt 10pt;border-radius:6pt;text-align:center;">
                <p style="font-size:8pt;color:#991b1b;margin:0;">Open</p>
                <p style="font-size:14pt;font-weight:700;color:#dc2626;margin:0;">${yg.open}</p>
              </div>
              <div style="background:#dbeafe;padding:6pt 10pt;border-radius:6pt;text-align:center;">
                <p style="font-size:8pt;color:#1d4ed8;margin:0;">Under Review</p>
                <p style="font-size:14pt;font-weight:700;color:#2563eb;margin:0;">${yg.underReview}</p>
              </div>
              <div style="background:#fef3c7;padding:6pt 10pt;border-radius:6pt;text-align:center;">
                <p style="font-size:8pt;color:#92400e;margin:0;">Escalated</p>
                <p style="font-size:14pt;font-weight:700;color:#d97706;margin:0;">${yg.escalated}</p>
              </div>
            </div>
            ${yg.categories.length > 0 ? `<div>${catBadges}</div>` : ''}
          </div>`
      }).join('')

  const body = `
    <h1>SEND Concerns Summary Report</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      ${escHtml(data.schoolName)} · Generated ${fmtDate(data.generatedAt)}
    </p>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10pt;margin-bottom:16pt;">
      <div class="card card-red">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Open Concerns</p>
        <p style="font-size:20pt;font-weight:700;color:#dc2626;margin:0;">${data.totalOpen}</p>
      </div>
      <div class="card card-blue">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Under Review</p>
        <p style="font-size:20pt;font-weight:700;color:#2563eb;margin:0;">${data.totalReview}</p>
      </div>
      <div class="card card-amber">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Escalated</p>
        <p style="font-size:20pt;font-weight:700;color:#d97706;margin:0;">${data.totalEscalated}</p>
      </div>
    </div>

    <h2>Breakdown by Year Group</h2>
    ${yearGroupsHtml}
  `

  return pdfShell(body, 'SEND Concerns Report', data.schoolName)
}
