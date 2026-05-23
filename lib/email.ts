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
