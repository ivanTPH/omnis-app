import { pdfShell, escHtml } from './templates'

export type LessonPdfData = {
  title:       string
  topic?:      string | null
  objectives:  string[]
  scheduledAt: Date | null
  schoolName:  string
  class?: {
    name:      string
    subject:   string
    yearGroup: number
    department:string
  } | null
  resources: {
    type:  string
    label: string
    url?:  string | null
  }[]
  homework: {
    title:       string
    type:        string
    dueAt:       Date
    instructions:string
  }[]
}

export function lessonPlanPdf(lesson: LessonPdfData): string {
  const dateStr = lesson.scheduledAt
    ? new Date(lesson.scheduledAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date TBC'

  const resourcesByType: Record<string, typeof lesson.resources> = {}
  for (const r of lesson.resources) {
    if (!resourcesByType[r.type]) resourcesByType[r.type] = []
    resourcesByType[r.type].push(r)
  }

  const hwRows = lesson.homework.map(hw => `
    <tr>
      <td>${escHtml(hw.title)}</td>
      <td><span class="badge">${escHtml(hw.type.replace(/_/g, ' '))}</span></td>
      <td>${new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td class="text-sm">${escHtml(hw.instructions.slice(0, 120))}${hw.instructions.length > 120 ? '…' : ''}</td>
    </tr>`).join('')

  const resourceRows = lesson.resources.map(r => `
    <tr>
      <td><span class="badge">${escHtml(r.type)}</span></td>
      <td>${escHtml(r.label)}</td>
      <td class="text-sm text-muted">${r.url ? escHtml(r.url.slice(0, 60)) + (r.url.length > 60 ? '…' : '') : 'Uploaded file'}</td>
    </tr>`).join('')

  const content = `
    <h1>${escHtml(lesson.title)}</h1>
    ${lesson.topic ? `<p class="meta">Topic: ${escHtml(lesson.topic)}</p>` : ''}

    ${lesson.class ? `
    <div class="two-col" style="margin-top:12pt;margin-bottom:12pt;">
      <div class="card">
        <p class="text-sm text-muted">Class</p>
        <p style="font-weight:600;">${escHtml(lesson.class.name)}</p>
        <p class="text-sm text-muted">Year ${lesson.class.yearGroup} · ${escHtml(lesson.class.subject)}</p>
      </div>
      <div class="card">
        <p class="text-sm text-muted">Lesson Date</p>
        <p style="font-weight:600;">${escHtml(dateStr)}</p>
        <p class="text-sm text-muted">${escHtml(lesson.class.department)}</p>
      </div>
    </div>` : `<p class="meta">${escHtml(dateStr)}</p><div class="spacer"></div>`}

    ${lesson.objectives.length > 0 ? `
    <h2>Learning Objectives</h2>
    <ul>
      ${lesson.objectives.map(o => `<li>${escHtml(o)}</li>`).join('')}
    </ul>` : ''}

    <h2>Lesson Activities</h2>
    <div class="card card-blue">
      <h3>Starter</h3>
      <p class="text-muted text-sm">Recall / retrieval practice linked to prior learning.</p>
    </div>
    <div class="card">
      <h3>Main Activity</h3>
      <p class="text-muted text-sm">Core lesson content aligned to learning objectives above.</p>
    </div>
    <div class="card card-green">
      <h3>Plenary</h3>
      <p class="text-muted text-sm">Exit ticket / summary / check for understanding.</p>
    </div>

    <h2>Teacher Notes</h2>
    <div class="card" style="min-height:60pt;">
      <p class="text-muted text-sm">Space for personal annotations and delivery notes.</p>
    </div>

    ${lesson.resources.length > 0 ? `
    <h2>Resources</h2>
    <table>
      <thead><tr><th style="width:80pt;">Type</th><th>Label</th><th>Link / File</th></tr></thead>
      <tbody>${resourceRows}</tbody>
    </table>` : ''}

    ${lesson.homework.length > 0 ? `
    <h2>Homework Set</h2>
    <table>
      <thead><tr><th>Title</th><th style="width:90pt;">Type</th><th style="width:80pt;">Due</th><th>Instructions</th></tr></thead>
      <tbody>${hwRows}</tbody>
    </table>` : ''}`

  return pdfShell(
    content,
    `Lesson Plan — ${lesson.title}`,
    lesson.schoolName,
  )
}
