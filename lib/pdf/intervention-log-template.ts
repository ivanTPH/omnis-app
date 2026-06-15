import { pdfShell, escHtml } from './templates'

export type InterventionEvidence = {
  date:         string
  homeworkTitle: string
  subject:      string | null
  evidenceType: string  // 'PROGRESS' | 'CONCERN' | 'NEUTRAL'
  score:        number | null
  maxScore:     number | null
  aiSummary:    string | null
  teacherNote:  string | null
}

export type InterventionTaNote = {
  date:      string
  content:   string
  isUrgent:  boolean
  authorName: string
}

export type InterventionConcern = {
  date:        string
  category:    string
  status:      string
  description: string
  raiserName:  string
}

export type InterventionApdr = {
  cycleNumber:    number
  reviewDate:     string
  status:         string
  assessContent:  string
  planContent:    string
  doContent:      string
  reviewContent:  string
  outcomeRating:  string
  parentComments: string
}

export type InterventionLogData = {
  schoolName:   string
  studentName:  string
  yearGroup:    number | null
  sendStatus:   string | null
  ilpSummary:   string | null
  evidence:     InterventionEvidence[]
  taNotes:      InterventionTaNote[]
  concerns:     InterventionConcern[]
  apdrs:        InterventionApdr[]
}

const EVIDENCE_STYLE: Record<string, string> = {
  PROGRESS: 'color:#16a34a;font-weight:700',
  CONCERN:  'color:#dc2626;font-weight:700',
  NEUTRAL:  'color:#6b7280',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const OUTCOME_LABEL: Record<string, string> = {
  GOOD_PROGRESS:    'Good Progress',
  SOME_PROGRESS:    'Some Progress',
  INSUFFICIENT:     'Insufficient Progress',
  NO_PROGRESS:      'No Progress',
}

export function interventionLogPdf(d: InterventionLogData): string {
  const sendBadge = d.sendStatus && d.sendStatus !== 'NONE'
    ? `<span style="background:#fef3c7;color:#92400e;padding:1pt 6pt;border-radius:4pt;font-size:8pt;font-weight:700;margin-left:8pt">${escHtml(d.sendStatus.replace('_', ' '))}</span>`
    : ''

  const overviewHtml = `
    <div class="two-col" style="margin-bottom:14pt">
      <div class="card card-blue">
        <div style="font-size:16pt;font-weight:700;color:#2563eb">${d.evidence.length}</div>
        <div class="meta">ILP evidence entries</div>
      </div>
      <div class="card card-amber">
        <div style="font-size:16pt;font-weight:700;color:#d97706">${d.taNotes.length}</div>
        <div class="meta">TA notes</div>
      </div>
      <div class="card card-red">
        <div style="font-size:16pt;font-weight:700;color:#dc2626">${d.concerns.length}</div>
        <div class="meta">SEND concerns</div>
      </div>
      <div class="card card-green">
        <div style="font-size:16pt;font-weight:700;color:#16a34a">${d.apdrs.length}</div>
        <div class="meta">APDR cycles</div>
      </div>
    </div>
    ${d.ilpSummary ? `<div class="card card-blue"><p style="font-size:10pt">${escHtml(d.ilpSummary)}</p></div>` : ''}`

  // ILP Evidence
  const evidenceHtml = d.evidence.length === 0
    ? '<p class="text-muted">No ILP evidence entries recorded.</p>'
    : `<table>
        <thead><tr><th>Date</th><th>Homework</th><th>Subject</th><th>Type</th><th>Grade</th><th>Notes</th></tr></thead>
        <tbody>
          ${d.evidence.map(e => {
            const gradeStr = (e.score != null && e.maxScore != null)
              ? `${Math.round(e.score)}/${Math.round(e.maxScore)}`
              : (e.score != null ? String(Math.round(e.score)) : '—')
            const note = e.teacherNote ?? e.aiSummary ?? '—'
            return `<tr>
              <td class="meta">${fmtDate(e.date)}</td>
              <td>${escHtml(e.homeworkTitle)}</td>
              <td>${escHtml(e.subject ?? '—')}</td>
              <td style="${EVIDENCE_STYLE[e.evidenceType] ?? ''}">${escHtml(e.evidenceType)}</td>
              <td>${gradeStr}</td>
              <td class="text-sm">${escHtml(String(note).slice(0, 80))}${String(note).length > 80 ? '…' : ''}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`

  // TA Notes
  const taHtml = d.taNotes.length === 0
    ? '<p class="text-muted">No TA notes recorded.</p>'
    : d.taNotes.map(n => `
        <div class="card ${n.isUrgent ? 'card-red' : 'card-amber'}">
          <div style="display:flex;justify-content:space-between;margin-bottom:4pt">
            <span class="meta">${fmtDate(n.date)} · ${escHtml(n.authorName)}</span>
            ${n.isUrgent ? '<span style="color:#dc2626;font-size:8pt;font-weight:700">URGENT</span>' : ''}
          </div>
          <p style="font-size:10pt">${escHtml(n.content)}</p>
        </div>`).join('')

  // Concerns
  const concernsHtml = d.concerns.length === 0
    ? '<p class="text-muted">No SEND concerns recorded.</p>'
    : `<table>
        <thead><tr><th>Date</th><th>Category</th><th>Status</th><th>Raised By</th><th>Description</th></tr></thead>
        <tbody>
          ${d.concerns.map(c => `<tr>
            <td class="meta">${fmtDate(c.date)}</td>
            <td>${escHtml(c.category)}</td>
            <td>${escHtml(c.status.replace(/_/g, ' '))}</td>
            <td>${escHtml(c.raiserName)}</td>
            <td class="text-sm">${escHtml(c.description.slice(0, 100))}${c.description.length > 100 ? '…' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`

  // APDR cycles
  const apdrHtml = d.apdrs.length === 0
    ? '<p class="text-muted">No APDR cycles recorded.</p>'
    : d.apdrs.map(a => {
        const outcome = OUTCOME_LABEL[a.outcomeRating] ?? ''
        return `
          <div class="card" style="margin-bottom:10pt">
            <div style="display:flex;justify-content:space-between;margin-bottom:6pt">
              <span style="font-weight:700">Cycle ${a.cycleNumber}</span>
              <span class="meta">Review: ${fmtDate(a.reviewDate)} · ${escHtml(a.status)}${outcome ? ` · ${escHtml(outcome)}` : ''}</span>
            </div>
            ${a.assessContent  ? `<p class="text-sm"><strong>Assess:</strong> ${escHtml(a.assessContent.slice(0,200))}${a.assessContent.length>200?'…':''}</p>` : ''}
            ${a.planContent    ? `<p class="text-sm"><strong>Plan:</strong> ${escHtml(a.planContent.slice(0,200))}${a.planContent.length>200?'…':''}</p>` : ''}
            ${a.doContent      ? `<p class="text-sm"><strong>Do:</strong> ${escHtml(a.doContent.slice(0,200))}${a.doContent.length>200?'…':''}</p>` : ''}
            ${a.reviewContent  ? `<p class="text-sm"><strong>Review:</strong> ${escHtml(a.reviewContent.slice(0,200))}${a.reviewContent.length>200?'…':''}</p>` : ''}
            ${a.parentComments ? `<p class="text-sm"><strong>Parent comments:</strong> ${escHtml(a.parentComments.slice(0,200))}</p>` : ''}
          </div>`
      }).join('')

  const content = `
    <h1>${escHtml(d.studentName)}${sendBadge}</h1>
    <p class="meta">${escHtml(d.schoolName)}${d.yearGroup ? ` · Year ${d.yearGroup}` : ''} · Intervention Log</p>
    <hr class="divider">

    ${overviewHtml}

    <h2>ILP Evidence Entries</h2>
    ${evidenceHtml}

    <h2>TA Notes</h2>
    ${taHtml}

    <h2>SEND Concerns</h2>
    ${concernsHtml}

    <h2>APDR Cycles</h2>
    ${apdrHtml}
  `

  return pdfShell(content, `Intervention Log — ${d.studentName}`, d.schoolName)
}
