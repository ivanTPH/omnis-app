import { pdfShell, escHtml } from './templates'
import type { StudentFileData } from '@/app/actions/students'

function row(label: string, value: string | null | undefined): string {
  if (!value) return ''
  return `<tr><td class="label-cell">${escHtml(label)}</td><td>${escHtml(value)}</td></tr>`
}

function section(title: string, content: string): string {
  if (!content.trim()) return ''
  return `<h2>${escHtml(title)}</h2>${content}`
}

function badge(text: string, cls = 'badge'): string {
  return `<span class="${cls}">${escHtml(text)}</span>`
}

function dateStr(d: string | Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function studentRecordPdf(data: StudentFileData, schoolName: string): string {
  const { student } = data

  // ── 1. Student overview ──────────────────────────────────────────────────────
  const sendBadge = student.sendStatus && student.sendStatus !== 'NONE'
    ? badge(student.sendStatus === 'EHCP' ? 'EHCP' : 'SEN Support', 'badge')
    : ''

  const overviewTable = `
    <table class="info-table">
      ${row('Year Group',   student.yearGroup ? `Year ${student.yearGroup}` : null)}
      ${row('Tutor Group',  student.tutorGroup)}
      ${row('Email',        student.email)}
      ${row('Date of Birth', student.dateOfBirth ? dateStr(student.dateOfBirth) : null)}
      ${row('SEND Status',  student.sendStatus !== 'NONE' ? student.sendStatus : null)}
      ${row('Need Area',    student.needArea)}
      ${row('Attendance',   student.attendancePercentage != null ? `${student.attendancePercentage}%` : null)}
    </table>
  `

  // ── 2. Subjects ──────────────────────────────────────────────────────────────
  const subjectsHtml = data.subjects && data.subjects.length > 0
    ? `<p>${data.subjects.map(s => `<span class="badge">${escHtml(s.subject)}${s.level ? ` (${escHtml(s.level)})` : ''}</span>`).join(' ')}</p>`
    : '<p class="text-muted">No subjects on record</p>'

  // ── 3. ILP / EHCP ────────────────────────────────────────────────────────────
  let ilpHtml = ''
  if (data.ilp) {
    const targets = (data.ilp.targets ?? []).slice(0, 10)
    ilpHtml = `
      <div class="card card-blue">
        <p><strong>Status:</strong> ${escHtml(data.ilp.status)} &nbsp; <strong>Areas of Need:</strong> ${escHtml(data.ilp.areasOfNeed ?? '')}</p>
        ${targets.length > 0 ? `
        <table style="margin-top:8pt">
          <thead><tr><th>Target</th><th>Strategy</th><th>Status</th></tr></thead>
          <tbody>${targets.map(t => `<tr>
            <td>${escHtml(t.target)}</td>
            <td>${escHtml(t.strategy ?? '')}</td>
            <td>${escHtml(t.status)}</td>
          </tr>`).join('')}</tbody>
        </table>` : ''}
      </div>
    `
  }

  let ehcpHtml = ''
  if (data.ehcp) {
    const outcomes = (data.ehcp.outcomes ?? []).slice(0, 8)
    const sectionEntries = data.ehcp.sections ? Object.entries(data.ehcp.sections).slice(0, 3) : []
    ehcpHtml = `
      <div class="card card-amber">
        ${sectionEntries.map(([k, v]) => `<p><strong>${escHtml(k)}:</strong> ${escHtml(v)}</p>`).join('')}
        ${outcomes.length > 0 ? `
        <table style="margin-top:8pt">
          <thead><tr><th>Outcome</th><th>Section</th><th>Status</th></tr></thead>
          <tbody>${outcomes.map(o => `<tr>
            <td>${escHtml(o.outcomeText)}</td>
            <td>${escHtml(o.section)}</td>
            <td>${escHtml(o.status)}</td>
          </tr>`).join('')}</tbody>
        </table>` : ''}
      </div>
    `
  }

  // ── 4. Subject performance ───────────────────────────────────────────────────
  const perfHtml = data.subjectPerf && data.subjectPerf.length > 0
    ? `<table>
        <thead><tr><th>Subject</th><th>Avg Score</th><th>Submitted</th><th>Assigned</th></tr></thead>
        <tbody>${data.subjectPerf.slice(0, 15).map(p => `<tr>
          <td>${escHtml(p.subject)}</td>
          <td>${p.avgScore != null ? p.avgScore.toFixed(1) : '—'}</td>
          <td>${p.submitted}</td>
          <td>${p.assigned}</td>
        </tr>`).join('')}</tbody>
      </table>`
    : '<p class="text-muted">No performance data</p>'

  // ── 5. Recent homework ───────────────────────────────────────────────────────
  const hwHtml = data.recentHomeworks && data.recentHomeworks.length > 0
    ? `<table>
        <thead><tr><th>Title</th><th>Subject</th><th>Grade</th><th>Due</th></tr></thead>
        <tbody>${data.recentHomeworks.slice(0, 10).map(h => `<tr>
          <td>${escHtml(h.title)}</td>
          <td>${escHtml(h.subject)}</td>
          <td>${escHtml(h.grade ?? '—')}</td>
          <td>${dateStr(h.dueAt)}</td>
        </tr>`).join('')}</tbody>
      </table>`
    : '<p class="text-muted">No recent homework</p>'

  // ── 6. APDR cycles ───────────────────────────────────────────────────────────
  const apdrHtml = data.apdrCycles && data.apdrCycles.length > 0
    ? data.apdrCycles.slice(0, 5).map(c => `
      <div class="card">
        <p><strong>Cycle ${c.cycleNumber}</strong> &nbsp; ${badge(c.status)} &nbsp; ${c.outcomeRating ? badge(c.outcomeRating.replace(/_/g, ' ').toLowerCase()) : ''}</p>
        <p class="meta">Review date: ${dateStr(c.reviewDate)}</p>
        ${c.reviewContent ? `<p><strong>Review:</strong> ${escHtml(c.reviewContent)}</p>` : ''}
        ${c.parentComments ? `<p><strong>Parent comments:</strong> ${escHtml(c.parentComments)}</p>` : ''}
      </div>
    `).join('')
    : '<p class="text-muted">No APDR cycles on record</p>'

  // ── 7. Notes ─────────────────────────────────────────────────────────────────
  const notesHtml = data.notes && data.notes.length > 0
    ? data.notes.slice(0, 8).map(n => `
      <div class="card">
        <p>${escHtml(n.content)}</p>
        <p class="meta">${dateStr(n.createdAt)} · ${escHtml(n.authorName ?? '')}</p>
      </div>
    `).join('')
    : '<p class="text-muted">No staff notes</p>'

  // ── 8. Parent contact log ────────────────────────────────────────────────────
  const contactHtml = data.contactLog && data.contactLog.length > 0
    ? `<table>
        <thead><tr><th>Date</th><th>Method</th><th>Summary</th><th>Author</th></tr></thead>
        <tbody>${data.contactLog.slice(0, 10).map(c => `<tr>
          <td>${dateStr(c.contactDate)}</td>
          <td>${escHtml(c.method)}</td>
          <td>${escHtml(c.summary)}</td>
          <td>${escHtml(c.authorName)}</td>
        </tr>`).join('')}</tbody>
      </table>`
    : '<p class="text-muted">No contact entries</p>'

  const content = `
    <h1>${escHtml(student.firstName)} ${escHtml(student.lastName)} ${sendBadge}</h1>
    <p class="meta">Student Record · Generated ${new Date().toLocaleDateString('en-GB', { day:'numeric',month:'long',year:'numeric' })}</p>
    <div class="spacer"></div>

    ${section('Personal Information', overviewTable)}
    ${section('Subject Choices', subjectsHtml)}
    ${data.ilp ? section('Individual Learning Plan (ILP)', ilpHtml) : ''}
    ${data.ehcp ? section('Education, Health & Care Plan (EHCP)', ehcpHtml) : ''}
    ${section('Subject Performance', perfHtml)}
    ${section('Recent Homework', hwHtml)}
    ${data.apdrCycles?.length ? section('APDR Cycles', apdrHtml) : ''}
    ${section('Staff Notes', notesHtml)}
    ${section('Parent Contact Log', contactHtml)}
  `

  const extraCss = `
    .info-table { width: auto; }
    .info-table td { padding: 3pt 10pt 3pt 0; vertical-align: top; }
    .label-cell { font-weight: 600; color: #6b7280; white-space: nowrap; min-width: 110pt; }
    .info-table tr td { border-bottom: none; background: transparent; }
  `

  return pdfShell(content, `Student Record — ${student.firstName} ${student.lastName}`, schoolName, extraCss)
}
