import { prisma } from '@/lib/prisma'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/accounts/placeholder'
import { getNameReview } from '@/lib/mis-review'

/**
 * Go-live checklist.
 *
 * A school is "live" once its admin has completed every required item and
 * pressed "Go live". Until then:
 *  - staff see a pop-up listing what is still outstanding;
 *  - pupil and parent invitations cannot be sent;
 *  - parents cannot register, and pupils/parents cannot request sign-in links.
 *
 * Nothing here sends email or changes data; it only reads the school's state.
 */

export type GoLiveItem = {
  key:      string
  label:    string
  detail:   string   // plain-English explanation of what is needed or what was found
  done:     boolean
  required: boolean
  href:     string   // where the school admin fixes it
  who:      string   // who normally does it
}

export type GoLiveStatus = {
  live:          boolean
  goLiveAt:      Date | null
  isDemo:        boolean
  items:         GoLiveItem[]
  requiredDone:  number
  requiredTotal: number
  readyToGoLive: boolean
}

export async function getGoLiveStatus(schoolId: string): Promise<GoLiveStatus> {
  const school = await prisma.school.findUnique({
    where:  { id: schoolId },
    select: {
      goLiveAt: true, isDemo: true, onboardedAt: true, orgDpaSignedAt: true,
      dpoName: true, dpoEmail: true, familyContactEmail: true,
    },
  })
  if (!school) throw new Error('School not found')

  const [
    wondeLink, lastGoodSync, pupils, pupilsWithEmail, misClasses, omnisClasses, classesNoTeacher,
    subjectConfigs, calendarEntries, sencos, teachers, admins, retentionReviewed, nameReview,
  ] = await Promise.all([
    prisma.wondeSchool.findUnique({ where: { schoolId }, select: { id: true } }),
    prisma.wondeSyncLog.findFirst({
      where:   { schoolId, status: { in: ['success', 'partial'] } },
      orderBy: { startedAt: 'desc' },
      select:  { completedAt: true, startedAt: true },
    }),
    prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
    prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true, NOT: { email: { endsWith: `@${PLACEHOLDER_EMAIL_DOMAIN}` } } } }),
    prisma.wondeClass.count({ where: { schoolId } }),
    prisma.schoolClass.count({ where: { schoolId } }),
    prisma.schoolClass.count({ where: { schoolId, teachers: { none: {} } } }),
    prisma.subjectConfig.count({ where: { schoolId } }),
    prisma.schoolCalendar.count({ where: { schoolId } }),
    prisma.user.count({ where: { schoolId, role: 'SENCO', isActive: true } }),
    prisma.user.count({ where: { schoolId, role: { in: ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR'] }, isActive: true } }),
    prisma.user.count({ where: { schoolId, role: 'SCHOOL_ADMIN', isActive: true } }),
    prisma.auditLog.count({ where: { schoolId, action: 'RETENTION_SCHEDULE_UPDATED' } }),
    getNameReview(schoolId),
  ])

  const emailPct = pupils > 0 ? Math.round((pupilsWithEmail / pupils) * 100) : 0
  const syncDate = lastGoodSync?.completedAt ?? lastGoodSync?.startedAt ?? null

  const items: GoLiveItem[] = [
    {
      key: 'profile', required: true, who: 'School admin', href: '/admin/onboarding',
      label: 'School details and data agreement',
      done: !!school.onboardedAt && !!school.orgDpaSignedAt,
      detail: school.orgDpaSignedAt
        ? 'School profile completed and the data processing agreement accepted.'
        : 'Complete the school profile and accept the data processing agreement.',
    },
    {
      key: 'dpo', required: true, who: 'School admin', href: '/admin/dashboard',
      label: 'Data Protection Officer contact',
      done: !!school.dpoName && !!school.dpoEmail,
      detail: school.dpoEmail
        ? `Pupils and parents are shown ${school.dpoName ?? 'the DPO'} (${school.dpoEmail}).`
        : 'Add your DPO’s name and email. Pupils and parents are shown this contact.',
    },
    {
      key: 'wonde', required: true, who: 'School admin or IT (in the Wonde portal)', href: '/admin/wonde',
      label: 'Wonde access approved and MIS connected',
      done: !!wondeLink && !!syncDate,
      detail: !wondeLink
        ? 'Approve Omnis in your Wonde portal: pupils and pupil contact details, parents/carers, staff and staff contact details, classes with their teachers, timetable and SEN. Then connect it here.'
        : syncDate
          ? `Last successful MIS sync: ${syncDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
          : 'Wonde is connected but no sync has completed yet. Run a sync from the Wonde page.',
    },
    {
      key: 'pupils', required: true, who: 'Automatic (Wonde sync)', href: '/admin/users',
      label: 'Pupil records imported',
      done: pupils > 0,
      detail: pupils > 0 ? `${pupils} pupil records.` : 'No pupils yet. They arrive with the first Wonde sync.',
    },
    {
      key: 'classes', required: true, who: 'Automatic (Wonde sync), checked by the school', href: '/admin/mis-review#classes',
      label: 'Classes and teaching groups',
      done: omnisClasses > 0,
      detail: omnisClasses > 0
        ? `${omnisClasses} classes in Omnis${classesNoTeacher ? `; ${classesNoTeacher} have no teacher yet (check Wonde permissions for staff classes, or add teachers on the Classes page)` : ''}. Ask a few teachers to check their classes.`
        : misClasses > 0
          ? `${misClasses} classes in the MIS, but none set up in Omnis yet. They are created at the next Wonde sync.`
          : 'No classes yet. They arrive with the Wonde sync, or can be added by hand.',
    },
    {
      key: 'staff', required: true, who: 'School admin', href: '/admin/mis-review#staff',
      label: 'Key staff accounts',
      done: admins > 0 && sencos > 0 && teachers > 0,
      detail: `School admin: ${admins}. SENCO: ${sencos}. Teachers and leaders: ${teachers}. At least one of each is needed.`,
    },
    {
      key: 'family-contact', required: true, who: 'School admin', href: '/admin/invitations',
      label: 'Contact email for pupils and families',
      done: !!school.familyContactEmail,
      detail: school.familyContactEmail
        ? `Invitations will tell families to contact ${school.familyContactEmail}.`
        : 'Add the email address families should use for questions (for example the school office).',
    },
    {
      key: 'curriculum', required: false, who: 'Heads of department', href: '/admin/subjects',
      label: 'Subjects and exam boards',
      done: subjectConfigs > 0,
      detail: subjectConfigs > 0 ? `${subjectConfigs} subjects set up.` : 'Set the exam board and tier for each subject, so homework and grades match your courses.',
    },
    {
      key: 'calendar', required: false, who: 'School admin', href: '/admin/calendar',
      label: 'Term dates and school calendar',
      done: calendarEntries > 0,
      detail: calendarEntries > 0 ? 'Calendar entries added.' : 'Add term dates and INSET days so reminders and deadlines avoid holidays.',
    },
    {
      key: 'retention', required: false, who: 'School admin with the DPO', href: '/admin/gdpr',
      label: 'Retention schedule reviewed',
      done: retentionReviewed > 0,
      detail: retentionReviewed > 0 ? 'Retention schedule confirmed.' : 'Check the default retention periods (IRMS toolkit) match your school’s policy.',
    },
    {
      key: 'same-name', required: false, who: 'School admin', href: '/admin/mis-review#same-name',
      label: 'Pupils to check by hand',
      done: nameReview.length === 0,
      detail: nameReview.length === 0
        ? 'Every MIS pupil is linked safely.'
        : `${nameReview.length} pupil(s) share a name with an existing account, so Omnis didn’t link them. Check and link them, or create new accounts.`,
    },
    {
      key: 'pupil-emails', required: false, who: 'School admin or IT', href: '/admin/mis-review#pupil-emails',
      label: 'Pupil email addresses',
      done: pupils > 0 && pupilsWithEmail === pupils,
      detail: pupils === 0
        ? 'No pupils yet.'
        : `${pupilsWithEmail} of ${pupils} pupils (${emailPct}%) have a school email address. Pupils without one cannot be invited. Grant “contact details” in Wonde or upload a CSV.`,
    },
  ]

  const required = items.filter(i => i.required)
  const requiredDone = required.filter(i => i.done).length
  return {
    live:          !!school.goLiveAt || school.isDemo,
    goLiveAt:      school.goLiveAt,
    isDemo:        school.isDemo,
    items,
    requiredDone,
    requiredTotal: required.length,
    readyToGoLive: requiredDone === required.length,
  }
}

/** Cheap check used by sign-in and registration paths. Demo schools always count as live. */
export async function isSchoolLive(schoolId: string): Promise<boolean> {
  const s = await prisma.school.findUnique({ where: { id: schoolId }, select: { goLiveAt: true, isDemo: true } })
  return !!s && (!!s.goLiveAt || s.isDemo)
}
