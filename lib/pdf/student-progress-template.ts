import { pdfShell, escHtml } from './templates'
import type { StudentFileData } from '@/app/actions/students'
import { gradeLabel, percentToGcseGrade, GCSE_LETTERS } from '@/lib/grading'

function dateStr(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function gradeCell(avgScore: number | null): string {
  if (avgScore == null) return '<td style="color:#9ca3af;">—</td>'
  // avgScore is on 0–9 scale
  const g = Math.round(avgScore)
  const letter = GCSE_LETTERS[g] ?? '?'
  let colour = '#6b7280'
  if (g >= 7) colour = '#15803d'
  else if (g >= 5) colour = '#ca8a04'
  else colour = '#dc2626'
  return `<td style="font-weight:700;color:${colour};">${g} (${letter})</td>`
}

function attendanceBand(pct: number | null): { label: string; colour: string } {
  if (pct == null) return { label: 'No data', colour: '#9ca3af' }
  if (pct >= 95) return { label: `${pct}% — Excellent`, colour: '#15803d' }
  if (pct >= 90) return { label: `${pct}% — Good`, colour: '#ca8a04' }
  if (pct >= 85) return { label: `${pct}% — Needs improvement`, colour: '#d97706' }
  return { label: `${pct}% — Persistent absence`, colour: '#dc2626' }
}

export function studentProgressPdf(data: StudentFileData, schoolName: string): string {
  const { student } = data
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  // ── Attendance ──────────────────────────────────────────────────────────────
  const att = attendanceBand(student.attendancePercentage ?? null)
  const attendanceHtml = `
    <p style="font-size:14pt;font-weight:700;color:${att.colour};">${escHtml(att.label)}</p>
  `

  // ── Subject performance ─────────────────────────────────────────────────────
  const perfRows = (data.subjectPerf ?? []).filter(p => p.assigned > 0)
  const perfHtml = perfRows.length > 0
    ? `<table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Current Grade</th>
            <th>Predicted</th>
            <th>Homework submitted</th>
          </tr>
        </thead>
        <tbody>
          ${perfRows.map(p => {
            const submitted = p.submitted
            const assigned  = p.assigned
            const pct       = assigned > 0 ? Math.round((submitted / assigned) * 100) : 0
            const predGrade = p.predictedScore != null
              ? gradeLabel(Math.round(p.predictedScore))
              : '—'
            return `<tr>
              <td style="font-weight:600;">${escHtml(p.subject)}</td>
              ${gradeCell(p.avgScore)}
              <td>${escHtml(predGrade)}</td>
              <td>
                ${submitted}/${assigned}
                <span style="color:#9ca3af;font-size:9pt;"> (${pct}%)</span>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`
    : '<p style="color:#9ca3af;">No subject performance data available yet.</p>'

  // ── Recent homework ─────────────────────────────────────────────────────────
  const recent = (data.recentHomeworks ?? []).slice(0, 12)
  const hwHtml = recent.length > 0
    ? `<table>
        <thead><tr><th>Assignment</th><th>Subject</th><th>Due</th><th>Grade</th></tr></thead>
        <tbody>
          ${recent.map(h => {
            let gradeDisplay = '—'
            if (h.grade) {
              gradeDisplay = h.grade
            } else if (h.finalScore != null) {
              const g = percentToGcseGrade(h.finalScore)
              gradeDisplay = gradeLabel(g)
            }
            const notSubmitted = !h.submitted
            return `<tr${notSubmitted ? ' style="color:#9ca3af;"' : ''}>
              <td>${escHtml(h.title)}${notSubmitted ? ' <span style="font-size:9pt;">(not submitted)</span>' : ''}</td>
              <td>${escHtml(h.subject)}</td>
              <td>${dateStr(h.dueAt)}</td>
              <td style="font-weight:${h.grade ? '700' : '400'};">${escHtml(gradeDisplay)}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>`
    : '<p style="color:#9ca3af;">No recent homework on record.</p>'

  // ── Staff notes (general — no SEND detail) ──────────────────────────────────
  const notes = (data.notes ?? []).slice(0, 5)
  const notesHtml = notes.length > 0
    ? notes.map(n => `
        <div class="card">
          <p style="font-size:10pt;">${escHtml(n.content)}</p>
          <p class="meta">${dateStr(n.createdAt)} · ${escHtml(n.authorName ?? '')}</p>
        </div>`).join('')
    : '<p style="color:#9ca3af;">No notes from staff this term.</p>'

  // ── Summary stats strip ─────────────────────────────────────────────────────
  const totalAssigned  = perfRows.reduce((s, p) => s + p.assigned, 0)
  const totalSubmitted = perfRows.reduce((s, p) => s + p.submitted, 0)
  const completionPct  = totalAssigned > 0 ? Math.round((totalSubmitted / totalAssigned) * 100) : null
  const subjectsAbove5 = perfRows.filter(p => p.avgScore != null && p.avgScore >= 5).length

  const statsHtml = `
    <div class="two-col" style="margin-bottom:16pt;">
      <div class="card card-blue" style="text-align:center;">
        <p style="font-size:20pt;font-weight:700;color:#2563eb;margin-bottom:2pt;">
          ${completionPct != null ? `${completionPct}%` : '—'}
        </p>
        <p style="font-size:9pt;color:#6b7280;">Homework completion rate</p>
      </div>
      <div class="card card-green" style="text-align:center;">
        <p style="font-size:20pt;font-weight:700;color:#15803d;margin-bottom:2pt;">
          ${subjectsAbove5}/${perfRows.length}
        </p>
        <p style="font-size:9pt;color:#6b7280;">Subjects at Grade 5 or above</p>
      </div>
    </div>
  `

  const body = `
    <h1>${escHtml(student.firstName)} ${escHtml(student.lastName)}</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:4pt;">
      ${student.yearGroup ? `Year ${student.yearGroup}` : ''}
      ${student.tutorGroup ? ` · Form ${student.tutorGroup}` : ''}
      · Progress Report · ${now}
    </p>

    <hr class="divider" />

    <h2>Attendance</h2>
    <div class="card">${attendanceHtml}</div>

    ${statsHtml}

    <h2>Subject Performance</h2>
    <p style="font-size:9pt;color:#6b7280;margin-bottom:6pt;">
      Grades are shown on the GCSE 1–9 scale. Grade 4 (C) is a standard pass; Grade 5 (C+) is a strong pass.
    </p>
    ${perfHtml}

    <h2>Recent Homework</h2>
    ${hwHtml}

    ${notes.length > 0 ? `<h2>Notes from Staff</h2>${notesHtml}` : ''}

    <p style="margin-top:24pt;font-size:9pt;color:#9ca3af;border-top:0.5pt solid #e5e7eb;padding-top:6pt;">
      Generated by Omnis · ${now} · This report reflects data recorded up to the date of generation.
      For questions about your child's progress please contact their form tutor or subject teacher.
    </p>
  `

  return pdfShell(body, `Progress Report — ${student.firstName} ${student.lastName}`, schoolName)
}
