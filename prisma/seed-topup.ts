/**
 * Top-up seed — adds demo data ON TOP of real Wonde-synced data.
 * Safe to re-run (uses upsert / existence checks throughout).
 *
 * Adds: SEND flags, lessons, homework, submissions, ILPs, messages, concerns.
 * Does NOT touch Wonde* tables or existing User/SchoolClass data.
 */

import { PrismaClient, HomeworkType, SubmissionStatus } from '@prisma/client'

const prisma = new PrismaClient()

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(9, 0, 0, 0)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(9, 0, 0, 0)
  return d
}

// ── Lesson content by subject ─────────────────────────────────────────────────

const LESSON_TOPICS: Record<string, Array<{ title: string; topic: string; objectives: string[] }>> = {
  English: [
    {
      title:      "An Inspector Calls — Sheila's Development",
      topic:      'An Inspector Calls',
      objectives: [
        'Analyse how Priestley presents Sheila as a vehicle for social change',
        'Identify and comment on the dramatic effect of dramatic irony in Act 1',
        'Write a structured PEE paragraph responding to an unseen question',
      ],
    },
    {
      title:      'Power and Conflict — Ozymandias Close Reading',
      topic:      'Power and Conflict Poetry',
      objectives: [
        'Explore Shelley\'s use of extended metaphor and irony',
        'Comment on how form and structure reinforce meaning',
        'Compare attitudes to power with at least one other poem in the cluster',
      ],
    },
    {
      title:      'Language Paper 1 — Narrative Writing Techniques',
      topic:      'AQA Language Paper 1',
      objectives: [
        'Apply a range of narrative techniques: foreshadowing, in medias res, unreliable narrator',
        'Structure a response to a fiction writing task using a clear story arc',
        'Self-assess writing against AQA Assessment Objectives',
      ],
    },
  ],
  Maths: [
    {
      title:      'Solving Quadratic Equations by Factorisation',
      topic:      'Algebra — Quadratics',
      objectives: [
        'Factorise quadratic expressions of the form x² + bx + c',
        'Solve quadratic equations by setting each factor equal to zero',
        'Apply quadratics to solve word problems in context',
      ],
    },
    {
      title:      'Simultaneous Equations — Graphical and Algebraic Methods',
      topic:      'Algebra — Simultaneous Equations',
      objectives: [
        'Solve simultaneous equations algebraically using elimination',
        'Interpret solutions as the intersection of two straight-line graphs',
        'Identify when simultaneous equations have no solution or infinite solutions',
      ],
    },
    {
      title:      'Trigonometry — SOHCAHTOA and Exact Values',
      topic:      'Geometry — Trigonometry',
      objectives: [
        'Apply SOHCAHTOA to find missing sides and angles in right-angled triangles',
        'Recall and use exact trigonometric values for 30°, 45°, 60°',
        'Solve multi-step problems involving trigonometry in context',
      ],
    },
  ],
  Science: [
    {
      title:      'Cell Division — Mitosis and the Cell Cycle',
      topic:      'Cell Biology',
      objectives: [
        'Describe the stages of mitosis: prophase, metaphase, anaphase, telophase',
        'Explain why mitosis produces genetically identical daughter cells',
        'Apply knowledge of the cell cycle to explain cancer growth',
      ],
    },
    {
      title:      'Chemical Bonding — Ionic and Covalent Structures',
      topic:      'Atomic Structure and Bonding',
      objectives: [
        'Explain how ionic bonds form between metals and non-metals',
        'Draw dot-and-cross diagrams for simple covalent molecules',
        'Compare properties of ionic and covalent substances using structure and bonding',
      ],
    },
    {
      title:      'Forces and Motion — Newton\'s Laws',
      topic:      'Forces',
      objectives: [
        "Apply Newton's first and second laws (F = ma) to calculate resultant force",
        'Interpret velocity–time graphs to determine acceleration and distance',
        "Evaluate the relevance of Newton's third law to everyday scenarios",
      ],
    },
  ],
  Geography: [
    {
      title:      'Coastal Landforms — Erosion and Deposition',
      topic:      'Physical Geography: Coasts',
      objectives: [
        'Describe the processes of hydraulic action, abrasion and attrition',
        'Explain the formation of headlands, bays, caves, arches and stacks',
        'Analyse OS map evidence of coastal landforms',
      ],
    },
    {
      title:      'Urban Issues — Mumbai Case Study',
      topic:      'Urban Geography',
      objectives: [
        'Explain why Mumbai is a rapidly growing megacity',
        'Evaluate the challenges of providing housing and services in Dharavi',
        'Compare quality of life indicators between different urban areas',
      ],
    },
  ],
  History: [
    {
      title:      'Weimar Republic — Strengths and Weaknesses',
      topic:      'Germany 1918–1939',
      objectives: [
        'Explain why the Weimar Republic faced opposition from left and right',
        'Assess the significance of the 1923 crisis in weakening Weimar democracy',
        'Evaluate how far the constitution was a weakness for Weimar Germany',
      ],
    },
    {
      title:      'The Treaty of Versailles — Impact on Germany',
      topic:      'Germany 1918–1939',
      objectives: [
        'Identify and explain the key terms of the Treaty of Versailles',
        'Evaluate German reactions to the treaty using contemporary sources',
        'Assess the long-term consequences for political stability in Germany',
      ],
    },
  ],
  Computing: [
    {
      title:      'Algorithms — Searching and Sorting',
      topic:      'Algorithms',
      objectives: [
        'Trace through binary search and linear search with examples',
        'Compare bubble sort and merge sort in terms of efficiency',
        'Express algorithms as flowcharts and pseudocode',
      ],
    },
    {
      title:      'Networks — TCP/IP and the Internet',
      topic:      'Computer Networks',
      objectives: [
        'Describe the layers of the TCP/IP model and their functions',
        'Explain how data is packetised and routed across the internet',
        'Evaluate the security implications of HTTP vs HTTPS',
      ],
    },
  ],
}

