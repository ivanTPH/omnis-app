import { pdfShell, escHtml } from './templates'
import type { SendRegisterRow } from '@/app/actions/send-support'

function dateStr(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusBadge(sendStatus: string): string {
  if (sendStatus === 'EHCP') {
    return '<span style="background:#f3e8ff;color:#6b21a8;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:700;">EHCP</span>'
  }
  return '<span style="background:#dbeafe;color:#1d4ed8;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:700;">SEN Support</span>'
}

function ilpBadge(status: string | null): string {
  if (!status) return '<span style="color:#9ca3af;font-size:8pt;">None</span>'
  const colours: Record<string, string> = {
    active:       'background:#f0fdf4;color:#15803d;',
    under_review: 'background:#fffbeb;color:#b45309;',
    draft:        'background:#f9fafb;color:#6b7280;',
  }
  const style = colours[status] ?? 'background:#f9fafb;color:#374151;'
  return `<span style="${style}padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600;">${escHtml(status.replace(/_/g, ' '))}</span>`
}

function reviewDue(iso: string | null): string {
  if (!iso) return '—'
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
  const label = dateStr(iso)
  if (days < 0)  return `<span style="color:#dc2626;font-weight:600;">OVERDUE — ${label}</span>`
  if (days <= 14) return `<span style="color:#d97706;font-weight:600;">Due soon — ${label}</span>`
  return label
}

export function sendRegisterPdf(rows: SendRegisterRow[], schoolName: string): string {
  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalSend   = rows.length
  const totalEhcp   = rows.filter(r => r.sendStatus === 'EHCP').length
  const totalSenSup = totalSend - totalEhcp
  const withIlp     = rows.filter(r => r.ilpStatus).length
  const openConcerns = rows.reduce((s, r) => s + r.openConcernCount, 0)
  const reviewsOverdue = rows.filter(r => {
    const d = r.ilpReviewDate ?? r.ehcpReviewDate
    return d && new Date(d) < new Date()
  }).length

  // Group by year group
  const byYear = new Map<number | null, SendRegisterRow[]>()
  for (const row of rows) {
    const key = row.yearGroup
    if (!byYear.has(key)) byYear.set(key, [])
    byYear.get(key)!.push(row)
  }
  const yearKeys = [...byYear.keys()].sort((a, b) => (a ?? 99) - (b ?? 99))

  const summaryHtml = `
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8pt;margin-bottom:16pt;">
      <div class="card" style="text-align:center;">
        <p style="font-size:18pt;font-weight:700;color:#1e3a5f;">${totalSend}</p>
        <p style="font-size:8pt;color:#6b7280;">On SEND register</p>
      </div>
      <div class="card" style="text-align:center;">
        <p style="font-size:18pt;font-weight:700;color:#6b21a8;">${totalEhcp}</p>
        <p style="font-size:8pt;color:#6b7280;">EHCP</p>
      </div>
      <div class="card" style="text-align:center;">
        <p style="font-size:18pt;font-weight:700;color:#1d4ed8;">${totalSenSup}</p>
        <p style="font-size:8pt;color:#6b7280;">SEN Support</p>
      </div>
      <div class="card" style="text-align:center;">
        <p style="font-size:18pt;font-weight:700;color:#15803d;">${withIlp}</p>
        <p style="font-size:8pt;color:#6b7280;">Active ILPs</p>
      </div>
      <div class="card ${reviewsOverdue > 0 ? 'card-red' : ''}" style="text-align:center;">
        <p style="font-size:18pt;font-weight:700;color:${reviewsOverdue > 0 ? '#dc2626' : '#374151'};">${reviewsOverdue}</p>
        <p style="font-size:8pt;color:#6b7280;">Reviews overdue</p>
      </div>
    </div>
    ${openConcerns > 0 ? `
    <div class="card card-amber" style="margin-bottom:12pt;">
      <p style="font-size:10pt;color:#92400e;"><strong>${openConcerns} open SEND concern${openConcerns !== 1 ? 's' : ''}</strong> across ${rows.filter(r => r.openConcernCount > 0).length} student${rows.filter(r => r.openConcernCount > 0).length !== 1 ? 's' : ''} on the register.</p>
    </div>` : ''}
  `

  const tablesHtml = yearKeys.map(yr => {
    const group = byYear.get(yr)!
    return `
      <h2>Year ${yr ?? 'Unknown'} — ${group.length} student${group.length !== 1 ? 's' : ''}</h2>
      <table style="font-size:9pt;">
        <thead>
          <tr>
            <th style="width:18%;">Student</th>
            <th style="width:10%;">Status</th>
            <th style="width:14%;">Need area</th>
            <th style="width:10%;">Class</th>
            <th style="width:10%;">ILP</th>
            <th style="width:10%;">Targets</th>
            <th style="width:14%;">ILP review</th>
            <th style="width:14%;">EHCP review</th>
          </tr>
        </thead>
        <tbody>
          ${group.map(r => `<tr>
            <td style="font-weight:600;">${escHtml(r.studentName)}</td>
            <td>${statusBadge(r.sendStatus)}</td>
            <td>${escHtml(r.needArea ?? r.sendCategory ?? '—')}</td>
            <td>${escHtml(r.className ?? '—')}</td>
            <td>${ilpBadge(r.ilpStatus)}</td>
            <td style="text-align:center;">${r.activeTargetCount > 0 ? `<strong>${r.activeTargetCount}</strong> active` : '—'}</td>
            <td style="font-size:8.5pt;">${reviewDue(r.ilpReviewDate)}</td>
            <td style="font-size:8.5pt;">${reviewDue(r.ehcpReviewDate)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `
  }).join('')

  const body = `
    <h1>SEND Register</h1>
    <p style="color:#6b7280;font-size:10pt;margin-bottom:12pt;">
      ${escHtml(schoolName)} · Generated ${now} · Special Educational Needs and Disabilities Register
    </p>

    ${summaryHtml}

    ${tablesHtml}

    <p style="margin-top:20pt;font-size:9pt;color:#9ca3af;border-top:0.5pt solid #e5e7eb;padding-top:6pt;">
      This document is confidential and contains Special Category data under UK GDPR Article 9.
      Handle in accordance with your school's data protection policy. Do not share externally without appropriate consent.
      Generated by Omnis · ${now}
    </p>
  `

  return pdfShell(body, 'SEND Register', schoolName)
}
