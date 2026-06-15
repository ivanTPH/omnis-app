import { pdfShell, escHtml } from './templates'

export type AttendanceLetterData = {
  studentName:         string
  yearGroup:           number | null
  tutorGroup?:         string | null
  attendancePct:       number
  schoolName:          string
  schoolAddress?:      string | null
  headteacherName?:    string | null
  letterDate:          Date
  parentGuardianName?: string | null
}

export function attendanceLetterPdf(data: AttendanceLetterData): string {
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const pct    = data.attendancePct.toFixed(1)
  const isSerious = data.attendancePct < 85

  const sessionsMissed = Math.round((1 - data.attendancePct / 100) * 380) // 190 school days × 2 sessions
  const urgency = isSerious
    ? 'We are writing to inform you that your child\'s attendance has fallen to a level that gives us serious concern and requires immediate improvement.'
    : 'We are writing to inform you that your child\'s attendance is below the nationally expected level of 90% and we would like to work with you to address this.'

  const threshold = isSerious
    ? 'Below 85% attendance is classified as persistent absenteeism and may result in a referral to the Local Authority.'
    : 'Pupils attending school below 90% are classified as regularly absent, which has a significant impact on learning and attainment.'

  const body = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20pt;">
      <div>
        <h1 style="font-size:15pt;color:#1e3a5f;margin-bottom:2pt;">${escHtml(data.schoolName)}</h1>
        ${data.schoolAddress ? `<p style="font-size:9pt;color:#6b7280;margin:0;">${escHtml(data.schoolAddress)}</p>` : ''}
      </div>
      <div style="text-align:right;">
        <p style="font-size:10pt;color:#374151;margin:0;">${fmtDate(data.letterDate)}</p>
      </div>
    </div>

    <hr class="divider" />

    <p style="margin-top:14pt;font-size:10pt;">
      ${data.parentGuardianName ? `Dear ${escHtml(data.parentGuardianName)},` : 'Dear Parent / Guardian,'}
    </p>

    <p style="margin-top:10pt;">
      <strong>Re: Attendance Concern — ${escHtml(data.studentName)}</strong>
      ${data.yearGroup ? ` (Year ${data.yearGroup}${data.tutorGroup ? `, ${data.tutorGroup}` : ''})` : ''}
    </p>

    <p>${escHtml(urgency)}</p>

    <div class="card card-${isSerious ? 'red' : 'amber'}" style="margin:14pt 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Current Attendance</p>
          <p style="font-size:22pt;font-weight:700;color:${isSerious ? '#dc2626' : '#d97706'};margin:0;">${pct}%</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">Estimated sessions missed</p>
          <p style="font-size:22pt;font-weight:700;color:#374151;margin:0;">${sessionsMissed}</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:9pt;color:#6b7280;margin:0 0 2pt;">School target</p>
          <p style="font-size:22pt;font-weight:700;color:#16a34a;margin:0;">95%+</p>
        </div>
      </div>
    </div>

    <p>${escHtml(threshold)}</p>

    <h2 style="font-size:12pt;margin-top:16pt;">Why Attendance Matters</h2>
    <p>
      Research consistently shows that attendance is one of the strongest predictors of academic achievement.
      Missing even a small proportion of school days can result in gaps in learning that are difficult to recover.
      Pupils who attend regularly are more likely to achieve their potential, build positive relationships with
      their peers, and benefit fully from the school's support and enrichment activities.
    </p>

    <h2 style="font-size:12pt;margin-top:16pt;">What We Ask of You</h2>
    <ul>
      <li>Ensure ${escHtml(data.studentName.split(' ')[0])} attends school every day unless genuinely ill.</li>
      <li>Contact the school office before 8:30 am on any day of absence.</li>
      <li>Avoid booking holidays during term time — requests will only be considered in exceptional circumstances.</li>
      <li>Speak to your child's Head of Year or Tutor if there are underlying reasons for absence so we can offer support.</li>
    </ul>

    <h2 style="font-size:12pt;margin-top:16pt;">Next Steps</h2>
    <p>
      We would like to invite you to contact the school to discuss how we can support ${escHtml(data.studentName.split(' ')[0])}'s
      attendance together. Our Pastoral team is available to help identify any barriers and put appropriate
      support in place.
    </p>
    <p>
      If attendance does not improve, we may need to take further action in line with our attendance policy,
      including referral to the Local Authority's Attendance Service.
    </p>

    <div style="margin-top:24pt;">
      <p>Yours sincerely,</p>
      <div style="height:36pt;"></div>
      <p style="font-weight:600;">${data.headteacherName ? escHtml(data.headteacherName) : '_______________________'}</p>
      <p style="font-size:9pt;color:#6b7280;">${data.headteacherName ? 'Headteacher' : 'Headteacher / Head of Year'}</p>
      <p style="font-size:9pt;color:#6b7280;">${escHtml(data.schoolName)}</p>
    </div>

    <p style="margin-top:24pt; font-size:8pt; color:#9ca3af; border-top:0.5pt solid #e5e7eb; padding-top:6pt;">
      This letter is generated by the Omnis school management platform. ${escHtml(data.schoolName)} · ${fmtDate(data.letterDate)}
    </p>
  `

  return pdfShell(body, `Attendance Letter — ${data.studentName}`, data.schoolName)
}