function getLessonTopics(subject: string) {
  return LESSON_TOPICS[subject] ?? LESSON_TOPICS['English']
}

// ── Homework content by subject ───────────────────────────────────────────────

function getHomeworkContent(subject: string, topicTitle: string, type: HomeworkType) {
  if (type === HomeworkType.MCQ_QUIZ) {
    return {
      instructions: `Answer all questions carefully. Each question has one correct answer.
You have 20 minutes to complete this quiz. Do not use any notes or resources.`,
      modelAnswer: `See individual question answers provided in the question bank.`,
      questionsJson: [
        { prompt: `Based on your study of ${topicTitle}, which statement is most accurate?`, answer: 'Option A', marks: 1, type: 'mcq', options: ['Option A', 'Option B', 'Option C', 'Option D'] },
        { prompt: `Which of the following best explains the key concept from ${topicTitle}?`, answer: 'Option C', marks: 1, type: 'mcq', options: ['Option A', 'Option B', 'Option C', 'Option D'] },
        { prompt: `What is the significance of the main idea in ${topicTitle}?`, answer: 'Option B', marks: 1, type: 'mcq', options: ['Option A', 'Option B', 'Option C', 'Option D'] },
      ],
    }
  }
  return {
    instructions: `Write your response in full sentences. Aim for 3–5 paragraphs.
Use specific examples and evidence from your class notes and textbook.
Show your understanding of key vocabulary from our recent lessons on ${topicTitle}.`,
    modelAnswer: `A strong response would: (1) clearly address the question, (2) use relevant evidence and examples, (3) demonstrate understanding of key concepts from ${topicTitle}, and (4) use subject-specific vocabulary accurately.`,
    questionsJson: [
      { prompt: `Describe the key features of ${topicTitle}.`, answer: 'Should identify at least 3 key features with explanation.', marks: 3, type: 'short_answer' },
      { prompt: `Explain how ${topicTitle} relates to the broader topic studied this term.`, answer: 'Should show connections to prior learning.', marks: 3, type: 'short_answer' },
      { prompt: `Evaluate the importance of ${topicTitle}. Use evidence to support your answer.`, answer: 'Must include at least one piece of supporting evidence.', marks: 3, type: 'short_answer' },
    ],
  }
}

