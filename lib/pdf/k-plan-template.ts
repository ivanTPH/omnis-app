import { pdfShell, escHtml } from './templates'

export type KPlanPdfData = {
  studentName:       string
  yearGroup:         number | null
  sendCategory:      string
  schoolName:        string
  approvedAt:        Date | null
  approvedByName:    string | null
  reviewDate:        Date | null
  sendInformation:   string
  teacherActions:    string[]
  studentCommitments: string[]
}

export function kPlanPdf(data: KPlanPdfData): string {
  const approvedLine = data.approvedAt
    ? `Approved ${data.approvedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${data.approvedByName ? ` by ${escHtml(data.approvedByName)}` : ''}`
    : 'Awaiting SENCO approval'

  const reviewLine = data.reviewDate
    ? `Review due: ${data.reviewDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : ''

  const teacherList = data.teacherActions.map(a =>
    `<li style="margin-bottom:6pt;">${escHtml(a)}</li>`
  ).join('')

  const studentList = data.studentCommitments.map(c =>
    `<li style="margin-bottom:6pt;">${escHtml(c)}</li>`
  ).join('')

  const body = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; max-width: 100%;">

  <!-- Header -->
  <div style="background: #1e3a5f; color: white; padding: 16pt 20pt; border-radius: 8pt 8pt 0 0; margin-bottom: 0;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8pt;">
      <div>
        <div style="font-size: 9pt; text-transform: uppercase; letter-spacing: 1pt; color: #93c5fd; margin-bottom: 2pt;">K Plan — Learning Passport</div>
        <div style="font-size: 20pt; font-weight: 700;">${escHtml(data.studentName)}</div>
        <div style="font-size: 11pt; color: #bfdbfe; margin-top: 2pt;">
          ${data.yearGroup ? `Year ${data.yearGroup} &nbsp;·&nbsp; ` : ''}${escHtml(data.sendCategory)}
        </div>
      </div>
      <div style="text-align: right; font-size: 9pt; color: #93c5fd; line-height: 1.6;">
        <div style="font-weight: 600; color: #e0f2fe;">${escHtml(data.schoolName)}</div>
        <div>${approvedLine}</div>
        ${reviewLine ? `<div>${escHtml(reviewLine)}</div>` : ''}
      </div>
    </div>
  </div>

  <!-- Three columns -->
  <table style="width: 100%; border-collapse: collapse; margin-top: 0;">
    <tr>
      <!-- Column 1: SEND Information -->
      <td style="width: 32%; vertical-align: top; padding: 0; border: none;">
        <div style="background: #eff6ff; border: 2pt solid #3b82f6; border-top: 4pt solid #2563eb; border-radius: 0 0 6pt 6pt; padding: 12pt 14pt; min-height: 400pt;">
          <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: #2563eb; margin-bottom: 8pt;">SEND Information</div>
          <p style="font-size: 10pt; line-height: 1.7; color: #1e3a5f;">${escHtml(data.sendInformation).replace(/\n/g, '<br/>')}</p>
        </div>
      </td>

      <td style="width: 4pt; border: none;"></td>

      <!-- Column 2: It would help me if you could -->
      <td style="width: 32%; vertical-align: top; padding: 0; border: none;">
        <div style="background: #faf5ff; border: 2pt solid #a855f7; border-top: 4pt solid #7c3aed; border-radius: 0 0 6pt 6pt; padding: 12pt 14pt; min-height: 400pt;">
          <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: #7c3aed; margin-bottom: 8pt;">It would help me if you could</div>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 10pt; color: #2d1b69;">
            ${teacherList}
          </ul>
        </div>
      </td>

      <td style="width: 4pt; border: none;"></td>

      <!-- Column 3: I will help myself by -->
      <td style="width: 32%; vertical-align: top; padding: 0; border: none;">
        <div style="background: #f0fdf4; border: 2pt solid #22c55e; border-top: 4pt solid #16a34a; border-radius: 0 0 6pt 6pt; padding: 12pt 14pt; min-height: 400pt;">
          <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1pt; color: #16a34a; margin-bottom: 8pt;">I will help myself by</div>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 10pt; color: #14532d;">
            ${studentList}
          </ul>
        </div>
      </td>
    </tr>
  </table>

  <!-- Footer note -->
  <div style="margin-top: 16pt; padding: 8pt 12pt; background: #f8fafc; border: 1pt solid #e2e8f0; border-radius: 4pt; font-size: 8pt; color: #64748b;">
    This Learning Passport is a confidential SEND support document. It should be read before teaching ${escHtml(data.studentName.split(' ')[0])} and kept on file. Contact the SENCO with any queries.
  </div>
</div>`

  return pdfShell(body, `K Plan — ${data.studentName}`, data.schoolName)
}
