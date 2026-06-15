import { pdfShell, escHtml } from './templates'

const SECTION_LABELS: Record<string, string> = {
  A:  'Section A — Views, interests and aspirations of child and parents',
  B:  'Section B — Special educational needs',
  C:  'Section C — Health needs related to SEN',
  D:  'Section D — Social care needs related to SEN',
  E:  'Section E — Outcomes',
  F:  'Section F — Special educational provision',
  G:  'Section G — Health provision',
  H1: 'Section H1 — Social care provision (statutory)',
  H2: 'Section H2 — Other social care provision',
  I:  'Section I — School and other placement',
  J:  'Section J — Personal budget',
  K:  'Section K — Appendices',
}

const OUTCOME_STATUS_STYLE: Record<string, string> = {
  active:             'background:#dbeafe;color:#1d4ed8',
  achieved:           'background:#d1fae5;color:#065f46',
  partially_achieved: 'background:#fffbeb;color:#92400e',
  not_achieved:       'background:#fee2e2;color:#991b1b',
}

export type EhcpPlanPdfOutcome = {
  section:          string
  outcomeText:      string
  successCriteria:  string
  provisionRequired?: string | null
  targetDate:       Date
  status:           string
}

export type EhcpPlanPdfData = {
  studentName:      string
  yearGroup:        number | null
  tutorGroup?:      string | null
  schoolName:       string
  localAuthority:   string
  coordinatorName?: string | null
  planDate:         Date
  reviewDate:       Date
  status:           string
  approvedBySenco:  boolean
  approvedAt?:      Date | null
  sections:         Record<string, string | null>
  outcomes:         EhcpPlanPdfOutcome[]
}

export function ehcpPlanPdf(data: EhcpPlanPdfData): string {
  const fmtDate = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const statusStyle = data.status === 'active'
    ? 'background:#d1fae5;color:#065f46'
    : data.status === 'under_review'
    ? 'background:#fffbeb;color:#92400e'
    : 'background:#f3f4f6;color:#6b7280'
  const statusLabel = data.status === 'active' ? 'Active'
    : data.status === 'under_review' ? 'Under Review'
    : data.status === 'ceased' ? 'Ceased'
    : data.status

  // Section content blocks
  const sectionKeys = ['A','B','C','D','E','F','G','H1','H2','I','J','K'] as const
  const sectionsHtml = sectionKeys.map(key => {
    const content = data.sections[key]
    if (!content?.trim()) return ''
    const paragraphs = content.split('\n').filter(l => l.trim()).map(l => `<p>${escHtml(l)}</p>`).join('')
    return `
      <h2>${escHtml(SECTION_LABELS[key])}</h2>
      <div class="card">${paragraphs}</div>
    `
  }).filter(Boolean).join('')

  // Outcomes table
  const outcomesHtml = data.outcomes.length === 0 ? '' : `
    <h2>${escHtml(SECTION_LABELS['E'])}</h2>
    <table>
      <thead>
        <tr>
          <th style="width:50pt;">Section</th>
          <th>Outcome</th>
          <th>Success Criteria</th>
          <th>Provision Required</th>
          <th style="width:70pt;">Target Date</th>
          <th style="width:90pt;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.outcomes.map(o => {
          const style = OUTCOME_STATUS_STYLE[o.status] ?? 'background:#f3f4f6;color:#374151'
          return `<tr>
            <td style="font-weight:700;color:#6d28d9;">${escHtml(o.section)}</td>
            <td>${escHtml(o.outcomeText)}</td>
            <td style="font-size:9pt;color:#6b7280;">${escHtml(o.successCriteria)}</td>
            <td style="font-size:9pt;color:#6b7280;">${escHtml(o.provisionRequired ?? '—')}</td>
            <td style="white-space:nowrap;">${fmtDate(o.targetDate)}</td>
            <td><span style="display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600;${style}">${escHtml(o.status.replace(/_/g, ' '))}</span></td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  `

  const body = `
    <h1>Education, Health and Care Plan</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:6pt;">
      Issued under the Children and Families Act 2014 — confidential SEND document
    </p>

    <table style="margin-bottom:16pt;font-size:10pt;">
      <tr>
        <td style="width:140pt;font-weight:600;color:#374151;border:none;padding:3pt 0;">Child's Name</td>
        <td style="border:none;padding:3pt 0;">${escHtml(data.studentName)}${data.yearGroup ? ` · Year ${data.yearGroup}` : ''}${data.tutorGroup ? ` · ${data.tutorGroup}` : ''}</td>
        <td style="width:140pt;font-weight:600;color:#374151;border:none;padding:3pt 0;">Plan Status</td>
        <td style="border:none;padding:3pt 0;">
          <span style="display:inline-block;padding:1pt 8pt;border-radius:4pt;font-size:9pt;font-weight:700;${statusStyle}">${escHtml(statusLabel)}</span>
        </td>
      </tr>
      <tr>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">School</td>
        <td style="border:none;padding:3pt 0;">${escHtml(data.schoolName)}</td>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">Plan Date</td>
        <td style="border:none;padding:3pt 0;">${fmtDate(data.planDate)}</td>
      </tr>
      <tr>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">Local Authority</td>
        <td style="border:none;padding:3pt 0;">${escHtml(data.localAuthority)}</td>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">Review Date</td>
        <td style="border:none;padding:3pt 0;">${fmtDate(data.reviewDate)}</td>
      </tr>
      ${data.coordinatorName ? `<tr>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">SEND Coordinator</td>
        <td colspan="3" style="border:none;padding:3pt 0;">${escHtml(data.coordinatorName)}</td>
      </tr>` : ''}
      <tr>
        <td style="font-weight:600;color:#374151;border:none;padding:3pt 0;">SENCO Approved</td>
        <td colspan="3" style="border:none;padding:3pt 0;">${data.approvedBySenco
          ? `<span style="color:#16a34a;font-weight:700;">✓ Approved${data.approvedAt ? ` on ${fmtDate(data.approvedAt)}` : ''}</span>`
          : '<span style="color:#d97706;">Pending SENCO sign-off</span>'}</td>
      </tr>
    </table>

    ${outcomesHtml}
    ${sectionsHtml}

    <p style="margin-top:24pt;font-size:8pt;color:#9ca3af;border-top:0.5pt solid #e5e7eb;padding-top:6pt;">
      Generated by Omnis · ${escHtml(data.schoolName)} · ${fmtDate(new Date())} ·
      This document contains Special Category data under UK GDPR Article 9. Handle in accordance with your school's data protection policy.
    </p>
  `

  return pdfShell(body, `EHCP Plan — ${data.studentName}`, data.schoolName)
}
