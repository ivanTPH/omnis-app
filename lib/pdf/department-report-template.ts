import { pdfShell, escHtml } from './templates'

export type DeptClassRow = {
  name:           string
  subject:        string
  yearGroup:      number
  studentCount:   number
  sendCount:      number
  teacherNames:   string[]
  avgScore:       number | null
  completionRate: number | null
  ungradedCount:  number
}

export type DeptStaffRow = {
  name:          string
  email:         string
  classCount:    number
  studentCount:  number
  ungradedCount: number
  avgScore:      number | null
}

export type DepartmentReportData = {
  schoolName:    string
  department:    string
  subjects:      string[]
  totalClasses:  number
  totalStudents: number
  sendStudents:  number
  activeIlps:    number
  openConcerns:  number
  avgScore:      number | null
  avgCompletion: number | null
  totalUngraded: number
  classes:       DeptClassRow[]
  staff:         DeptStaffRow[]
}

function gradeLabel(score: number | null): string {
  if (score == null) return '—'
  const g = Math.max(1, Math.min(9, Math.round(score)))
  const letters: Record<number, string> = { 9:'A**',8:'A*',7:'A',6:'B',5:'C+',4:'C',3:'D',2:'E',1:'F' }
  return `${g} (${letters[g] ?? '?'})`
}

function ragBadge(score: number | null): string {
  if (score == null) return ''
  const color = score >= 5.5 ? '#16a34a' : score >= 4 ? '#d97706' : '#dc2626'
  const label = score >= 5.5 ? 'On Track' : score >= 4 ? 'Developing' : 'Needs Support'
  return `<span style="background:${color}20;color:${color};padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:700">${label}</span>`
}

export function departmentReportPdf(d: DepartmentReportData): string {
  const statsHtml = `
    <div class="two-col" style="margin-bottom:14pt">
      <div class="card card-blue">
        <div style="font-size:18pt;font-weight:700;color:#2563eb">${d.totalClasses}</div>
        <div class="meta">Classes</div>
      </div>
      <div class="card card-blue">
        <div style="font-size:18pt;font-weight:700;color:#2563eb">${d.totalStudents}</div>
        <div class="meta">Students</div>
      </div>
      <div class="card card-green">
        <div style="font-size:18pt;font-weight:700;color:#16a34a">${gradeLabel(d.avgScore)}</div>
        <div class="meta">Dept avg grade</div>
      </div>
      <div class="card card-green">
        <div style="font-size:18pt;font-weight:700;color:#16a34a">${d.avgCompletion != null ? Math.round(d.avgCompletion * 100) + '%' : '—'}</div>
        <div class="meta">Avg completion</div>
      </div>
      <div class="card card-amber">
        <div style="font-size:18pt;font-weight:700;color:#d97706">${d.sendStudents}</div>
        <div class="meta">SEND students</div>
      </div>
      <div class="card ${d.openConcerns > 0 ? 'card-red' : ''}">
        <div style="font-size:18pt;font-weight:700;color:${d.openConcerns > 0 ? '#dc2626' : '#374151'}">${d.openConcerns}</div>
        <div class="meta">Open concerns</div>
      </div>
    </div>`

  const classesHtml = `
    <table>
      <thead><tr>
        <th>Class</th><th>Subject</th><th>Year</th><th>Teacher(s)</th>
        <th style="text-align:right">Students</th>
        <th style="text-align:right">SEND</th>
        <th style="text-align:right">Avg Grade</th>
        <th style="text-align:right">Completion</th>
        <th>Status</th>
      </tr></thead>
      <tbody>
        ${d.classes.map(c => `
          <tr>
            <td>${escHtml(c.name)}</td>
            <td>${escHtml(c.subject)}</td>
            <td>Y${c.yearGroup}</td>
            <td class="text-sm">${escHtml(c.teacherNames.join(', ') || '—')}</td>
            <td style="text-align:right">${c.studentCount}</td>
            <td style="text-align:right">${c.sendCount > 0 ? c.sendCount : '—'}</td>
            <td style="text-align:right;font-weight:600">${gradeLabel(c.avgScore)}</td>
            <td style="text-align:right">${c.completionRate != null ? Math.round(c.completionRate * 100) + '%' : '—'}</td>
            <td>${ragBadge(c.avgScore)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`

  const staffHtml = d.staff.length === 0
    ? '<p class="text-muted">No staff data available.</p>'
    : `<table>
        <thead><tr>
          <th>Name</th><th>Email</th>
          <th style="text-align:right">Classes</th>
          <th style="text-align:right">Students</th>
          <th style="text-align:right">Avg Grade</th>
          <th style="text-align:right">To Mark</th>
        </tr></thead>
        <tbody>
          ${d.staff.map(s => `
            <tr>
              <td>${escHtml(s.name)}</td>
              <td class="text-sm">${escHtml(s.email)}</td>
              <td style="text-align:right">${s.classCount}</td>
              <td style="text-align:right">${s.studentCount}</td>
              <td style="text-align:right;font-weight:600">${gradeLabel(s.avgScore)}</td>
              <td style="text-align:right${s.ungradedCount > 0 ? ';color:#dc2626;font-weight:600' : ''}">${s.ungradedCount || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`

  const content = `
    <h1>${escHtml(d.department)} Department Report</h1>
    <p class="meta">${escHtml(d.schoolName)} · ${d.subjects.map(escHtml).join(', ')}</p>
    <hr class="divider">

    ${statsHtml}

    <h2>Class Performance</h2>
    ${classesHtml}

    <h2>Staff Overview</h2>
    ${staffHtml}

    <h2>SEND Summary</h2>
    <div class="two-col">
      <div class="card card-amber">
        <div style="font-size:16pt;font-weight:700;color:#d97706">${d.sendStudents}</div>
        <div class="meta">Students on SEND register</div>
      </div>
      <div class="card card-blue">
        <div style="font-size:16pt;font-weight:700;color:#2563eb">${d.activeIlps}</div>
        <div class="meta">Active ILPs</div>
      </div>
    </div>
  `

  return pdfShell(content, `${d.department} Department Report`, d.schoolName)
}
