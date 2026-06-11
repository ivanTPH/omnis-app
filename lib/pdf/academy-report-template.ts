import { pdfShell, escHtml } from './templates'
import type { AcademyStats, AcademySchoolRow } from '@/app/actions/academy'

function statusDot(status: 'good' | 'amber' | 'red' | 'info'): string {
  const colours = { good: '#16a34a', amber: '#d97706', red: '#dc2626', info: '#2563eb' }
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colours[status]};margin-right:6pt;vertical-align:middle"></span>`
}

function reportRow(label: string, value: string, detail: string, status: 'good' | 'amber' | 'red' | 'info'): string {
  return `
    <tr>
      <td style="width:50%">${statusDot(status)}${escHtml(label)}</td>
      <td style="font-weight:700;text-align:right">${escHtml(value)}</td>
      <td style="color:#6b7280;font-size:9pt">${escHtml(detail)}</td>
    </tr>
  `
}

export function academyReportPdf(
  stats: AcademyStats,
  schools: AcademySchoolRow[],
  trustName: string,
  generatedAt: string,
): string {
  const pendingOnboarding = schools.filter(s => !s.onboardedAt).length
  const staleSyncSchools  = schools.filter(s => s.lastSync &&
    Date.now() - new Date(s.lastSync).getTime() > 14 * 86_400_000).length
  const noSyncSchools     = schools.filter(s => !s.lastSync).length

  const complianceRows = `
    ${reportRow(
      'Schools onboarded',
      `${stats.onboardedSchools} / ${stats.totalSchools}`,
      pendingOnboarding > 0 ? `${pendingOnboarding} pending setup` : 'All complete',
      pendingOnboarding === 0 ? 'good' : pendingOnboarding <= 1 ? 'amber' : 'red',
    )}
    ${reportRow(
      'MIS sync current (≤14 days)',
      `${stats.totalSchools - staleSyncSchools - noSyncSchools} / ${stats.totalSchools}`,
      noSyncSchools > 0 ? `${noSyncSchools} never synced` : staleSyncSchools > 0 ? `${staleSyncSchools} overdue` : 'All current',
      staleSyncSchools + noSyncSchools === 0 ? 'good' : 'amber',
    )}
  `

  const sendRows = `
    ${reportRow('Active ILPs',      stats.totalActiveIlps.toString(), '', 'info')}
    ${reportRow('EHCP Plans',       stats.totalEhcps.toString(),      '', 'info')}
    ${reportRow(
      'Open SEND Concerns',
      stats.openConcerns.toString(),
      stats.openConcerns > 0 ? 'Requires review across trust' : 'No open concerns',
      stats.openConcerns === 0 ? 'good' : stats.openConcerns < 10 ? 'amber' : 'red',
    )}
  `

  const scaleRows = `
    ${reportRow('Total schools',  stats.totalSchools.toLocaleString(),  '', 'info')}
    ${reportRow('Total students', stats.totalStudents.toLocaleString(), '', 'info')}
    ${reportRow('Total staff',    stats.totalStaff.toLocaleString(),    '', 'info')}
  `

  const schoolRows = schools.map(s => {
    const syncAge = s.lastSync
      ? Math.floor((Date.now() - new Date(s.lastSync).getTime()) / 86_400_000)
      : null
    const syncLabel = syncAge == null ? 'Never' : syncAge === 0 ? 'Today' : `${syncAge}d ago`
    return `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.phase ?? '—')}</td>
        <td style="text-align:center">${s.studentCount}</td>
        <td style="text-align:center">${s.sendStudents}</td>
        <td style="text-align:center">${s.activeIlps}</td>
        <td style="text-align:center">${s.ehcps}</td>
        <td style="text-align:center;color:${s.openConcerns > 0 ? '#d97706' : '#9ca3af'}">${s.openConcerns}</td>
        <td style="text-align:center">${s.onboardedAt ? '✓' : '—'}</td>
        <td style="text-align:center;color:${syncAge != null && syncAge > 14 ? '#dc2626' : '#374151'}">${syncLabel}</td>
      </tr>
    `
  }).join('')

  const content = `
    <h1>${escHtml(trustName)} — Trust Report</h1>
    <p class="meta">Generated ${escHtml(generatedAt)} · Omnis Platform</p>
    <div class="spacer"></div>

    <h2>Compliance &amp; Setup</h2>
    <table><tbody>${complianceRows}</tbody></table>

    <h2>SEND Summary</h2>
    <table><tbody>${sendRows}</tbody></table>

    <h2>Scale</h2>
    <table><tbody>${scaleRows}</tbody></table>

    <h2>Schools</h2>
    <table>
      <thead>
        <tr>
          <th>School</th><th>Phase</th><th>Students</th>
          <th>SEND</th><th>ILPs</th><th>EHCPs</th>
          <th>Concerns</th><th>Onboarded</th><th>Last Sync</th>
        </tr>
      </thead>
      <tbody>${schoolRows}</tbody>
    </table>
  `

  return pdfShell(content, `Trust Report — ${trustName}`, trustName)
}
