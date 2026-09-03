import { pdfShell, escHtml } from './templates'
import { gradeLabel } from '@/lib/grading'
import type { ReportSourceData, ReportNarrativeSections } from '@/app/actions/reports'

export type NarrativeReportData = {
  source:       ReportSourceData
  narrative:    ReportNarrativeSections
  teacherName:  string
  preparedDate: Date
}

function gapColor(gap: number | null): string {
  if (gap == null) return '#6b7280'
  if (gap >= 0) return '#16a34a'
  if (gap >= -1) return '#d97706'
  return '#dc2626'
}

function gapLabel(gap: number | null): string {
  if (gap == null) return '—'
  if (gap === 0) return 'On track'
  return gap > 0 ? `+${gap} grade${gap === 1 ? '' : 's'} above` : `${gap} grade${gap === -1 ? '' : 's'} below`
}

export function narrativeReportPdf(data: NarrativeReportData): string {
  const { source, narrative, teacherName, preparedDate } = data

  const dateStr = preparedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const yearStr = source.yearGroup ? `Year ${source.yearGroup}` : ''
  const formStr = source.tutorGroup ? ` · Form ${escHtml(source.tutorGroup)}` : ''

  // ── Predicted vs actual, per subject ─────────────────────────────────────────
  const subjectsHtml = source.subjects.length === 0
    ? '<p class="text-muted">No subject data recorded for this student yet.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Subject</th>
            <th style="width:90pt;text-align:center;">Predicted</th>
            <th style="width:90pt;text-align:center;">Actual (this year)</th>
            <th style="width:110pt;text-align:center;">Gap</th>
          </tr>
        </thead>
        <tbody>
          ${source.subjects.map(s => `<tr>
            <td style="font-weight:600;">${escHtml(s.subject)}</td>
            <td style="text-align:center;">${gradeLabel(s.predictedGrade)}</td>
            <td style="text-align:center;font-weight:700;">${gradeLabel(s.actualGrade)}</td>
            <td style="text-align:center;font-weight:600;color:${gapColor(s.gap)};">${gapLabel(s.gap)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`

  // ── Attendance ────────────────────────────────────────────────────────────────
  let attendanceHtml = ''
  if (source.attendancePct != null) {
    const color = source.attendancePct < 85 ? '#dc2626' : source.attendancePct < 90 ? '#d97706' : '#16a34a'
    attendanceHtml = `<div class="card" style="text-align:center;">
      <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Attendance</p>
      <p style="font-size:18pt;font-weight:700;color:${color};margin:0;">${source.attendancePct.toFixed(1)}%</p>
    </div>`
  }

  // ── ILP targets ───────────────────────────────────────────────────────────────
  const ilpHtml = source.ilpTargets.length > 0
    ? `<h2>Individual Learning Plan — Active Targets</h2>
       <ul>${source.ilpTargets.map(t => `<li>${escHtml(t.target)} <span class="meta">(${escHtml(t.status.replace(/_/g, ' '))})</span></li>`).join('')}</ul>`
    : ''

  // ── Behaviour / achievement points ─────────────────────────────────────────────
  const behaviourHtml = `
    <div class="card" style="display:grid;grid-template-columns:1fr 1fr;gap:8pt;">
      <div>
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Positive points this year</p>
        <p style="font-size:16pt;font-weight:700;color:#16a34a;margin:0;">${source.behaviour.positiveCount}</p>
      </div>
      <div>
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Negative points this year</p>
        <p style="font-size:16pt;font-weight:700;color:${source.behaviour.negativeCount > 0 ? '#dc2626' : '#374151'};margin:0;">${source.behaviour.negativeCount}</p>
      </div>
    </div>`

  // ── Narrative sections ──────────────────────────────────────────────────────────
  const narrativeSection = (title: string, text: string) => text.trim()
    ? `<h2>${escHtml(title)}</h2><p>${escHtml(text).replace(/\n/g, '<br>')}</p>`
    : ''

  const content = `
    <div style="margin-bottom:16pt;">
      <h1>${escHtml(source.studentName)}</h1>
      <p class="meta">${yearStr}${formStr} · ${escHtml(source.schoolName)}</p>
      <p class="meta">Academic year ${escHtml(source.academicYearLabel)}</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10pt;margin-bottom:14pt;">
      ${attendanceHtml}
      <div class="card" style="text-align:center;">
        <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Target grade (overall)</p>
        <p style="font-size:18pt;font-weight:700;color:#1e3a5f;margin:0;">${gradeLabel(source.passport.targetGrade)}</p>
      </div>
    </div>

    <h2>Predicted vs Actual — by Subject</h2>
    ${subjectsHtml}

    ${narrativeSection('Performance', narrative.performance)}
    ${narrativeSection('Potential', narrative.potential)}
    ${narrativeSection('Areas for Improvement', narrative.areasForImprovement)}

    ${ilpHtml}

    <h2>Behaviour &amp; Achievement</h2>
    ${behaviourHtml}

    <hr class="divider" style="margin-top:20pt;" />
    <p class="meta">Prepared by ${escHtml(teacherName)}, ${dateStr}.</p>
    <p class="meta">The narrative sections above were AI-drafted from this student's recorded grades, attendance, and
      learning plan, then reviewed and edited by the named teacher before export. This report is intended for the
      parent/carer of the named student only.</p>
  `

  return pdfShell(content, `Student Report — ${source.studentName}`, source.schoolName)
}
