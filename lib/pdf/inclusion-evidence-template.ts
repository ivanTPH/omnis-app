import { pdfShell, escHtml } from './templates'
import { gradeLabel } from '@/lib/grading'
import type { InclusionReportData } from '@/app/actions/analytics'

function dateStr(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pct(n: number | null): string {
  return n == null ? '—' : `${n}%`
}

function statCard(label: string, value: string, tone: '' | 'blue' | 'green' | 'amber' | 'red' = ''): string {
  const cls = tone ? `card card-${tone}` : 'card'
  return `
    <div class="${cls}" style="text-align:center;">
      <div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:3pt;">${escHtml(label)}</div>
      <div style="font-size:16pt;font-weight:700;color:#1a1a1a;">${escHtml(value)}</div>
    </div>`
}

function overdueRow(item: { studentName: string; reviewDate: string; daysOverdue: number }): string {
  return `<tr><td>${escHtml(item.studentName)}</td><td>${dateStr(item.reviewDate)}</td><td style="color:#dc2626;font-weight:700;">${item.daysOverdue} days overdue</td></tr>`
}

export function inclusionEvidenceReportPdf(data: InclusionReportData): string {
  const isCaseStudy = !!data.section7CaseStudy

  const filterSummary = `
    <div class="meta" style="margin-bottom:14pt;">
      ${escHtml(data.filters.yearGroupsLabel)} &middot;
      ${escHtml(data.filters.sendStatusLabel)} &middot;
      Period: ${escHtml(data.filters.periodLabel)}
      ${data.filters.studentName ? ` &middot; Student: ${escHtml(data.filters.studentName)}` : ''}
    </div>`

  // ── Section 1 — SEND register summary ─────────────────────────────────────
  const s1 = data.section1Register
  const idTrendDelta = s1.newIdentificationsThisPeriod - s1.newIdentificationsPriorPeriod
  const idTrendLabel = idTrendDelta === 0
    ? `No change vs the prior period (also ${s1.newIdentificationsPriorPeriod})`
    : `${Math.abs(idTrendDelta)} ${idTrendDelta > 0 ? 'more' : 'fewer'} than the prior period (${s1.newIdentificationsPriorPeriod})`

  const section1 = `
    <h2>1. SEND register summary</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;margin-bottom:8pt;">
      ${statCard('On SEND register', String(s1.total), 'blue')}
      ${statCard('% of roll', pct(s1.pctOfRoll))}
      ${statCard('SEN Support', String(s1.senSupport))}
      ${statCard('EHCP', String(s1.ehcp))}
    </div>
    <p class="text-sm text-muted">New identifications (new ILPs created) this period: <strong>${s1.newIdentificationsThisPeriod}</strong>. ${escHtml(idTrendLabel)}. This is a proxy for identification activity, not a historical register-headcount trend — the system does not retain point-in-time headcount snapshots.</p>
  `

  // ── Section 2 — identification & responsiveness ───────────────────────────
  const s2 = data.section2Responsiveness
  const section2 = `
    <h2>2. Identification &amp; responsiveness</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8pt;margin-bottom:8pt;">
      ${statCard('Avg. days: concern raised → ILP approved', s2.avgDaysToApprovedIlp != null ? String(s2.avgDaysToApprovedIlp) : 'No matched cases', s2.avgDaysToApprovedIlp != null ? (s2.avgDaysToApprovedIlp <= 20 ? 'green' : s2.avgDaysToApprovedIlp <= 40 ? 'amber' : 'red') : '')}
      ${statCard('Matched cases in this measure', String(s2.matchedCaseCount))}
    </div>
    <p class="text-sm text-muted">Measures the gap between the earliest recorded concern (SEND concern or early-warning flag) and the date an ILP was approved by the SENCO, for students where both exist in this school's records.</p>
  `

  // ── Section 3 — ILP coverage & currency ───────────────────────────────────
  const s3 = data.section3IlpCoverage
  const section3 = `
    <h2>3. ILP coverage &amp; currency</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8pt;margin-bottom:8pt;">
      ${statCard('Approved ILP coverage', pct(s3.coveragePct), s3.coveragePct != null && s3.coveragePct >= 90 ? 'green' : 'amber')}
      ${statCard('Overdue for review', `${s3.overdueCount} (${pct(s3.overduePct)})`, s3.overdueCount > 0 ? 'red' : 'green')}
      ${statCard('Cohort size', String(s3.cohortSize))}
    </div>
    ${s3.oldestOverdue ? `
      <div class="card card-red">
        <strong>Oldest overdue case:</strong> ${escHtml(s3.oldestOverdue.studentName)} — review was due ${dateStr(s3.oldestOverdue.reviewDate)} (${s3.oldestOverdue.daysOverdue} days overdue)
      </div>
    ` : `<p class="text-sm text-muted">No overdue ILP reviews in this cohort.</p>`}
  `

  // ── Section 4 — EHCP compliance ───────────────────────────────────────────
  const s4 = data.section4EhcpCompliance
  const section4 = `
    <h2>4. EHCP compliance</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8pt;margin-bottom:8pt;">
      ${statCard('Total EHCPs', String(s4.total))}
      ${statCard('Reviewed within 12-month window', pct(s4.withinWindowPct), s4.withinWindowPct != null && s4.withinWindowPct >= 100 ? 'green' : s4.withinWindowPct != null && s4.withinWindowPct >= 80 ? 'amber' : 'red')}
      ${statCard('Overdue reviews', String(s4.overdueCount), s4.overdueCount > 0 ? 'red' : 'green')}
    </div>
    ${s4.overdueCount > 0 ? `
      <div class="card card-red">
        <strong>Compliance risk — ${s4.overdueCount} EHCP review${s4.overdueCount === 1 ? '' : 's'} overdue against the statutory 12-month cycle (SEND Code of Practice 9.166):</strong>
        <table style="margin-top:6pt;">
          <thead><tr><th>Student</th><th>Review due</th><th>Status</th></tr></thead>
          <tbody>${s4.overdueList.map(overdueRow).join('')}</tbody>
        </table>
      </div>
    ` : `<div class="card card-green">All EHCPs in this cohort are within the statutory 12-month review window.</div>`}
  `

  // ── Section 5 — evidence-backed progress ──────────────────────────────────
  const s5 = data.section5Evidence
  const attainmentRows = s5.attainmentByStatus.map(a => `
    <tr>
      <td>${escHtml(a.label)}</td>
      <td>${a.count}</td>
      <td style="font-weight:600;">${gradeLabel(a.avgScore != null ? Math.round(a.avgScore) : null)}</td>
    </tr>`).join('')

  const section5 = `
    <h2>5. Evidence-backed progress</h2>
    <h3>Attainment by SEND status (last 90 days, average grade)</h3>
    <table>
      <thead><tr><th>Status</th><th>Students</th><th>Avg. grade</th></tr></thead>
      <tbody>${attainmentRows}</tbody>
    </table>
    <h3>Evidence recorded this period (graduated approach — how consistently support is evidenced, not just planned)</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8pt;">
      ${statCard('Progress', String(s5.evidenceCounts.progress), 'green')}
      ${statCard('Concern', String(s5.evidenceCounts.concern), 'red')}
      ${statCard('Neutral', String(s5.evidenceCounts.neutral))}
      ${statCard('Total entries', String(s5.evidenceCounts.total), 'blue')}
    </div>
  `

  // ── Section 6 — parent & pupil voice ──────────────────────────────────────
  const s6 = data.section6Voice
  const section6 = `
    <h2>6. Parent &amp; pupil voice</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8pt;">
      ${statCard('Parent ILP responses recorded', String(s6.parentResponseCount), 'blue')}
      ${statCard('Meetings requested by parents', String(s6.meetingRequestedCount))}
    </div>
    <p class="text-sm text-muted">Counts parent acknowledgement/feedback recorded against ILPs in this period — evidence that families are engaged in the review process, as expected under the SEND Code of Practice and Ofsted's Inclusion evaluation area.</p>
  `

  // ── Section 7 — single-student narrative case study ───────────────────────
  let section7 = ''
  if (data.section7CaseStudy) {
    const c = data.section7CaseStudy
    const targetRows = c.targets.map(t => `
      <tr>
        <td>${escHtml(t.target)}</td>
        <td>${escHtml(t.strategy)}</td>
        <td>${escHtml(t.successMeasure)}</td>
        <td>${escHtml(t.status.replace(/_/g, ' '))}</td>
        <td>${dateStr(t.targetDate)}</td>
      </tr>`).join('')

    const evidenceRows = c.evidenceTimeline.map(e => `
      <tr>
        <td>${dateStr(e.date)}</td>
        <td>${escHtml(e.type)}</td>
        <td>${escHtml(e.homeworkTitle)}</td>
        <td>${escHtml(e.summary ?? '—')}</td>
      </tr>`).join('')

    const parentVoiceRows = c.parentVoice.map(p => `
      <tr>
        <td>${dateStr(p.reviewedAt)}</td>
        <td>${escHtml(p.homeProgress ?? '—')}</td>
        <td>${p.meetingRequested ? 'Yes' : 'No'}</td>
      </tr>`).join('')

    section7 = `
      <div class="page-break"></div>
      <h2>7. Case study — ${escHtml(c.studentName)}</h2>
      <p class="meta">Year ${c.yearGroup ?? '—'} &middot; ${escHtml(c.sendStatus.replace('_', ' '))} &middot; ${escHtml(c.needArea ?? 'Need area not specified')}</p>

      <h3>Need identified</h3>
      <div class="card">${escHtml(c.areasOfNeed) || '<span class="text-muted">Not recorded</span>'}</div>

      <h3>Strengths</h3>
      <div class="card">${escHtml(c.currentStrengths) || '<span class="text-muted">Not recorded</span>'}</div>

      <h3>Plan — strategies</h3>
      ${c.strategies.length ? `<ul>${c.strategies.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul>` : '<p class="text-muted">No strategies recorded</p>'}

      <h3>Plan — targets</h3>
      ${c.targets.length ? `
        <table>
          <thead><tr><th>Target</th><th>Strategy</th><th>Success measure</th><th>Status</th><th>Target date</th></tr></thead>
          <tbody>${targetRows}</tbody>
        </table>
      ` : '<p class="text-muted">No active targets recorded</p>'}

      <h3>Evidence of what was tried</h3>
      ${c.evidenceTimeline.length ? `
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Homework</th><th>Note</th></tr></thead>
          <tbody>${evidenceRows}</tbody>
        </table>
      ` : '<p class="text-muted">No evidence entries recorded yet</p>'}

      <h3>Parent &amp; pupil voice</h3>
      ${c.parentVoice.length ? `
        <table>
          <thead><tr><th>Date</th><th>Home progress note</th><th>Meeting requested</th></tr></thead>
          <tbody>${parentVoiceRows}</tbody>
        </table>
      ` : '<p class="text-muted">No parent responses recorded yet</p>'}
    `
  }

  const content = `
    ${filterSummary}
    ${section1}
    ${section2}
    ${section3}
    ${section4}
    ${section5}
    ${section6}
    ${section7}
  `

  const title = isCaseStudy
    ? `SEND provision evidence report — ${data.section7CaseStudy!.studentName}`
    : 'Inclusion evidence summary'

  return pdfShell(content, title, data.schoolName)
}