// Realistic feedback phrases
const FEEDBACK_PHRASES = [
  'Good effort — your use of evidence is strong. Focus on developing your explanations further.',
  'Excellent work. You have clearly understood the key concepts. Extend your analysis next time.',
  'Solid attempt. Make sure you are always linking back to the question in each paragraph.',
  'Well done. Your answer is clear and well-structured. Try to include more technical vocabulary.',
  'Good understanding shown. Some points needed more development — see verbal feedback.',
  'Strong answer with good use of subject terminology. Keep this up.',
  'You have addressed the question but some points lack supporting evidence.',
  'Very impressive response — shows real depth of understanding.',
]

// ── Main seed ─────────────────────────────────────────────────────────────────

async function main() {
  const school = await prisma.school.findFirst()
  if (!school) throw new Error('No school found — run main seed first')
  const schoolId = school.id

  console.log(`\n🏫  School: ${school.name} (${schoolId})`)

  // ── STEP 1: Collect real users ─────────────────────────────────────────────

  const allStudents = await prisma.user.findMany({
    where:   { schoolId, role: 'STUDENT', isActive: true },
    select:  { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
    take:    200,
  })

  const teachers = await prisma.user.findMany({
    where:   { schoolId, role: 'TEACHER', isActive: true },
    select:  { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
    take:    3,
  })

  const senco = await prisma.user.findFirst({
    where:  { schoolId, role: 'SENCO' },
    select: { id: true },
  })

  console.log(`   ${allStudents.length} students, ${teachers.length} teachers found`)

  // ── STEP 2: SEND flags for ~15% of students ────────────────────────────────

  const sendAssignments: Array<{ needArea: string; activeStatus: 'SEN_SUPPORT' | 'EHCP'; count: number }> = [
    { needArea: 'Dyslexia',                             activeStatus: 'SEN_SUPPORT', count: 8 },
    { needArea: 'ADHD',                                 activeStatus: 'SEN_SUPPORT', count: 5 },
    { needArea: 'ASD / Autism',                         activeStatus: 'SEN_SUPPORT', count: 4 },
    { needArea: 'EAL — English as Additional Language', activeStatus: 'SEN_SUPPORT', count: 4 },
    { needArea: 'Speech & Language Difficulties',       activeStatus: 'SEN_SUPPORT', count: 3 },
    { needArea: 'Visual Impairment / Physical',         activeStatus: 'SEN_SUPPORT', count: 3 },
    { needArea: 'EHCP — Complex Learning Needs',        activeStatus: 'EHCP',        count: 3 },
  ]

  const ehcpStudentIds: string[] = []
  let studentIdx = 0
  let totalSend = 0

  for (const assignment of sendAssignments) {
    for (let i = 0; i < assignment.count; i++) {
      // Space through the student list (every ~6th student)
      studentIdx = Math.min(studentIdx + 6, allStudents.length - 1)
      const student = allStudents[studentIdx]
      if (!student) continue

      await prisma.sendStatus.upsert({
        where:  { studentId: student.id },
        create: {
          studentId:    student.id,
          activeStatus: assignment.activeStatus,
          activeSource: 'topup-seed',
          needArea:     assignment.needArea,
        },
        update: {
          activeStatus: assignment.activeStatus,
          needArea:     assignment.needArea,
        },
      })

      if (assignment.activeStatus === 'EHCP') {
        ehcpStudentIds.push(student.id)
      }
      totalSend++
    }
  }

  console.log(`\n✅  Step 2: ${totalSend} SEND records upserted (${ehcpStudentIds.length} EHCP)`)

  // ── STEP 3 & 4: Lessons + Homework + Submissions ───────────────────────────

  let lessonsCreated = 0
  let homeworkCreated = 0
  let submissionsCreated = 0

  for (const teacher of teachers) {
    // Get this teacher's classes
    const teacherClasses = await prisma.classTeacher.findMany({
      where:   { userId: teacher.id },
      include: { class: { select: { id: true, name: true, subject: true } } },
      take:    2,
    })

    for (const tc of teacherClasses) {
      const cls     = tc.class
      const topics  = getLessonTopics(cls.subject)

      // Enrolled students for submissions
      const enrolled = await prisma.enrolment.findMany({
        where:  { classId: cls.id },
        select: { userId: true },
      })

      // 3 past lessons
      const lessonOffsets = [14, 7, 1] // daysAgo

      for (let li = 0; li < 3; li++) {
        const topicData   = topics[li % topics.length]
        const scheduledAt = daysAgo(lessonOffsets[li])
        const endsAt      = new Date(scheduledAt.getTime() + 60 * 60 * 1000) // +1hr

        const lesson = await prisma.lesson.create({
          data: {
            schoolId,
            classId:     cls.id,
            title:       topicData.title,
            topic:       topicData.topic,
            objectives:  topicData.objectives,
            lessonType:  'NORMAL',
            audienceType:'CLASS',
            scheduledAt,
            endsAt,
            published:   true,
            createdBy:   teacher.id,
          },
        })
        lessonsCreated++

        // Homework for this lesson
        const hwType    = li % 2 === 0 ? HomeworkType.SHORT_ANSWER : HomeworkType.MCQ_QUIZ
        const hwDueAt   = new Date(scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000) // +1 week
        const hwContent = getHomeworkContent(cls.subject, topicData.title, hwType)

        const homework = await prisma.homework.create({
          data: {
            schoolId,
            classId:      cls.id,
            lessonId:     lesson.id,
            title:        `${topicData.topic} — ${hwType === HomeworkType.MCQ_QUIZ ? 'Knowledge Check Quiz' : 'Extended Response Task'}`,
            instructions: hwContent.instructions,
            modelAnswer:  hwContent.modelAnswer,
            questionsJson:hwContent.questionsJson,
            type:         hwType,
            status:       'PUBLISHED',
            dueAt:        hwDueAt,
            maxAttempts:  2,
            createdBy:    teacher.id,
          },
        })
        homeworkCreated++

        // Submissions — 80% of enrolled students, past due date
        const submitStudents = enrolled.filter((_, idx) => idx % 5 !== 0) // skip every 5th

        for (const enrolment of submitStudents) {
          const submittedAt = new Date(scheduledAt.getTime() + (3 + Math.floor(Math.random() * 4)) * 24 * 60 * 60 * 1000)
          const markedAt    = new Date(hwDueAt.getTime() + (1 + Math.floor(Math.random() * 3)) * 24 * 60 * 60 * 1000)
          const score       = 4 + Math.floor(Math.random() * 6) // 4–9

          await prisma.submission.create({
            data: {
              schoolId,
              homeworkId:   homework.id,
              studentId:    enrolment.userId,
              content:      `Student response to: ${topicData.title}. This is a demo submission.`,
              status:       SubmissionStatus.RETURNED,
              submittedAt,
              markedAt,
              teacherScore: score,
              finalScore:   score,
              grade:        score.toString(),
              feedback:     FEEDBACK_PHRASES[Math.floor(Math.random() * FEEDBACK_PHRASES.length)],
            },
          })
          submissionsCreated++
        }
      }
    }
  }

  console.log(`✅  Step 3/4: ${lessonsCreated} lessons, ${homeworkCreated} homework, ${submissionsCreated} submissions created`)

  // ── STEP 5: ILPs for EHCP students ────────────────────────────────────────

  const ILP_TEMPLATES = [
    {
      needsSummary: 'Student has an EHCP with primary need in cognition and learning. Requires structured support with reading comprehension and written expression across all subjects.',
      targets: [
        { description: 'Write a structured paragraph using the PEE (Point, Evidence, Explain) framework', successCriteria: 'Consistently uses PEE structure in 3 consecutive written assessments without prompting', subject: 'English' },
        { description: 'Read and decode unfamiliar vocabulary using phonics strategies and context clues', successCriteria: 'Independently uses at least 2 decoding strategies when reading unseen text', subject: null },
        { description: 'Complete multi-step maths problems with access to a multiplication grid and number line', successCriteria: 'Achieves 60% or above on in-class maths tasks with reasonable adjustments', subject: 'Maths' },
      ],
    },
    {
      needsSummary: 'Student has an EHCP with primary need in communication and interaction (ASD). Requires predictable routines, visual supports and explicit teaching of social communication skills.',
      targets: [
        { description: 'Use a task management sheet to organise and complete multi-step classroom tasks independently', successCriteria: 'Completes 4 out of 5 classroom tasks using task sheet with no additional adult prompts', subject: null },
        { description: 'Identify and manage sensory triggers using agreed self-regulation strategies', successCriteria: 'Student self-reports using regulation strategies on 3 separate occasions per term', subject: null },
        { description: 'Contribute to group discussions by making at least one relevant comment per session', successCriteria: 'Makes unprompted contributions to group work in 3 different subjects over one half-term', subject: null },
      ],
    },
    {
      needsSummary: 'Student has an EHCP with physical and sensory needs. Requires assistive technology, enlarged materials and rest breaks. Occupational therapy recommendations in place.',
      targets: [
        { description: 'Access all written learning materials in font size 16 or larger, or use digital text-to-speech tools', successCriteria: 'Student reports materials are accessible in all lessons — zero reported instances of inaccessible resources per half-term', subject: null },
        { description: 'Use a laptop/tablet for extended written tasks to reduce physical fatigue', successCriteria: 'Successfully uses device independently for all written tasks longer than one paragraph', subject: null },
        { description: 'Take planned rest breaks of 5 minutes per 30 minutes of sustained activity', successCriteria: 'Rest break schedule followed in 90% of lessons — monitored via form tutor log', subject: null },
      ],
    },
  ]

  let ilpsCreated = 0

  for (let i = 0; i < Math.min(ehcpStudentIds.length, ILP_TEMPLATES.length); i++) {
    const studentId = ehcpStudentIds[i]
    const template  = ILP_TEMPLATES[i]

    // Check no ILP already exists
    const existing = await prisma.iLP.findFirst({ where: { studentId, schoolId } })
    if (existing) {
      console.log(`   ILP already exists for student ${studentId}, skipping`)
      continue
    }

    const ilp = await prisma.iLP.create({
      data: {
        schoolId,
        studentId,
        status:       'ACTIVE',
        needsSummary: template.needsSummary,
        reviewDueAt:  daysFromNow(90),
        activatedAt:  daysAgo(30),
        targets: {
          create: template.targets.map(t => ({
            description:     t.description,
            successCriteria: t.successCriteria,
            achieved:        false,
            subject:         t.subject ?? undefined,
          })),
        },
      },
    })
    ilpsCreated++
    void ilp
  }

  console.log(`✅  Step 5: ${ilpsCreated} ILPs created`)

  // ── STEP 6: Messages ───────────────────────────────────────────────────────

  const teacher1 = teachers[0]
  const teacher2 = teachers[1] ?? teachers[0]
  const parent   = await prisma.user.findFirst({ where: { schoolId, role: 'PARENT' }, select: { id: true, firstName: true, lastName: true } })
  const student1 = allStudents[0]

  const MESSAGE_THREADS = [
    {
      subject:  'Homework concern — missed deadline',
      context:  'homework',
      participants: [teacher1?.id, parent?.id].filter(Boolean) as string[],
      messages: [
        { senderId: teacher1?.id!, body: `Hello, I wanted to let you know that ${student1?.firstName} has missed the last two homework deadlines. Could we arrange a time to discuss how we can support them at home?` },
        { senderId: parent?.id!, body: 'Thank you for getting in touch. We have been having some difficulties at home recently. I will speak with them tonight.' },
        { senderId: teacher1?.id!, body: 'I really appreciate that. I am happy to offer some extra support sessions if that would help. Please do not hesitate to contact me again.' },
      ],
    },
    {
      subject:  'Well done — excellent essay this week',
      context:  'general',
      participants: [teacher1?.id, student1?.id].filter(Boolean) as string[],
      messages: [
        { senderId: teacher1?.id!, body: `Hi ${student1?.firstName}, I just wanted to say your essay this week was excellent. Your use of evidence was particularly strong. Keep it up!` },
        { senderId: student1?.id!, body: 'Thank you so much! I worked really hard on it. Is there anything I can improve for next time?' },
        { senderId: teacher1?.id!, body: 'Your analysis in the final paragraph could be extended a little more — but overall a really impressive piece of writing.' },
      ],
    },
    {
      subject:  'SEND support strategies — classroom guidance',
      context:  'send',
      participants: [senco?.id, teacher1?.id].filter(Boolean) as string[],
      messages: [
        { senderId: senco?.id!, body: 'Hi, I wanted to share some updated strategies for the students with SEND in your classes. I have attached the key adjustments recommended by the SENCo team.' },
        { senderId: teacher1?.id!, body: 'Thank you, this is really helpful. I have already been using some of the reading scaffolds but will try the pre-teaching vocabulary approach.' },
        { senderId: senco?.id!, body: 'Great — let me know how you get on. I will pop in to observe next week if that is okay with you.' },
      ],
    },
    {
      subject:  'Question about the upcoming assessment',
      context:  'general',
      participants: [parent?.id, teacher2?.id].filter(Boolean) as string[],
      messages: [
        { senderId: parent?.id!, body: 'Hello, I wanted to ask about the assessment coming up next month. What topics should my child be revising and is there anything we can do to help at home?' },
        { senderId: teacher2?.id!, body: 'Thank you for getting in touch. The assessment will cover all the topics from this term. I will be sharing a revision guide with all students this week.' },
      ],
    },
    {
      subject:  'Cover arrangements — Thursday periods 3-4',
      context:  'general',
      participants: [teachers.length > 2 ? teachers[2].id : teacher1?.id, teacher2?.id].filter(Boolean) as string[],
      messages: [
        { senderId: teachers.length > 2 ? teachers[2].id : teacher1?.id!, body: 'Hi, I have been asked to cover your Year 10 class on Thursday periods 3 and 4. Could you leave the work on the shared drive? Thank you.' },
        { senderId: teacher2?.id!, body: 'Of course — I will upload the worksheet and seating plan by Wednesday morning. The class should be working independently on the revision task.' },
      ],
    },
  ]

  let threadsCreated = 0

  for (const threadData of MESSAGE_THREADS) {
    if (threadData.participants.length < 2) continue

    const thread = await prisma.msgThread.create({
      data: {
        schoolId,
        subject:   threadData.subject,
        context:   threadData.context,
        isPrivate: false,
        createdBy: threadData.participants[0],
        participants: {
          create: threadData.participants.map(userId => ({ userId })),
        },
      },
    })

    // Messages with staggered timestamps
    let msgTime = daysAgo(3)
    for (const msg of threadData.messages) {
      if (!msg.senderId) continue
      msgTime = new Date(msgTime.getTime() + 6 * 60 * 60 * 1000) // +6 hours each
      await prisma.msgMessage.create({
        data: {
          threadId: thread.id,
          senderId: msg.senderId,
          body:     msg.body,
          sentAt:   msgTime,
        },
      })
      // Update thread timestamp
      await prisma.msgThread.update({
        where: { id: thread.id },
        data:  { updatedAt: msgTime },
      })
    }
    threadsCreated++
  }

  console.log(`✅  Step 6: ${threadsCreated} message threads created`)

  // ── STEP 7: SendConcerns + Notifications ───────────────────────────────────

  if (!senco) {
    console.log('⚠️   No SENCO found — skipping Step 7')
  } else {
    // Pick 3 SEND students for concerns
    const sendStudents = await prisma.sendStatus.findMany({
      where:   { student: { schoolId } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      take:    3,
    })

    const CONCERN_TEMPLATES = [
      { category: 'literacy',          description: 'Student is struggling significantly with reading fluency and comprehension in lessons. Written work is consistently below expected standard despite targeted support. Recommended for SpLD assessment.', status: 'open' },
      { category: 'social_emotional',  description: 'Noticeable withdrawal in class discussions over the past half-term. Student appears anxious before assessments and has been absent on several test days. Pastoral support recommended.', status: 'under_review' },
      { category: 'communication',     description: 'Student finds it difficult to process verbal instructions and often requires individual repetition. Peer interaction has become more limited. SALT referral may be appropriate.', status: 'open' },
    ]

    let concernsCreated = 0
    const concernIds: string[] = []

    for (let i = 0; i < Math.min(sendStudents.length, CONCERN_TEMPLATES.length); i++) {
      const student  = sendStudents[i].student
      const template = CONCERN_TEMPLATES[i]

      const concern = await prisma.sendConcern.create({
        data: {
          schoolId,
          studentId:   student.id,
          raisedBy:    teachers[0]?.id ?? senco.id,
          source:      'teacher',
          category:    template.category,
          description: template.description,
          status:      template.status,
        },
      })
      concernIds.push(concern.id)
      concernsCreated++
    }

    // 5 SENCO notifications
    const NOTIFICATION_TEMPLATES = [
      { type: 'new_concern',       title: 'New concern raised',          body: 'A new SEND concern has been raised for a student in your school. Please review and take appropriate action.',      isRead: false, concernIdx: 0 },
      { type: 'new_concern',       title: 'New concern raised',          body: 'Another new concern has been submitted by a class teacher. Early intervention is recommended.',                   isRead: false, concernIdx: 1 },
      { type: 'pattern_detected',  title: 'Pattern detected — literacy', body: 'The early warning system has detected a pattern of underperformance in literacy tasks for 3 students this term.', isRead: false, concernIdx: null },
      { type: 'ilp_review_due',    title: 'ILP review due — 3 students', body: '3 students have ILP reviews due within the next 30 days. Please arrange review meetings with families.',          isRead: true,  concernIdx: null },
      { type: 'review_requested',  title: 'Review requested by teacher', body: 'A class teacher has requested a review of SEND provision for a student. Please follow up within 5 working days.', isRead: true,  concernIdx: 2 },
    ]

    for (const n of NOTIFICATION_TEMPLATES) {
      await prisma.sendNotification.create({
        data: {
          schoolId,
          recipientId: senco.id,
          concernId:   n.concernIdx !== null ? (concernIds[n.concernIdx] ?? undefined) : undefined,
          type:        n.type,
          title:       n.title,
          body:        n.body,
          isRead:      n.isRead,
        },
      })
    }

    console.log(`✅  Step 7: ${concernsCreated} concerns + 5 notifications created`)
  }

  // ── Final counts ──────────────────────────────────────────────────────────

  const [sendCount, lessonCount, hwCount, subCount, ilpCount, threadCount, concernCount] = await Promise.all([
    prisma.sendStatus.count(),
    prisma.lesson.count(),
    prisma.homework.count(),
    prisma.submission.count(),
    prisma.iLP.count(),
    prisma.msgThread.count(),
    prisma.sendConcern.count(),
  ])

  console.log(`
📊  Final counts:
    SendStatus:   ${sendCount}
    Lessons:      ${lessonCount}
    Homework:     ${hwCount}
    Submissions:  ${subCount}
    ILPs:         ${ilpCount}
    Msg threads:  ${threadCount}
    Concerns:     ${concernCount}

🎉  Top-up seed complete.
`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
