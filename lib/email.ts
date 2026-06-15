import { Resend } from 'resend'

/**
 * Resend email client — no-ops gracefully when RESEND_API_KEY is absent
 * (local dev, CI) so server actions never throw on missing config.
 */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = 'Omnis <notifications@omnis.education>'

// ─── Shared send helper ──────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) return   // no-op in dev/CI
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    // Log but never throw — email delivery must not break server actions
    console.error('[email] send failed:', err)
  }
}

// ─── Transactional templates ─────────────────────────────────────────────────

/** Homework reminder email sent to a student. */
export async function sendHomeworkReminderEmail(params: {
  to: string
  studentFirstName: string
  homeworkTitle: string
  dueAt: Date | null
  homeworkUrl: string
}): Promise<void> {
  const { to, studentFirstName, homeworkTitle, dueAt, homeworkUrl } = params
  const dueStr = dueAt
    ? `due on <strong>${dueAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>`
    : 'due soon'

  await send(
    to,
    `Reminder: "${homeworkTitle}" is due`,
    `
    <p>Hi ${studentFirstName},</p>
    <p>This is a reminder that your homework <strong>${homeworkTitle}</strong> is ${dueStr}.</p>
    <p><a href="${homeworkUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View homework</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Notification email when homework is returned to a student. */
export async function sendHomeworkReturnedEmail(params: {
  to: string
  studentFirstName: string
  homeworkTitle: string
  grade: string
  feedbackUrl: string
}): Promise<void> {
  const { to, studentFirstName, homeworkTitle, grade, feedbackUrl } = params

  await send(
    to,
    `Your homework has been marked: "${homeworkTitle}"`,
    `
    <p>Hi ${studentFirstName},</p>
    <p>Your teacher has marked <strong>${homeworkTitle}</strong>.</p>
    <p>Your grade: <strong>${grade}</strong></p>
    <p><a href="${feedbackUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View feedback</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Password reset link email. */
export async function sendPasswordResetEmail(params: {
  to: string
  firstName: string
  resetUrl: string
}): Promise<void> {
  const { to, firstName, resetUrl } = params
  await send(
    to,
    'Reset your Omnis password',
    `
    <p>Hi ${firstName},</p>
    <p>We received a request to reset your Omnis password. Click the link below to choose a new password. The link expires in 1 hour.</p>
    <p><a href="${resetUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">Reset password</a></p>
    <p>If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Staff invitation email sent by school admin. */
export async function sendStaffInvitationEmail(params: {
  to: string
  firstName: string
  invitedBy: string
  schoolName: string
  role: string
  acceptUrl: string
}): Promise<void> {
  const { to, firstName, invitedBy, schoolName, role, acceptUrl } = params
  await send(
    to,
    `You've been invited to join ${schoolName} on Omnis`,
    `
    <p>Hi ${firstName},</p>
    <p>${invitedBy} has invited you to join <strong>${schoolName}</strong> on Omnis as <strong>${role}</strong>.</p>
    <p>Click below to set up your account. The link expires in 7 days.</p>
    <p><a href="${acceptUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">Accept invitation</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Welcome email for a newly provisioned student or parent account. */
export async function sendWelcomeAccountEmail(params: {
  to: string
  firstName: string
  role: 'student' | 'parent'
  schoolName: string
  activateUrl: string
}): Promise<void> {
  const { to, firstName, role, schoolName, activateUrl } = params
  const roleLabel = role === 'parent' ? 'parent/carer' : 'student'
  await send(
    to,
    `Your ${schoolName} Omnis account is ready`,
    `
    <p>Hi ${firstName},</p>
    <p>Your ${roleLabel} account on <strong>${schoolName}</strong>'s Omnis learning platform has been created.</p>
    <p>Click below to activate your account and set a password. The link expires in 7 days.</p>
    <p><a href="${activateUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">Activate my account</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform — ${schoolName}</p>
    `,
  )
}

/** SENCO reminder when an ILP review is due within 7 days. */
export async function sendIlpReviewDueEmail(params: {
  to: string
  sencoFirstName: string
  studentName: string
  reviewDueAt: Date
  ilpUrl: string
}): Promise<void> {
  const { to, sencoFirstName, studentName, reviewDueAt, ilpUrl } = params
  const dueStr = reviewDueAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  await send(
    to,
    `ILP review due soon: ${studentName}`,
    `
    <p>Hi ${sencoFirstName},</p>
    <p>A reminder that the ILP review for <strong>${studentName}</strong> is due on <strong>${dueStr}</strong>.</p>
    <p><a href="${ilpUrl}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View ILP</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** SENCO reminder when an EHCP annual review is due within 30 days. */
export async function sendEhcpReviewDueEmail(params: {
  to: string
  sencoFirstName: string
  studentName: string
  reviewDueAt: Date
  ehcpUrl: string
}): Promise<void> {
  const { to, sencoFirstName, studentName, reviewDueAt, ehcpUrl } = params
  const dueStr = reviewDueAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  await send(
    to,
    `EHCP annual review due: ${studentName}`,
    `
    <p>Hi ${sencoFirstName},</p>
    <p>The EHCP annual review for <strong>${studentName}</strong> is due on <strong>${dueStr}</strong>. Please ensure this is scheduled in good time.</p>
    <p><a href="${ehcpUrl}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View EHCP plan</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Notification to a student when new homework is published. */
export async function sendNewHomeworkEmail(params: {
  to: string
  studentFirstName: string
  homeworkTitle: string
  subject: string
  dueAt: Date | null
  homeworkUrl: string
}): Promise<void> {
  const { to, studentFirstName, homeworkTitle, subject, dueAt, homeworkUrl } = params
  const dueStr = dueAt
    ? `Due: <strong>${dueAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>`
    : 'No due date set'
  await send(
    to,
    `New homework: ${homeworkTitle}`,
    `
    <p>Hi ${studentFirstName},</p>
    <p>New <strong>${subject}</strong> homework has been set: <strong>${homeworkTitle}</strong></p>
    <p>${dueStr}</p>
    <p><a href="${homeworkUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">Start homework</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Notification to a parent when their child's grade is significantly below target. */
export async function sendGradeBelowTargetEmail(params: {
  to: string
  parentFirstName: string
  studentName: string
  subject: string
  achievedGrade: string
  targetGrade: string
  teacherName: string
  homeworkUrl: string
}): Promise<void> {
  const { to, parentFirstName, studentName, subject, achievedGrade, targetGrade, teacherName, homeworkUrl } = params
  await send(
    to,
    `Progress update for ${studentName} — ${subject}`,
    `
    <p>Hi ${parentFirstName},</p>
    <p>We wanted to keep you informed about ${studentName}'s recent <strong>${subject}</strong> homework.</p>
    <p>Target grade: <strong>${targetGrade}</strong> &nbsp;|&nbsp; Achieved: <strong>${achievedGrade}</strong></p>
    <p>${teacherName} has provided feedback. You can view the full result below.</p>
    <p><a href="${homeworkUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View result & feedback</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Notification to a parent when new homework is published for their child. */
export async function sendParentHomeworkNotificationEmail(params: {
  to: string
  parentFirstName: string
  studentName: string
  homeworkTitle: string
  subject: string
  dueAt: Date | null
  homeworkUrl: string
}): Promise<void> {
  const { to, parentFirstName, studentName, homeworkTitle, subject, dueAt, homeworkUrl } = params
  const due = dueAt
    ? dueAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'No due date set'

  await send(
    to,
    `New homework set for ${studentName}: ${homeworkTitle}`,
    `
    <p>Hi ${parentFirstName},</p>
    <p>New <strong>${subject}</strong> homework has been set for <strong>${studentName}</strong>:</p>
    <p style="font-size:16px;font-weight:bold;color:#1d4ed8;">${homeworkTitle}</p>
    <p><strong>Due:</strong> ${due}</p>
    <p style="color:#6b7280;font-size:13px;">Your child can access this on their Omnis student dashboard.</p>
    <p><a href="${homeworkUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View homework</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Email notification to a parent (or other recipient) when they receive a new message. */
export async function sendNewMessageEmail(params: {
  to: string
  recipientFirstName: string
  senderName: string
  threadSubject: string
  bodyPreview: string
  threadUrl: string
}): Promise<void> {
  const { to, recipientFirstName, senderName, threadSubject, bodyPreview, threadUrl } = params

  await send(
    to,
    `New message from ${senderName}: ${threadSubject}`,
    `
    <p>Hi ${recipientFirstName},</p>
    <p>You have a new message from <strong>${senderName}</strong> in the thread <em>${threadSubject}</em>:</p>
    <blockquote style="border-left:4px solid #e5e7eb;padding:8px 16px;color:#374151;margin:12px 0;">${bodyPreview}</blockquote>
    <p><a href="${threadUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View message</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** Overdue marking alert — submissions awaiting marking for 5+ days. */
export async function sendOverdueMarkingEmail(params: {
  to: string
  teacherFirstName: string
  items: Array<{ homeworkTitle: string; className: string; studentName: string; daysPending: number }>
  markingUrl: string
}): Promise<void> {
  const { to, teacherFirstName, items, markingUrl } = params

  const rows = items.map(i =>
    `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;">${i.studentName}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${i.homeworkTitle}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${i.className}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:${i.daysPending >= 10 ? '#dc2626' : '#d97706'};">${i.daysPending}d</td>
    </tr>`
  ).join('')

  await send(
    to,
    `Marking overdue — ${items.length} submission${items.length !== 1 ? 's' : ''} waiting`,
    `
    <p>Hi ${teacherFirstName},</p>
    <p>The following submissions have been waiting for marking for <strong>5 or more days</strong>. Students are waiting for feedback.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Student</th>
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Homework</th>
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Class</th>
          <th style="padding:6px 8px;text-align:right;font-weight:600;color:#374151;">Waiting</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;"><a href="${markingUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Go to Marking</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform · Overdue marking alert sent every Wednesday</p>
    `,
  )
}

/** Weekly digest email sent to a teacher with their homework queue and class stats. */
export async function sendTeacherDigestEmail(params: {
  to: string
  teacherFirstName: string
  ungradedCount: number
  dueThisWeek: Array<{ title: string; className: string; dueAt: Date | null }>
  classStats: Array<{ className: string; submitted: number; enrolled: number }>
  baseUrl: string
}): Promise<void> {
  const { to, teacherFirstName, ungradedCount, dueThisWeek, classStats, baseUrl } = params

  const dueRows = dueThisWeek.map(hw => {
    const dueStr = hw.dueAt
      ? hw.dueAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'TBC'
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${hw.title}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${hw.className}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${dueStr}</td></tr>`
  }).join('')

  const statsRows = classStats.map(cs => {
    const pct = cs.enrolled > 0 ? Math.round(cs.submitted / cs.enrolled * 100) : 0
    const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${cs.className}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:center;">${cs.submitted}/${cs.enrolled}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:700;color:${color};">${pct}%</td></tr>`
  }).join('')

  await send(
    to,
    `Your weekly Omnis digest — ${ungradedCount} submission${ungradedCount !== 1 ? 's' : ''} to mark`,
    `
    <p>Hi ${teacherFirstName},</p>
    <p>Here's your weekly summary for <strong>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>.</p>

    <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:12px 16px;border-radius:4px;margin:16px 0;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#1d4ed8;">${ungradedCount} submission${ungradedCount !== 1 ? 's' : ''} awaiting marking</p>
    </div>

    ${dueThisWeek.length > 0 ? `
    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:20px 0 8px;">Due this week</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Homework</th><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Class</th><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Due</th></tr></thead>
      <tbody>${dueRows}</tbody>
    </table>
    ` : ''}

    ${classStats.length > 0 ? `
    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:20px 0 8px;">Submission rates</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Class</th><th style="padding:6px 8px;text-align:center;font-weight:600;color:#374151;">Submitted</th><th style="padding:6px 8px;text-align:center;font-weight:600;color:#374151;">Rate</th></tr></thead>
      <tbody>${statsRows}</tbody>
    </table>
    ` : ''}

    <p style="margin-top:20px;"><a href="${baseUrl}/homework" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Go to Homework</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform · Weekly digest sent every Monday</p>
    `,
  )
}

/** Weekly digest for parents: child's overdue and upcoming homework. */
export async function sendParentHwDigestEmail(params: {
  to: string
  parentFirstName: string
  childName: string
  overdueItems: Array<{ title: string; className: string; dueAt: Date | null }>
  dueThisWeek:  Array<{ title: string; className: string; dueAt: Date | null }>
  baseUrl: string
}): Promise<void> {
  const { to, parentFirstName, childName, overdueItems, dueThisWeek, baseUrl } = params

  if (overdueItems.length === 0 && dueThisWeek.length === 0) return

  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC'

  const overdueRows = overdueItems.map(hw =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #fee2e2;color:#dc2626;font-weight:600;">${hw.title}</td><td style="padding:6px 8px;border-bottom:1px solid #fee2e2;color:#6b7280;">${hw.className}</td><td style="padding:6px 8px;border-bottom:1px solid #fee2e2;color:#dc2626;">${fmtDate(hw.dueAt)}</td></tr>`
  ).join('')

  const dueRows = dueThisWeek.map(hw =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${hw.title}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${hw.className}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${fmtDate(hw.dueAt)}</td></tr>`
  ).join('')

  await send(
    to,
    `${childName}'s homework summary — ${overdueItems.length > 0 ? `${overdueItems.length} overdue` : `${dueThisWeek.length} due this week`}`,
    `
    <p>Hi ${parentFirstName},</p>
    <p>Here is a summary of <strong>${childName}</strong>'s homework this week.</p>

    ${overdueItems.length > 0 ? `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">${overdueItems.length} overdue homework item${overdueItems.length !== 1 ? 's' : ''}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
      <thead><tr style="background:#fef2f2;"><th style="padding:6px 8px;text-align:left;font-weight:600;color:#991b1b;">Homework</th><th style="padding:6px 8px;text-align:left;font-weight:600;color:#991b1b;">Class</th><th style="padding:6px 8px;text-align:left;font-weight:600;color:#991b1b;">Was Due</th></tr></thead>
      <tbody>${overdueRows}</tbody>
    </table>` : ''}

    ${dueThisWeek.length > 0 ? `
    <h3 style="font-size:13px;font-weight:700;color:#374151;margin:20px 0 8px;">Due this week</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
      <thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Homework</th><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Class</th><th style="padding:6px 8px;text-align:left;font-weight:600;color:#374151;">Due</th></tr></thead>
      <tbody>${dueRows}</tbody>
    </table>` : ''}

    <p><a href="${baseUrl}/parent/dashboard" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">View ${childName}'s progress</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform · Weekly homework digest sent every Monday</p>
    `,
  )
}

/** Monthly SEND summary email to SENCO — open concerns, ILPs due, EHCPs due. */
export async function sendSendMonthlySummaryEmail(params: {
  to: string
  sencoFirstName: string
  schoolName: string
  openConcerns: number
  ilpsUnderReview: number
  ehcpsDue30: number
  topStudents: { name: string; concerns: number }[]
  dashboardUrl: string
}): Promise<void> {
  const { to, sencoFirstName, schoolName, openConcerns, ilpsUnderReview, ehcpsDue30, topStudents, dashboardUrl } = params

  const studentRows = topStudents.length > 0
    ? topStudents.map(s =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${s.name}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;color:#dc2626;font-weight:600;">${s.concerns}</td></tr>`
      ).join('')
    : '<tr><td colspan="2" style="padding:8px;color:#9ca3af;text-align:center;">No open concerns</td></tr>'

  await send(
    to,
    `SEND Monthly Summary — ${schoolName}`,
    `
    <p>Hi ${sencoFirstName},</p>
    <p>Here is your SEND summary for <strong>${schoolName}</strong>.</p>
    <table style="border-collapse:collapse;width:100%;max-width:400px;margin:16px 0;">
      <tr>
        <td style="padding:10px 14px;background:#fef3c7;border-radius:8px 8px 0 0;font-weight:600;color:#92400e;">Open Concerns</td>
        <td style="padding:10px 14px;background:#fef3c7;border-radius:8px 8px 0 0;text-align:right;font-weight:700;color:#dc2626;">${openConcerns}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#eff6ff;font-weight:600;color:#1d4ed8;">ILPs Under Review</td>
        <td style="padding:10px 14px;background:#eff6ff;text-align:right;font-weight:700;color:#1d4ed8;">${ilpsUnderReview}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;background:#f0fdf4;border-radius:0 0 8px 8px;font-weight:600;color:#166534;">EHCPs Due (30 days)</td>
        <td style="padding:10px 14px;background:#f0fdf4;border-radius:0 0 8px 8px;text-align:right;font-weight:700;color:#166534;">${ehcpsDue30}</td>
      </tr>
    </table>
    ${topStudents.length > 0 ? `
    <p style="font-weight:600;margin-top:20px;">Students with most open concerns:</p>
    <table style="border-collapse:collapse;width:100%;max-width:400px;">
      <thead><tr>
        <th style="padding:6px 8px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Student</th>
        <th style="padding:6px 8px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Concerns</th>
      </tr></thead>
      <tbody>${studentRows}</tbody>
    </table>` : ''}
    <p style="margin-top:20px;"><a href="${dashboardUrl}" style="background:#9333ea;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">View SEND Dashboard</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}

/** SENCO notification when a new SEND concern is raised for a student. */
export async function sendConcernRaisedEmail(params: {
  to: string
  sencoFirstName: string
  studentName: string
  concernCategory: string
  raisedBy: string
  concernUrl: string
}): Promise<void> {
  const { to, sencoFirstName, studentName, concernCategory, raisedBy, concernUrl } = params

  await send(
    to,
    `New SEND concern raised for ${studentName}`,
    `
    <p>Hi ${sencoFirstName},</p>
    <p>A new <strong>${concernCategory}</strong> concern has been raised for <strong>${studentName}</strong> by ${raisedBy}.</p>
    <p><a href="${concernUrl}" style="background:#9333ea;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px">View concern</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Omnis School Platform</p>
    `,
  )
}
