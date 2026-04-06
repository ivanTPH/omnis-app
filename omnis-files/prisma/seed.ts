import { PrismaClient, Role, HomeworkStatus, SubmissionStatus, ILPStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Omnis demo data...')

  const passwordHash = await bcrypt.hash('Demo1234!', 10)

  // ── School ──────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { id: 'school-omnis-demo' },
    update: {},
    create: {
      id: 'school-omnis-demo',
      name: 'Omnis Demo Academy',
      aiOptIn: false,
    },
  })

  // ── Term Dates ───────────────────────────────────────────
  await prisma.termDate.upsert({
    where: { id: 'term-spring-2026' },
    update: {},
    create: {
      id: 'term-spring-2026',
      schoolId: school.id,
      label: 'Spring Term 2026',
      startsAt: new Date('2026-01-06'),
      endsAt: new Date('2026-04-04'),
    },
  })

  // ── Users ────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'admin@omnisdemo.school',
      passwordHash,
      role: Role.SCHOOL_ADMIN,
      firstName: 'Sarah',
      lastName: 'Cole',
    },
  })

  const slt = await prisma.user.upsert({
    where: { email: 'a.whitfield@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'a.whitfield@omnisdemo.school',
      passwordHash,
      role: Role.SLT,
      firstName: 'Dr Anne',
      lastName: 'Whitfield',
    },
  })

  const hod = await prisma.user.upsert({
    where: { email: 'd.brooks@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'd.brooks@omnisdemo.school',
      passwordHash,
      role: Role.HEAD_OF_DEPT,
      firstName: 'Damian',
      lastName: 'Brooks',
      department: 'English',
    },
  })

  const hoy = await prisma.user.upsert({
    where: { email: 't.adeyemi@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 't.adeyemi@omnisdemo.school',
      passwordHash,
      role: Role.HEAD_OF_YEAR,
      firstName: 'Tom',
      lastName: 'Adeyemi',
      yearGroup: 10,
    },
  })

  const teacherEnglish = await prisma.user.upsert({
    where: { email: 'j.patel@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'j.patel@omnisdemo.school',
      passwordHash,
      role: Role.TEACHER,
      firstName: 'James',
      lastName: 'Patel',
      department: 'English',
    },
  })

  const teacherMaths = await prisma.user.upsert({
    where: { email: 'p.singh@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'p.singh@omnisdemo.school',
      passwordHash,
      role: Role.TEACHER,
      firstName: 'Priya',
      lastName: 'Singh',
      department: 'Mathematics',
    },
  })

  const senco = await prisma.user.upsert({
    where: { email: 'r.morris@omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'r.morris@omnisdemo.school',
      passwordHash,
      role: Role.SENCO,
      firstName: 'Rachel',
      lastName: 'Morris',
    },
  })

  const studentAlex = await prisma.user.upsert({
    where: { email: 'a.hughes@students.omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'a.hughes@students.omnisdemo.school',
      passwordHash,
      role: Role.STUDENT,
      firstName: 'Alex',
      lastName: 'Hughes',
      yearGroup: 10,
    },
  })

  const studentMia = await prisma.user.upsert({
    where: { email: 'm.johnson@students.omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'm.johnson@students.omnisdemo.school',
      passwordHash,
      role: Role.STUDENT,
      firstName: 'Mia',
      lastName: 'Johnson',
      yearGroup: 10,
    },
  })

  const studentOliver = await prisma.user.upsert({
    where: { email: 'o.tan@students.omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'o.tan@students.omnisdemo.school',
      passwordHash,
      role: Role.STUDENT,
      firstName: 'Oliver',
      lastName: 'Tan',
      yearGroup: 10,
    },
  })

  const parentLinda = await prisma.user.upsert({
    where: { email: 'l.hughes@parents.omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'l.hughes@parents.omnisdemo.school',
      passwordHash,
      role: Role.PARENT,
      firstName: 'Linda',
      lastName: 'Hughes',
    },
  })

  const parentDavid = await prisma.user.upsert({
    where: { email: 'd.tan@parents.omnisdemo.school' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'd.tan@parents.omnisdemo.school',
      passwordHash,
      role: Role.PARENT,
      firstName: 'David',
      lastName: 'Tan',
    },
  })

  // ── Parent-Student Links ─────────────────────────────────
  await prisma.parentStudentLink.upsert({
    where: { parentId_studentId: { parentId: parentLinda.id, studentId: studentAlex.id } },
    update: {},
    create: { parentId: parentLinda.id, studentId: studentAlex.id },
  })

  await prisma.parentStudentLink.upsert({
    where: { parentId_studentId: { parentId: parentDavid.id, studentId: studentOliver.id } },
    update: {},
    create: { parentId: parentDavid.id, studentId: studentOliver.id },
  })

  // ── Classes ──────────────────────────────────────────────
  const englishClass = await prisma.schoolClass.upsert({
    where: { id: 'class-10b-english' },
    update: {},
    create: {
      id: 'class-10b-english',
      schoolId: school.id,
      name: '10B English',
      subject: 'English',
      yearGroup: 10,
      department: 'English',
    },
  })

  const mathsClass = await prisma.schoolClass.upsert({
    where: { id: 'class-10b-maths' },
    update: {},
    create: {
      id: 'class-10b-maths',
      schoolId: school.id,
      name: '10B Mathematics',
      subject: 'Mathematics',
      yearGroup: 10,
      department: 'Mathematics',
    },
  })

  // ── Class Teachers ───────────────────────────────────────
  for (const [classId, userId] of [
    [englishClass.id, teacherEnglish.id],
    [englishClass.id, hod.id],
    [mathsClass.id, teacherMaths.id],
  ]) {
    await prisma.classTeacher.upsert({
      where: { classId_userId: { classId, userId } },
      update: {},
      create: { classId, userId },
    })
  }

  // ── Enrolments ───────────────────────────────────────────
  for (const [classId, userId] of [
    [englishClass.id, studentAlex.id],
    [englishClass.id, studentMia.id],
    [englishClass.id, studentOliver.id],
    [mathsClass.id, studentAlex.id],
    [mathsClass.id, studentMia.id],
    [mathsClass.id, studentOliver.id],
  ]) {
    await prisma.enrolment.upsert({
      where: { classId_userId: { classId, userId } },
      update: {},
      create: { classId, userId },
    })
  }

  // ── Lesson ───────────────────────────────────────────────
  const lesson = await prisma.lesson.upsert({
    where: { id: 'lesson-mice-men' },
    update: {},
    create: {
      id: 'lesson-mice-men',
      schoolId: school.id,
      classId: englishClass.id,
      title: 'Of Mice and Men — Friendship Themes',
      objectives: [
        'Analyse how Steinbeck presents friendship between George and Lennie',
        'Explore the theme of loneliness as a contrast to friendship',
        'Use textual evidence to support analytical points',
      ],
      scheduledAt: new Date('2026-03-04T09:00:00'),
      published: true,
      createdBy: teacherEnglish.id,
    },
  })

  // ── Homework (standard) ──────────────────────────────────
  const homework = await prisma.homework.upsert({
    where: { id: 'hw-mice-men-friendship' },
    update: {},
    create: {
      id: 'hw-mice-men-friendship',
      schoolId: school.id,
      classId: englishClass.id,
      lessonId: lesson.id,
      title: 'Of Mice and Men — Friendship Essay',
      instructions: `Write an analytical essay (400–600 words) exploring the theme of friendship in "Of Mice and Men".\n\nYour essay should:\n• Introduce the theme with reference to the historical context of 1930s America\n• Analyse at least two key moments where friendship is shown between George and Lennie\n• Include at least three pieces of direct quotation from the text\n• Explore how friendship contrasts with the loneliness felt by other characters\n• Conclude with a judgement about what Steinbeck wants the reader to understand about friendship`,
      modelAnswer: `A strong response will argue that Steinbeck presents friendship as both a source of hope and a tragic vulnerability. George and Lennie's relationship is defined by the shared dream of "livin' off the fatta the lan'", which sets them apart from the isolated ranch workers around them. Students should note Candy's envy and Crooks's bitterness as foils to this friendship. Top-band responses will consider whether friendship ultimately protects or destroys in the novel's context.`,
      gradingBands: {
        A: 'Sophisticated analysis with sustained argument, precise quotation, and contextual understanding',
        B: 'Clear analysis with relevant quotation and some contextual reference',
        C: 'Describes themes with some textual reference but limited analysis',
        D: 'Retells the story with little or no analytical comment',
      },
      dueAt: new Date('2026-03-11T23:59:00'),
      status: HomeworkStatus.PUBLISHED,
      createdBy: teacherEnglish.id,
    },
  })

  // ── Adapted Homework for Oliver ──────────────────────────
  await prisma.homework.upsert({
    where: { id: 'hw-mice-men-adapted-oliver' },
    update: {},
    create: {
      id: 'hw-mice-men-adapted-oliver',
      schoolId: school.id,
      classId: englishClass.id,
      lessonId: lesson.id,
      title: 'Of Mice and Men — Friendship Essay',
      instructions: `Write about the theme of friendship in "Of Mice and Men" (200–300 words).\n\nUse these sentence starters to help you:\n\n1. George and Lennie are friends because...\n2. One moment that shows their friendship is when... In this scene, Steinbeck writes "..." This tells us that...\n3. Other characters in the novel feel lonely because...\n4. I think Steinbeck wants us to understand that friendship...`,
      dueAt: new Date('2026-03-11T23:59:00'),
      status: HomeworkStatus.PUBLISHED,
      isAdapted: true,
      adaptedFor: studentOliver.id,
      createdBy: teacherEnglish.id,
    },
  })

  // ── Submissions ──────────────────────────────────────────
  // Alex — graded and returned
  const alexSubmission = await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId: homework.id, studentId: studentAlex.id } },
    update: {},
    create: {
      schoolId: school.id,
      homeworkId: homework.id,
      studentId: studentAlex.id,
      content: `Steinbeck presents friendship in "Of Mice and Men" as a rare and precious commodity in a world defined by loneliness and hardship. Set against the backdrop of 1930s America during the Great Depression, the novel uses the bond between George and Lennie to explore what it means to truly care for another person.\n\nThe most powerful symbol of their friendship is the shared dream of owning their own land. George tells Lennie, "We got a future. We got somebody to talk to that gives a damn about us." This shows that their friendship provides not just companionship but hope — something that separates them from the other ranch workers who drift alone from job to job.\n\nIn contrast, characters like Crooks and Candy highlight the loneliness that friendship protects against. Crooks bitterly tells Lennie, "A guy goes nuts if he ain't got nobody," revealing the psychological cost of isolation. Steinbeck uses Crooks as a foil to show what George and Lennie have that others lack.\n\nHowever, Steinbeck also suggests that in this world, friendship carries a terrible cost. George's love for Lennie ultimately leads to the novel's tragic ending. Their friendship, rather than saving them, makes them more vulnerable than the truly isolated characters who have nothing to lose.\n\nIn conclusion, Steinbeck presents friendship as the only thing that gives life meaning, but also as a source of unbearable pain in a world that cannot accommodate it.`,
      grade: 'B+',
      feedback: 'Excellent use of quotation and strong contextual awareness. To reach A, develop your analysis of the ending more fully — consider what George loses as well as what he does.',
      status: SubmissionStatus.RETURNED,
      submittedAt: new Date('2026-03-08T19:32:00'),
      markedAt: new Date('2026-03-09T14:15:00'),
    },
  })

  // Mia — flagged (high paste ratio)
  const miaSubmission = await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId: homework.id, studentId: studentMia.id } },
    update: {},
    create: {
      schoolId: school.id,
      homeworkId: homework.id,
      studentId: studentMia.id,
      content: `In "Of Mice and Men", John Steinbeck masterfully explores the theme of friendship through the complex relationship between George Milton and Lennie Small. The novella, set during the Great Depression of the 1930s, uses their bond as a lens through which to examine the human need for companionship and belonging in a world characterised by isolation and broken dreams. The friendship between George and Lennie is unique in the context of the novella, where most characters lead solitary, nomadic lives as itinerant workers. Their relationship is defined by mutual dependence and a shared vision of the future, encapsulated in the recurring motif of "livin' off the fatta the lan'".`,
      status: SubmissionStatus.UNDER_REVIEW,
      submittedAt: new Date('2026-03-09T21:14:00'),
    },
  })

  // Mia integrity signal
  await prisma.integritySignal.upsert({
    where: { submissionId: miaSubmission.id },
    update: {},
    create: {
      schoolId: school.id,
      submissionId: miaSubmission.id,
      pasteCount: 3,
      pasteCharRatio: 0.87,
      timeOnTaskSecs: 94,
      flagged: true,
      flagReason: 'high_paste_ratio',
    },
  })

  // ── ILP for Oliver ───────────────────────────────────────
  const ilp = await prisma.iLP.upsert({
    where: { id: 'ilp-oliver-tan' },
    update: {},
    create: {
      id: 'ilp-oliver-tan',
      schoolId: school.id,
      studentId: studentOliver.id,
      status: ILPStatus.ACTIVE,
      needsSummary: 'Oliver has identified difficulties with extended writing tasks and reading comprehension of complex texts. He benefits from scaffolded sentence starters, bullet-point structures, and shorter task segments. His verbal comprehension is strong.',
      reviewDueAt: new Date('2026-04-15'),
      activatedAt: new Date('2026-02-10'),
      activatedBy: senco.id,
    },
  })

  await prisma.iLPTarget.createMany({
    skipDuplicates: true,
    data: [
      {
        ilpId: ilp.id,
        description: 'Improve extended writing to produce structured paragraphs of 3+ sentences independently',
        successCriteria: 'Oliver produces a 3-sentence PEE paragraph without sentence starters in 3 consecutive tasks',
        subject: 'English',
      },
      {
        ilpId: ilp.id,
        description: 'Improve comprehension of complex literary texts',
        successCriteria: 'Oliver can identify and explain authorial intent in unseen texts with 70% accuracy',
        subject: 'English',
      },
    ],
  })

  await prisma.iLPNote.createMany({
    skipDuplicates: true,
    data: [
      {
        ilpId: ilp.id,
        authorId: teacherEnglish.id,
        content: 'Oliver engages well in class discussion and demonstrates strong verbal understanding of texts. The gap is in translating this to written form. Bullet-point scaffolds have been effective in recent lessons.',
        isInternal: true,
      },
      {
        ilpId: ilp.id,
        authorId: senco.id,
        content: 'ILP activated following review meeting on 10 February. Targets agreed with Oliver and his parents. Review scheduled for 15 April.',
        isInternal: false,
      },
    ],
  })

  // ── Audit Logs ───────────────────────────────────────────
  await prisma.auditLog.createMany({
    skipDuplicates: true,
    data: [
      {
        schoolId: school.id,
        actorId: teacherEnglish.id,
        action: 'HOMEWORK_PUBLISHED',
        targetType: 'Homework',
        targetId: homework.id,
        metadata: { title: homework.title },
      },
      {
        schoolId: school.id,
        actorId: teacherEnglish.id,
        action: 'HOMEWORK_ADAPTED',
        targetType: 'Homework',
        targetId: 'hw-mice-men-adapted-oliver',
        metadata: { adaptedFor: studentOliver.id },
      },
      {
        schoolId: school.id,
        actorId: teacherEnglish.id,
        action: 'SUBMISSION_GRADED',
        targetType: 'Submission',
        targetId: alexSubmission.id,
        metadata: { grade: 'B+', studentId: studentAlex.id },
      },
      {
        schoolId: school.id,
        actorId: teacherEnglish.id,
        action: 'SUBMISSION_RETURNED',
        targetType: 'Submission',
        targetId: alexSubmission.id,
        metadata: { studentId: studentAlex.id },
      },
      {
        schoolId: school.id,
        actorId: senco.id,
        action: 'ILP_ACTIVATED',
        targetType: 'ILP',
        targetId: ilp.id,
        metadata: { studentId: studentOliver.id },
      },
      {
        schoolId: school.id,
        actorId: school.id as unknown as string,
        action: 'INTEGRITY_FLAGGED',
        targetType: 'Submission',
        targetId: miaSubmission.id,
        metadata: { pasteCharRatio: 0.87, flagReason: 'high_paste_ratio' },
      },
    ],
  })

  console.log('')
  console.log('✅ Demo data seeded successfully!')
  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Demo Login Accounts (password: Demo1234!)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  School Admin:  admin@omnisdemo.school')
  console.log('  Teacher:       j.patel@omnisdemo.school')
  console.log('  Teacher:       p.singh@omnisdemo.school')
  console.log('  SENCo:         r.morris@omnisdemo.school')
  console.log('  Head of Year:  t.adeyemi@omnisdemo.school')
  console.log('  Head of Dept:  d.brooks@omnisdemo.school')
  console.log('  Student:       a.hughes@students.omnisdemo.school')
  console.log('  Student:       m.johnson@students.omnisdemo.school')
  console.log('  Student:       o.tan@students.omnisdemo.school')
  console.log('  Parent:        l.hughes@parents.omnisdemo.school')
  console.log('  Parent:        d.tan@parents.omnisdemo.school')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
