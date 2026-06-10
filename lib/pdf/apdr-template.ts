import { pdfShell, escHtml } from './templates'

export type ApdrPdfData = {
  studentName:   string
  yearGroup:     number | null
  sendCategory:  string
  schoolName:    string
  cycleNumber:   number
  reviewDate:    Date
  completedAt:   Date | null
  approvedBySenco: boolean
  approvedAt:    Date | null
  approvedByName: string | null
  createdByName: string | null
  assessContent: string
  planContent:   string
  doContent:     string
  reviewContent: string
  outcomeRating: string
  parentComments: string
}

const OUTCOME_LABELS: Record<string, string> = {
  GOOD_PROGRESS: 'Making Good Progress',
  SOME_PROGRESS: 'Making Some Progress',
  INSUFFICIENT:  'Insufficient Progress',
  NO_PROGRESS:   'No Progress Made',
}

function section(title: string, content: string, colorClass = 'card'): string {
  if (!content.trim()) return ''
  const paragraphs = content.split('\n').filter(l => l.trim()).map(l => `<p>${escHtml(l)}</p>`).join('')
  return `
    <h2>${escHtml(title)}</h2>
    <div class="${colorClass}">${paragraphs}</div>
  `
}

export function apdrPdf(data: ApdrPdfData): string {
  const now   = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

  const outcomeLabel  = OUTCOME_LABELS[data.outcomeRating] ?? ''
  const outcomeColor  = data.outcomeRating === 'GOOD_PROGRESS' ? 'card-green'
                      : data.outcomeRating === 'SOME_PROGRESS' ? 'card-blue'
                      : data.outcomeRating === 'INSUFFICIENT'  ? 'card-amber'
                      : data.outcomeRating === 'NO_PROGRESS'   ? 'card-red'
                      : ''

  const body = `
    <h1>APDR Cycle ${data.cycleNumber} — ${escHtml(data.studentName)}</h1>
    <p style="color:#6b7280; font-size:10pt; margin-bottom:6pt;">
      Assess · Plan · Do · Review — Statutory SEND Review Record
    </p>

    <table style="margin-bottom:16pt; font-size:10pt;">
      <tr>
        <td style="width:160pt; font-weight:600; color:#374151; border:none; padding:3pt 0;">School</td>
        <td style="border:none; padding:3pt 0;">${escHtml(data.schoolName)}</td>
        <td style="width:160pt; font-weight:600; color:#374151; border:none; padding:3pt 0;">Student</td>
        <td style="border:none; padding:3pt 0;">${escHtml(data.studentName)}${data.yearGroup != null ? `, Year ${data.yearGroup}` : ''}</td>
      </tr>
      <tr>
        <td style="font-weight:600; color:#374151; border:none; padding:3pt 0;">SEND Category</td>
        <td style="border:none; padding:3pt 0;">${escHtml(data.sendCategory)}</td>
        <td style="font-weight:600; color:#374151; border:none; padding:3pt 0;">Review date</td>
        <td style="border:none; padding:3pt 0;">${fmtDate(data.reviewDate)}</td>
      </tr>
      <tr>
        <td style="font-weight:600; color:#374151; border:none; padding:3pt 0;">SENCO approval</td>
        <td style="border:none; padding:3pt 0;">${data.approvedBySenco ? `${fmtDate(data.approvedAt)}${data.approvedByName ? ` by ${escHtml(data.approvedByName)}` : ''}` : 'Pending'}</td>
        <td style="font-weight:600; color:#374151; border:none; padding:3pt 0;">Completed</td>
        <td style="border:none; padding:3pt 0;">${fmtDate(data.completedAt)}</td>
      </tr>
    </table>

    ${section('1. Assess', data.assessContent)}
    ${section('2. Plan', data.planContent)}
    ${section('3. Do — Observations &amp; Interventions', data.doContent)}
    ${section('4. Review', data.reviewContent)}

    ${outcomeLabel ? `
      <h2>Outcome</h2>
      <div class="${outcomeColor} card" style="margin-bottom:10pt;">
        <p style="font-size:12pt; font-weight:700;">${escHtml(outcomeLabel)}</p>
      </div>
    ` : ''}

    ${data.parentComments.trim() ? `
      <h2>Parent / Carer Comments</h2>
      <div class="card">
        ${data.parentComments.split('\n').filter(l => l.trim()).map(l => `<p>${escHtml(l)}</p>`).join('')}
      </div>
    ` : ''}

    <p style="color:#9ca3af; font-size:8pt; margin-top:20pt; text-align:right;">
      Generated ${now} · Omnis School Platform · Confidential — For school use only
    </p>
  `

  return pdfShell(body, `APDR Cycle ${data.cycleNumber} — ${data.studentName}`, data.schoolName)
}
