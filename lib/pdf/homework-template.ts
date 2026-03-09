import { pdfShell, escHtml } from './templates'

export type HomeworkPdfData = {
  title:        string
  subject:      string
  instructions: string
  type:         string
  setAt:        Date
  dueAt:        Date
  schoolName:   string
  className?:   string | null
  questions: {
    order:       number
    text:        string
    marks?:      number | null
    options?:    string[] | null
    rubric?:     string | null
  }[]
}

export function homeworkSheetPdf(hw: HomeworkPdfData): string {
  const setDate = new Date(hw.setAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const dueDate = new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const typeLabel = hw.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const questionBlocks = hw.questions.map((q, i) => {
    const isMcq = (q.options?.length ?? 0) > 0

    const optionsList = isMcq && q.options
      ? `<ul style="list-style:none;padding-left:0;margin-top:6pt;">
          ${q.options!.map((opt, idx) => `
            <li style="margin-bottom:4pt;">
              <span style="display:inline-block;width:16pt;height:16pt;border:1.5pt solid #374151;border-radius:50%;margin-right:8pt;vertical-align:middle;"></span>
              ${escHtml(String.fromCharCode(65 + idx))}) ${escHtml(opt)}
            </li>`).join('')}
        </ul>`
      : ''

    const workingSpace = !isMcq ? `
      <div style="border:0.5pt solid #d1d5db;border-radius:4pt;min-height:${hw.type === 'EXTENDED_WRITING' ? '120pt' : '50pt'};margin-top:8pt;background:#fafafa;padding:6pt;">
        <p class="text-muted text-sm" style="margin:0;">Your answer:</p>
      </div>` : ''

    return `
      <div class="card" style="margin-bottom:12pt;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8pt;">
          <h3 style="margin:0;">Question ${i + 1}${q.marks ? ` <span class="text-muted text-sm">[${q.marks} mark${q.marks !== 1 ? 's' : ''}]</span>` : ''}</h3>
        </div>
        <p style="margin-top:5pt;">${escHtml(q.text)}</p>
        ${optionsList}
        ${workingSpace}
      </div>`
  }).join('')

  const noQuestionsBlock = hw.questions.length === 0 ? `
    <div class="card">
      <p>${escHtml(hw.instructions)}</p>
      <div style="border:0.5pt solid #d1d5db;border-radius:4pt;min-height:120pt;margin-top:10pt;background:#fafafa;padding:8pt;">
        <p class="text-muted text-sm" style="margin:0;">Your answer:</p>
      </div>
    </div>` : ''

  const content = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14pt;">
      <div>
        <h1>${escHtml(hw.title)}</h1>
        <p class="meta">${escHtml(hw.subject)}${hw.className ? ` · ${escHtml(hw.className)}` : ''}</p>
      </div>
      <div style="text-align:right;">
        <p class="meta">Set: <strong>${escHtml(setDate)}</strong></p>
        <p class="meta">Due: <strong>${escHtml(dueDate)}</strong></p>
        <span class="badge">${escHtml(typeLabel)}</span>
      </div>
    </div>

    <div class="card card-blue" style="margin-bottom:14pt;">
      <h3 style="margin-bottom:4pt;">Instructions</h3>
      <p>${escHtml(hw.instructions)}</p>
    </div>

    <div style="margin-bottom:10pt;display:flex;gap:12pt;">
      <div style="flex:1;border:0.5pt dashed #d1d5db;border-radius:4pt;padding:6pt 10pt;">
        <p class="text-sm text-muted" style="margin-bottom:2pt;">Student Name</p>
        <div style="height:14pt;border-bottom:0.5pt solid #d1d5db;"></div>
      </div>
      <div style="flex:1;border:0.5pt dashed #d1d5db;border-radius:4pt;padding:6pt 10pt;">
        <p class="text-sm text-muted" style="margin-bottom:2pt;">Date Submitted</p>
        <div style="height:14pt;border-bottom:0.5pt solid #d1d5db;"></div>
      </div>
    </div>

    ${hw.questions.length > 0 ? questionBlocks : noQuestionsBlock}`

  return pdfShell(
    content,
    `${hw.subject} Homework — ${hw.title}`,
    hw.schoolName,
  )
}
