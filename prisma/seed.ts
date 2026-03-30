import { PrismaClient, Role, LessonType, ResourceType, HomeworkType, HomeworkStatus, SubmissionStatus, ReleasePolicy, PlanStatus, SendStatusValue, LessonSharingLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function monday(offsetWeeks = 0): Date {
  const now = new Date()
  const dow = now.getDay()
  const d = new Date(now)
  d.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d
}
function lessonDate(weekOffset: number, dayOffset: number, hour: number, minute = 0): Date {
  const d = monday(weekOffset)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}
function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  console.log('Seeding demo data...\n')

  // ── School ─────────────────────────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { wondeId: 'demo-school' },
    update: {},
    create: {
      name: 'Omnis Demo School',
      wondeId: 'demo-school',
      aiOptIn: true,
      dayStartHour: 8,
      dayEndHour: 16,
      extStartHour: 7,
      extEndHour: 19,
    },
  })

  // ── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 10)

  const usersData = [
    { username: 'j.patel',   email: 'j.patel@omnisdemo.school',            firstName: 'Jay',    lastName: 'Patel',   role: Role.TEACHER      },
    { username: 'r.morris',  email: 'r.morris@omnisdemo.school',           firstName: 'Rachel', lastName: 'Morris',  role: Role.SENCO        },
    { username: 't.adeyemi', email: 't.adeyemi@omnisdemo.school',          firstName: 'Temi',   lastName: 'Adeyemi', role: Role.HEAD_OF_YEAR },
    { username: 'a.hughes',  email: 'a.hughes@students.omnisdemo.school',  firstName: 'Aiden',  lastName: 'Hughes',  role: Role.STUDENT      },
    { username: 'm.johnson', email: 'm.johnson@students.omnisdemo.school', firstName: 'Maya',   lastName: 'Johnson', role: Role.STUDENT      },
    { username: 'l.hughes',  email: 'l.hughes@parents.omnisdemo.school',   firstName: 'Laura',  lastName: 'Hughes',  role: Role.PARENT       },
    { username: 'admin',     email: 'admin@omnisdemo.school',              firstName: 'Admin',  lastName: 'User',    role: Role.SCHOOL_ADMIN },
    { username: 'd.brooks',  email: 'd.brooks@omnisdemo.school',           firstName: 'David',  lastName: 'Brooks',  role: Role.HEAD_OF_DEPT },
  ]

  const created: Record<string, { id: string }> = {}
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where:  { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName },
      create: { schoolId: school.id, email: u.email, passwordHash, role: u.role, firstName: u.firstName, lastName: u.lastName },
    })
    created[u.username] = user
    console.log(`  ✓ ${u.role.padEnd(14)}  ${u.email}`)
  }

  await prisma.parentStudentLink.upsert({
    where:  { parentId_studentId: { parentId: created['l.hughes'].id, studentId: created['a.hughes'].id } },
    update: {},
    create: { parentId: created['l.hughes'].id, studentId: created['a.hughes'].id },
  })

  // ── Classes ────────────────────────────────────────────────────────────────
  const classesData = [
    // English
    { id: 'demo-class-9E-En1',  name: '9E/En1',  subject: 'English', yearGroup: 9,  department: 'English' },
    { id: 'demo-class-10E-En2', name: '10E/En2', subject: 'English', yearGroup: 10, department: 'English' },
    { id: 'demo-class-11E-En1', name: '11E/En1', subject: 'English', yearGroup: 11, department: 'English' },
    // Maths — KS3
    { id: 'demo-class-7M-Ma1',  name: '7M/Ma1',  subject: 'Maths',   yearGroup: 7,  department: 'Maths' },
    { id: 'demo-class-8M-Ma1',  name: '8M/Ma1',  subject: 'Maths',   yearGroup: 8,  department: 'Maths' },
    { id: 'demo-class-9M-Ma2',  name: '9M/Ma2',  subject: 'Maths',   yearGroup: 9,  department: 'Maths' },
    // Maths — GCSE
    { id: 'demo-class-10M-Ma1', name: '10M/Ma1', subject: 'Maths',   yearGroup: 10, department: 'Maths' },
    { id: 'demo-class-11M-Ma1', name: '11M/Ma1', subject: 'Maths',   yearGroup: 11, department: 'Maths' },
    // Science — KS3
    { id: 'demo-class-9S-Sc1',  name: '9S/Sc1',  subject: 'Science', yearGroup: 9,  department: 'Science' },
  ]
  const classes: Record<string, { id: string }> = {}
  for (const c of classesData) {
    const cls = await prisma.schoolClass.upsert({
      where:  { id: c.id },
      update: {},
      create: { ...c, schoolId: school.id },
    })
    classes[c.name] = cls
    await prisma.classTeacher.upsert({
      where:  { classId_userId: { classId: cls.id, userId: created['j.patel'].id } },
      update: {},
      create: { classId: cls.id, userId: created['j.patel'].id },
    })
  }
  // ── Students per class ─────────────────────────────────────────────────────
  const studentsData: { email: string; firstName: string; lastName: string; classKeys: string[] }[] = [
    // 9E/En1 — Year 9 English
    { email: 'a.hughes@students.omnisdemo.school',   firstName: 'Aiden',    lastName: 'Hughes',    classKeys: ['9E/En1']  },
    { email: 'm.johnson@students.omnisdemo.school',  firstName: 'Maya',     lastName: 'Johnson',   classKeys: ['9E/En1']  },
    { email: 't.cooper@students.omnisdemo.school',   firstName: 'Tyler',    lastName: 'Cooper',    classKeys: ['9E/En1']  },
    { email: 'a.osei@students.omnisdemo.school',     firstName: 'Amara',    lastName: 'Osei',      classKeys: ['9E/En1']  },
    { email: 'f.jenkins@students.omnisdemo.school',  firstName: 'Freya',    lastName: 'Jenkins',   classKeys: ['9E/En1']  },
    { email: 'r.sharma@students.omnisdemo.school',   firstName: 'Rajan',    lastName: 'Sharma',    classKeys: ['9E/En1']  },
    { email: 'b.walsh@students.omnisdemo.school',    firstName: 'Bella',    lastName: 'Walsh',     classKeys: ['9E/En1']  },
    // 10E/En2 — Year 10 English
    { email: 'o.thompson@students.omnisdemo.school', firstName: 'Oliver',   lastName: 'Thompson',  classKeys: ['10E/En2'] },
    { email: 'c.williams@students.omnisdemo.school', firstName: 'Chloe',    lastName: 'Williams',  classKeys: ['10E/En2'] },
    { email: 'j.brown@students.omnisdemo.school',    firstName: 'Joshua',   lastName: 'Brown',     classKeys: ['10E/En2'] },
    { email: 'e.davies@students.omnisdemo.school',   firstName: 'Emma',     lastName: 'Davies',    classKeys: ['10E/En2'] },
    { email: 'l.ahmed@students.omnisdemo.school',    firstName: 'Liam',     lastName: 'Ahmed',     classKeys: ['10E/En2'] },
    { email: 'z.king@students.omnisdemo.school',     firstName: 'Zara',     lastName: 'King',      classKeys: ['10E/En2'] },
    // 11E/En1 — Year 11 English
    { email: 'g.wilson@students.omnisdemo.school',   firstName: 'Grace',    lastName: 'Wilson',    classKeys: ['11E/En1'] },
    { email: 'j.robinson@students.omnisdemo.school', firstName: 'Jack',     lastName: 'Robinson',  classKeys: ['11E/En1'] },
    { email: 'i.moore@students.omnisdemo.school',    firstName: 'Isabella', lastName: 'Moore',     classKeys: ['11E/En1'] },
    { email: 'e.clarke@students.omnisdemo.school',   firstName: 'Ethan',    lastName: 'Clarke',    classKeys: ['11E/En1'] },
    { email: 'p.taylor@students.omnisdemo.school',   firstName: 'Poppy',    lastName: 'Taylor',    classKeys: ['11E/En1'] },
    { email: 'n.martin@students.omnisdemo.school',   firstName: 'Noah',     lastName: 'Martin',    classKeys: ['11E/En1'] },
    // 7M/Ma1 — Year 7 Maths
    { email: 's.patel@students.omnisdemo.school',    firstName: 'Samir',    lastName: 'Patel',     classKeys: ['7M/Ma1']  },
    { email: 'h.chen@students.omnisdemo.school',     firstName: 'Hannah',   lastName: 'Chen',      classKeys: ['7M/Ma1']  },
    { email: 'd.okafor@students.omnisdemo.school',   firstName: 'Daniel',   lastName: 'Okafor',    classKeys: ['7M/Ma1']  },
    { email: 'c.james@students.omnisdemo.school',    firstName: 'Charlie',  lastName: 'James',     classKeys: ['7M/Ma1']  },
    { email: 'l.ford@students.omnisdemo.school',     firstName: 'Lucy',     lastName: 'Ford',      classKeys: ['7M/Ma1']  },
    { email: 'k.stone@students.omnisdemo.school',    firstName: 'Kai',      lastName: 'Stone',     classKeys: ['7M/Ma1']  },
    // 8M/Ma1 — Year 8 Maths
    { email: 'r.ali@students.omnisdemo.school',      firstName: 'Rehan',    lastName: 'Ali',       classKeys: ['8M/Ma1']  },
    { email: 'c.harris@students.omnisdemo.school',   firstName: 'Caitlin',  lastName: 'Harris',    classKeys: ['8M/Ma1']  },
    { email: 'w.nguyen@students.omnisdemo.school',   firstName: 'William',  lastName: 'Nguyen',    classKeys: ['8M/Ma1']  },
    { email: 'p.evans@students.omnisdemo.school',    firstName: 'Priya',    lastName: 'Evans',     classKeys: ['8M/Ma1']  },
    { email: 'a.scott@students.omnisdemo.school',    firstName: 'Alex',     lastName: 'Scott',     classKeys: ['8M/Ma1']  },
    // 9M/Ma2 — Year 9 Maths
    { email: 's.ahmed@students.omnisdemo.school',    firstName: 'Sophia',   lastName: 'Ahmed',     classKeys: ['9M/Ma2', '9E/En1'] },
    { email: 'b.mitchell@students.omnisdemo.school', firstName: 'Ben',      lastName: 'Mitchell',  classKeys: ['9M/Ma2']  },
    { email: 'n.white@students.omnisdemo.school',    firstName: 'Nadia',    lastName: 'White',     classKeys: ['9M/Ma2']  },
    { email: 'j.lee@students.omnisdemo.school',      firstName: 'Jason',    lastName: 'Lee',       classKeys: ['9M/Ma2']  },
    { email: 'e.grant@students.omnisdemo.school',    firstName: 'Eve',      lastName: 'Grant',     classKeys: ['9M/Ma2']  },
    // 10M/Ma1 — Year 10 Maths
    { email: 'm.hall@students.omnisdemo.school',     firstName: 'Marcus',   lastName: 'Hall',      classKeys: ['10M/Ma1'] },
    { email: 'a.price@students.omnisdemo.school',    firstName: 'Amber',    lastName: 'Price',     classKeys: ['10M/Ma1'] },
    { email: 'd.turner@students.omnisdemo.school',   firstName: 'Dylan',    lastName: 'Turner',    classKeys: ['10M/Ma1'] },
    { email: 'i.patel@students.omnisdemo.school',    firstName: 'Isla',     lastName: 'Patel',     classKeys: ['10M/Ma1'] },
    { email: 'c.wood@students.omnisdemo.school',     firstName: 'Connor',   lastName: 'Wood',      classKeys: ['10M/Ma1'] },
    // 11M/Ma1 — Year 11 Maths
    { email: 'j.fox@students.omnisdemo.school',      firstName: 'James',    lastName: 'Fox',       classKeys: ['11M/Ma1'] },
    { email: 'h.bailey@students.omnisdemo.school',   firstName: 'Holly',    lastName: 'Bailey',    classKeys: ['11M/Ma1'] },
    { email: 'r.cox@students.omnisdemo.school',      firstName: 'Ryan',     lastName: 'Cox',       classKeys: ['11M/Ma1'] },
    { email: 'a.bell@students.omnisdemo.school',     firstName: 'Anya',     lastName: 'Bell',      classKeys: ['11M/Ma1'] },
    { email: 't.ward@students.omnisdemo.school',     firstName: 'Theo',     lastName: 'Ward',      classKeys: ['11M/Ma1'] },
    // 9S/Sc1 — Year 9 Science
    { email: 'l.hunt@students.omnisdemo.school',     firstName: 'Lily',     lastName: 'Hunt',      classKeys: ['9S/Sc1']  },
    { email: 'e.russell@students.omnisdemo.school',  firstName: 'Eli',      lastName: 'Russell',   classKeys: ['9S/Sc1']  },
    { email: 'p.cook@students.omnisdemo.school',     firstName: 'Phoebe',   lastName: 'Cook',      classKeys: ['9S/Sc1']  },
    { email: 'h.ward@students.omnisdemo.school',     firstName: 'Harry',    lastName: 'Ward',      classKeys: ['9S/Sc1']  },
    { email: 'z.hussain@students.omnisdemo.school',  firstName: 'Zahra',    lastName: 'Hussain',   classKeys: ['9S/Sc1']  },
  ]

  for (const s of studentsData) {
    const user = await prisma.user.upsert({
      where:  { email: s.email },
      update: { firstName: s.firstName, lastName: s.lastName },
      create: { schoolId: school.id, email: s.email, passwordHash, role: Role.STUDENT, firstName: s.firstName, lastName: s.lastName },
    })
    for (const key of s.classKeys) {
      await prisma.enrolment.upsert({
        where:  { classId_userId: { classId: classes[key].id, userId: user.id } },
        update: {},
        create: { classId: classes[key].id, userId: user.id },
      })
    }
  }
  console.log('\n  ✓ Classes & enrolments')

  // ── This week's lessons ───────────────────────────────────────────────────
  const teacherId = created['j.patel'].id

  type LessonSeed = {
    id: string; classKey: string; title: string; objectives: string[]
    day: number; startH: number; endH: number; published: boolean; type?: LessonType
    topic?: string; examBoard?: string
  }
  const lessonsData: LessonSeed[] = [
    {
      id: 'demo-lesson-9E-d0-h9', classKey: '9E/En1',
      title: 'An Inspector Calls — Act 1 Introduction',
      topic: 'An Inspector Calls', examBoard: 'AQA',
      objectives: [
        'Understand the social and historical context of the play',
        'Identify Priestley\'s key messages about social responsibility',
        'Analyse the dramatic impact of the Inspector\'s arrival',
      ],
      day: 0, startH: 9, endH: 10, published: true,
    },
    {
      id: 'demo-lesson-10E-d0-h11', classKey: '10E/En2',
      title: 'Macbeth — Ambition and Power',
      topic: 'Macbeth', examBoard: 'AQA',
      objectives: [
        'Explore how Shakespeare presents ambition as a destructive force',
        'Analyse key soliloquies from Act 1 and Act 2',
        'Develop PEE paragraph writing using textual evidence',
      ],
      day: 0, startH: 11, endH: 12, published: true,
    },
    {
      id: 'demo-lesson-11E-d1-h10', classKey: '11E/En1',
      title: 'Paper 1 Unseen Fiction Practice',
      topic: 'Paper 1: Explorations in Creative Reading and Writing', examBoard: 'AQA',
      objectives: [
        'Apply AQA Paper 1 Question 4 skills to unseen extract',
        'Structure a full 20-mark response under timed conditions',
        'Peer-assess using the mark scheme descriptors',
      ],
      day: 1, startH: 10, endH: 11, published: true,
    },
    {
      id: 'demo-lesson-9E-d2-h9', classKey: '9E/En1',
      title: 'An Inspector Calls — Character Study',
      topic: 'An Inspector Calls', examBoard: 'AQA',
      objectives: [
        'Trace character development across the play',
        'Compare generational attitudes to responsibility',
        'Write a structured character analysis paragraph',
      ],
      day: 2, startH: 9, endH: 10, published: false,
    },
    {
      id: 'demo-lesson-11E-d2-h13', classKey: '11E/En1',
      title: 'Paper 2 Non-Fiction — Language Analysis',
      topic: 'Paper 2: Writers\' Viewpoints and Perspectives', examBoard: 'AQA',
      objectives: [
        'Identify language techniques in 19th and 21st century non-fiction',
        'Compare writer\'s perspectives using subject terminology',
        'Plan and write a Question 4 comparative response',
      ],
      day: 2, startH: 13, endH: 14, published: true,
    },
    {
      id: 'demo-lesson-10E-d3-h11', classKey: '10E/En2',
      title: 'Macbeth — Soliloquy Analysis',
      topic: 'Macbeth', examBoard: 'AQA',
      objectives: [
        'Close-read "Is this a dagger" and "Tomorrow" soliloquies',
        'Explore how soliloquy reveals character\'s inner conflict',
        'Practise A-grade analysis using context and language',
      ],
      day: 3, startH: 11, endH: 12, published: false,
    },
    {
      id: 'demo-lesson-9E-d4-h14', classKey: '9E/En1',
      title: 'An Inspector Calls — Responsibility Theme',
      topic: 'An Inspector Calls', examBoard: 'AQA',
      objectives: [
        'Evaluate how Priestley uses each character to explore responsibility',
        'Write a timed response to an exam-style question',
        'Self-assess using the GCSE mark scheme',
      ],
      day: 4, startH: 14, endH: 15, published: true,
    },
  ]

  const lessonIds: Record<string, string> = {}
  for (const l of lessonsData) {
    const lesson = await prisma.lesson.upsert({
      where:  { id: l.id },
      update: {
        title: l.title, objectives: l.objectives, published: l.published,
        topic: l.topic, examBoard: l.examBoard,
        // Refresh to current week so the calendar always shows this week's lessons
        scheduledAt: lessonDate(0, l.day, l.startH),
        endsAt:      lessonDate(0, l.day, l.endH),
      },
      create: {
        id: l.id,
        schoolId: school.id,
        classId: classes[l.classKey].id,
        title: l.title,
        objectives: l.objectives,
        topic: l.topic,
        examBoard: l.examBoard,
        scheduledAt: lessonDate(0, l.day, l.startH),
        endsAt: lessonDate(0, l.day, l.endH),
        published: l.published,
        lessonType: l.type ?? LessonType.NORMAL,
        createdBy: teacherId,
      },
    })
    lessonIds[l.id] = lesson.id
    console.log(`  ✓ Lesson  ${l.title}`)
  }

  // Future unscheduled lessons
  const futureLessons = [
    { id: 'demo-future-9E-d0',  classKey: '9E/En1',  title: 'An Inspector Calls — Essay Planning',  topic: 'An Inspector Calls', examBoard: 'AQA', day: 0, startH: 9  },
    { id: 'demo-future-10E-d1', classKey: '10E/En2', title: 'Macbeth — Key Quotations Review',       topic: 'Macbeth',            examBoard: 'AQA', day: 1, startH: 11 },
    { id: 'demo-future-11E-d2', classKey: '11E/En1', title: 'Mock Exam Paper 1 — Timed Practice',   topic: 'Paper 1: Explorations in Creative Reading and Writing', examBoard: 'AQA', day: 2, startH: 9  },
  ]
  for (const l of futureLessons) {
    await prisma.lesson.upsert({
      where:  { id: l.id },
      update: {
        topic: l.topic, examBoard: l.examBoard,
        scheduledAt: lessonDate(1, l.day, l.startH),
        endsAt:      lessonDate(1, l.day, l.startH + 1),
      },
      create: {
        id: l.id, schoolId: school.id, classId: classes[l.classKey].id,
        title: l.title, objectives: [], published: false, lessonType: LessonType.NORMAL,
        topic: l.topic, examBoard: l.examBoard,
        scheduledAt: lessonDate(1, l.day, l.startH),
        endsAt: lessonDate(1, l.day, l.startH + 1),
        createdBy: teacherId,
      },
    })
  }

  // ── Resources ─────────────────────────────────────────────────────────────
  type ResourceSeed = { id: string; lessonKey: string; type: ResourceType; label: string; url: string }

  const allResources: ResourceSeed[] = [
    // ── An Inspector Calls — Act 1 Introduction ───────────────────────────
    { id: 'demo-res-aic1-plan',      lessonKey: 'demo-lesson-9E-d0-h9',   type: ResourceType.PLAN,      label: 'AIC Act 1 — Lesson Plan.pdf',                    url: 'https://cdn.example.com/aic-act1-lesson-plan.pdf' },
    { id: 'demo-res-aic-slides',     lessonKey: 'demo-lesson-9E-d0-h9',   type: ResourceType.SLIDES,    label: 'An Inspector Calls — Act 1 Slides.pptx',          url: 'https://cdn.example.com/aic-slides.pptx' },
    { id: 'demo-res-aic1-ws',        lessonKey: 'demo-lesson-9E-d0-h9',   type: ResourceType.WORKSHEET, label: 'Act 1 Reading Guide & Annotation Sheet.pdf',      url: 'https://cdn.example.com/aic-act1-reading-guide.pdf' },
    { id: 'demo-res-aic1-bbc',       lessonKey: 'demo-lesson-9E-d0-h9',   type: ResourceType.LINK,      label: 'BBC Bitesize — An Inspector Calls Overview',      url: 'https://www.bbc.co.uk/bitesize/guides/zqpfcwx/revision/1' },
    { id: 'demo-res-aic1-context',   lessonKey: 'demo-lesson-9E-d0-h9',   type: ResourceType.LINK,      label: 'Priestley & the 1945 Context — Revision Notes',   url: 'https://www.bbc.co.uk/bitesize/guides/zqpfcwx/revision/2' },
    { id: 'demo-res-aic1-video',     lessonKey: 'demo-lesson-9E-d0-h9',   type: ResourceType.VIDEO,     label: 'An Inspector Calls — Plot & Themes Introduction (YouTube)', url: 'https://www.youtube.com/watch?v=aic-intro' },

    // ── Macbeth — Ambition and Power ──────────────────────────────────────
    { id: 'demo-res-macbeth-plan',   lessonKey: 'demo-lesson-10E-d0-h11', type: ResourceType.PLAN,      label: 'Macbeth Act 1 — Lesson Plan.pdf',                 url: 'https://cdn.example.com/macbeth-lesson-plan.pdf' },
    { id: 'demo-res-macbeth-slides', lessonKey: 'demo-lesson-10E-d0-h11', type: ResourceType.SLIDES,    label: 'Macbeth Ambition & Power — Slides.pptx',          url: 'https://cdn.example.com/macbeth-slides.pptx' },
    { id: 'demo-res-macbeth-worksheet', lessonKey: 'demo-lesson-10E-d0-h11', type: ResourceType.WORKSHEET, label: 'PEE Paragraph Scaffold — Ambition.pdf',        url: 'https://cdn.example.com/macbeth-pee-scaffold.pdf' },
    { id: 'demo-res-macbeth-bbc',    lessonKey: 'demo-lesson-10E-d0-h11', type: ResourceType.LINK,      label: 'BBC Bitesize — Macbeth Themes',                   url: 'https://www.bbc.co.uk/bitesize/guides/z8vgdmn/revision/1' },
    { id: 'demo-res-macbeth-sparknotes', lessonKey: 'demo-lesson-10E-d0-h11', type: ResourceType.LINK,  label: 'BBC Bitesize — Macbeth Key Quotes',               url: 'https://www.bbc.co.uk/bitesize/guides/z8vgdmn/revision/3' },
    { id: 'demo-res-macbeth-video',  lessonKey: 'demo-lesson-10E-d0-h11', type: ResourceType.VIDEO,     label: 'RSC — Macbeth: Ambition Explained (YouTube)',      url: 'https://www.youtube.com/watch?v=macbeth-rsc' },

    // ── Paper 1 Unseen Fiction Practice ───────────────────────────────────
    { id: 'demo-res-p1-plan',        lessonKey: 'demo-lesson-11E-d1-h10', type: ResourceType.PLAN,      label: 'Paper 1 Unseen Fiction — Lesson Plan.pdf',        url: 'https://cdn.example.com/p1-lesson-plan.pdf' },
    { id: 'demo-res-p1-slides',      lessonKey: 'demo-lesson-11E-d1-h10', type: ResourceType.SLIDES,    label: 'AQA Paper 1 Question 4 — Exam Skills Slides.pptx',url: 'https://cdn.example.com/p1-slides.pptx' },
    { id: 'demo-res-p1-ws',          lessonKey: 'demo-lesson-11E-d1-h10', type: ResourceType.WORKSHEET, label: 'Unseen Fiction Response Frame (Q4).pdf',          url: 'https://cdn.example.com/p1-response-frame.pdf' },
    { id: 'demo-res-p1-extract',     lessonKey: 'demo-lesson-11E-d1-h10', type: ResourceType.WORKSHEET, label: 'Timed Practice Extract — Gothic Fiction.pdf',     url: 'https://cdn.example.com/p1-extract-gothic.pdf' },
    { id: 'demo-res-p1-bbc',         lessonKey: 'demo-lesson-11E-d1-h10', type: ResourceType.LINK,      label: 'BBC Bitesize — AQA English Language Paper 1',     url: 'https://www.bbc.co.uk/bitesize/examspecs/z9xchbk' },
    { id: 'demo-res-p1-video',       lessonKey: 'demo-lesson-11E-d1-h10', type: ResourceType.VIDEO,     label: 'How to Ace Paper 1 Q4 — Exam Walkthrough (YouTube)', url: 'https://www.youtube.com/watch?v=p1-q4-guide' },

    // ── An Inspector Calls — Character Study ──────────────────────────────
    { id: 'demo-res-aic-char-plan',  lessonKey: 'demo-lesson-9E-d2-h9',  type: ResourceType.PLAN,      label: 'AIC Character Study — Lesson Plan.pdf',           url: 'https://cdn.example.com/aic-char-lesson-plan.pdf' },
    { id: 'demo-res-aic-char-slides',lessonKey: 'demo-lesson-9E-d2-h9',  type: ResourceType.SLIDES,    label: 'AIC Characters — Birling Family Slides.pptx',     url: 'https://cdn.example.com/aic-characters-slides.pptx' },
    { id: 'demo-res-aic-char-ws',    lessonKey: 'demo-lesson-9E-d2-h9',  type: ResourceType.WORKSHEET, label: 'Character Tracking Grid — AIC.pdf',               url: 'https://cdn.example.com/aic-character-grid.pdf' },
    { id: 'demo-res-aic-char-bbc',   lessonKey: 'demo-lesson-9E-d2-h9',  type: ResourceType.LINK,      label: 'BBC Bitesize — AIC Characters',                   url: 'https://www.bbc.co.uk/bitesize/guides/zqpfcwx/revision/3' },
    { id: 'demo-res-aic-char-video', lessonKey: 'demo-lesson-9E-d2-h9',  type: ResourceType.VIDEO,     label: 'AIC — Character Analysis Deep Dive (YouTube)',    url: 'https://www.youtube.com/watch?v=aic-characters' },

    // ── Paper 2 Non-Fiction — Language Analysis ───────────────────────────
    { id: 'demo-res-p2-plan',        lessonKey: 'demo-lesson-11E-d2-h13', type: ResourceType.PLAN,     label: 'Paper 2 Language Analysis — Lesson Plan.pdf',     url: 'https://cdn.example.com/p2-lesson-plan.pdf' },
    { id: 'demo-res-p2-slides',      lessonKey: 'demo-lesson-11E-d2-h13', type: ResourceType.SLIDES,   label: 'Non-Fiction Language Techniques — Slides.pptx',   url: 'https://cdn.example.com/p2-slides.pptx' },
    { id: 'demo-res-p2-ws',          lessonKey: 'demo-lesson-11E-d2-h13', type: ResourceType.WORKSHEET,'label': 'Comparative Analysis Frame (Q4).pdf',            url: 'https://cdn.example.com/p2-comparative-frame.pdf' },
    { id: 'demo-res-p2-source-a',    lessonKey: 'demo-lesson-11E-d2-h13', type: ResourceType.WORKSHEET,'label': 'Source A — 19th Century Travel Writing Extract.pdf', url: 'https://cdn.example.com/p2-source-a.pdf' },
    { id: 'demo-res-p2-bbc',         lessonKey: 'demo-lesson-11E-d2-h13', type: ResourceType.LINK,     label: 'BBC Bitesize — AQA Paper 2 Language',             url: 'https://www.bbc.co.uk/bitesize/examspecs/z9xchbk' },
    { id: 'demo-res-p2-video',       lessonKey: 'demo-lesson-11E-d2-h13', type: ResourceType.VIDEO,    label: 'Paper 2 Q4 — How to Compare Perspectives (YouTube)', url: 'https://www.youtube.com/watch?v=p2-compare' },

    // ── Macbeth — Soliloquy Analysis ──────────────────────────────────────
    { id: 'demo-res-mac-sol-plan',   lessonKey: 'demo-lesson-10E-d3-h11', type: ResourceType.PLAN,     label: 'Macbeth Soliloquy Analysis — Lesson Plan.pdf',    url: 'https://cdn.example.com/macbeth-soliloquy-plan.pdf' },
    { id: 'demo-res-mac-sol-slides', lessonKey: 'demo-lesson-10E-d3-h11', type: ResourceType.SLIDES,   label: 'Macbeth — Key Soliloquies Annotated Slides.pptx', url: 'https://cdn.example.com/macbeth-soliloquy-slides.pptx' },
    { id: 'demo-res-mac-sol-ws',     lessonKey: 'demo-lesson-10E-d3-h11', type: ResourceType.WORKSHEET,'label': 'Soliloquy Close Reading Frame.pdf',              url: 'https://cdn.example.com/macbeth-soliloquy-frame.pdf' },
    { id: 'demo-res-mac-sol-bbc',    lessonKey: 'demo-lesson-10E-d3-h11', type: ResourceType.LINK,     label: 'BBC Bitesize — Macbeth Soliloquies',              url: 'https://www.bbc.co.uk/bitesize/guides/z8vgdmn/revision/2' },
    { id: 'demo-res-mac-sol-rsc',    lessonKey: 'demo-lesson-10E-d3-h11', type: ResourceType.LINK,     label: 'RSC — Understanding Macbeth\'s Soliloquies',      url: 'https://www.rsc.org.uk/macbeth/about-the-play/soliloquies' },
    { id: 'demo-res-mac-sol-video',  lessonKey: 'demo-lesson-10E-d3-h11', type: ResourceType.VIDEO,    label: 'RSC — "Is This a Dagger" Performance (YouTube)',  url: 'https://www.youtube.com/watch?v=macbeth-dagger' },

    // ── An Inspector Calls — Responsibility Theme ─────────────────────────
    { id: 'demo-res-aic-resp-plan',  lessonKey: 'demo-lesson-9E-d4-h14',  type: ResourceType.PLAN,     label: 'AIC Responsibility Theme — Lesson Plan.pdf',      url: 'https://cdn.example.com/aic-responsibility-plan.pdf' },
    { id: 'demo-res-aic-resp-slides',lessonKey: 'demo-lesson-9E-d4-h14',  type: ResourceType.SLIDES,   label: 'AIC — Responsibility & Social Class Slides.pptx', url: 'https://cdn.example.com/aic-responsibility-slides.pptx' },
    { id: 'demo-res-aic-resp-ws',    lessonKey: 'demo-lesson-9E-d4-h14',  type: ResourceType.WORKSHEET,'label': 'Timed Exam Response Frame — AIC Themes.pdf',     url: 'https://cdn.example.com/aic-exam-frame.pdf' },
    { id: 'demo-res-aic-resp-ms',    lessonKey: 'demo-lesson-9E-d4-h14',  type: ResourceType.WORKSHEET,'label': 'GCSE Mark Scheme Descriptors (AIC).pdf',         url: 'https://cdn.example.com/aic-mark-scheme.pdf' },
    { id: 'demo-res-aic-resp-bbc',   lessonKey: 'demo-lesson-9E-d4-h14',  type: ResourceType.LINK,     label: 'BBC Bitesize — AIC Themes & Context',             url: 'https://www.bbc.co.uk/bitesize/guides/zqpfcwx/revision/4' },
    { id: 'demo-res-aic-resp-video', lessonKey: 'demo-lesson-9E-d4-h14',  type: ResourceType.VIDEO,    label: 'AIC — Themes of Responsibility Explained (YouTube)', url: 'https://www.youtube.com/watch?v=aic-responsibility' },
  ]

  for (const r of allResources) {
    await prisma.resource.upsert({
      where:  { id: r.id },
      update: {},
      create: {
        id: r.id, schoolId: school.id, lessonId: lessonIds[r.lessonKey],
        type: r.type, label: r.label, url: r.url, createdBy: teacherId,
      },
    })
  }

  // SEND review on the Macbeth slides (score 1–10)
  await prisma.resourceReview.upsert({
    where:  { resourceId: 'demo-res-macbeth-slides' },
    update: { sendScore: 7 },
    create: {
      resourceId: 'demo-res-macbeth-slides',
      sendScore: 7,
      suggestions: [
        { text: 'Increase font size on slides 4–6 to at least 18pt', accepted: false },
        { text: 'Add alt-text to all images', accepted: true },
        { text: 'Reduce text density on slide 9 — consider splitting', accepted: false },
      ],
      accepted: false,
    },
  })
  // SEND review on the AIC Act 1 slides (score 1–10)
  await prisma.resourceReview.upsert({
    where:  { resourceId: 'demo-res-aic-slides' },
    update: { sendScore: 9 },
    create: {
      resourceId: 'demo-res-aic-slides',
      sendScore: 9,
      suggestions: [
        { text: 'Consider adding a glossary slide for key terms', accepted: false },
        { text: 'Dyslexia-friendly font used throughout — good', accepted: true },
      ],
      accepted: false,
    },
  })
  console.log('  ✓ Resources')

  // ── Homework ───────────────────────────────────────────────────────────────
  // Macbeth homework linked to the Macbeth lesson
  const macbethHW = await prisma.homework.upsert({
    where: { id: 'demo-hw-macbeth-1' },
    update: {},
    create: {
      id:            'demo-hw-macbeth-1',
      schoolId:      school.id,
      classId:       classes['10E/En2'].id,
      lessonId:      lessonIds['demo-lesson-10E-d0-h11'],
      title:         'Macbeth — Ambition Essay Plan',
      instructions:  'Write a full PEE paragraph responding to: "How does Shakespeare present ambition as a destructive force in Act 1?" Use at least two pieces of evidence from the text. Aim for 200–250 words.',
      modelAnswer:   'A model response would open with a clear topic sentence linking ambition to destruction, then embed a key quotation (e.g. "Stars, hide your fires") with analysis of Shakespeare\'s language choices, and contextualise with Jacobean attitudes to regicide.',
      gradingBands:  { '0-3': 'Limited evidence; no analysis', '4-6': 'Some analysis; limited language terminology', '7-9': 'Sustained analysis; confident use of subject terminology; context integrated' },
      dueAt:         daysFromNow(5),
      status:        HomeworkStatus.PUBLISHED,
      type:          HomeworkType.SHORT_ANSWER,
      releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts:   2,
      createdBy:     teacherId,
    },
  })

  // AIC homework
  const aicHW = await prisma.homework.upsert({
    where: { id: 'demo-hw-aic-1' },
    update: {},
    create: {
      id:            'demo-hw-aic-1',
      schoolId:      school.id,
      classId:       classes['9E/En1'].id,
      lessonId:      lessonIds['demo-lesson-9E-d0-h9'],
      title:         'An Inspector Calls — Context Research',
      instructions:  'Research the historical context of "An Inspector Calls". Write 150 words explaining how the events of 1912 and 1945 are important to understanding Priestley\'s message. Include at least two specific historical facts.',
      modelAnswer:   'Students should reference the Titanic (class divide), WW1/WW2, the 1945 Labour election and the creation of the welfare state as key context points that inform Priestley\'s socialist message.',
      dueAt:         daysFromNow(3),
      status:        HomeworkStatus.PUBLISHED,
      type:          HomeworkType.SHORT_ANSWER,
      releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts:   2,
      createdBy:     teacherId,
    },
  })

  // Paper 2 homework (draft)
  await prisma.homework.upsert({
    where: { id: 'demo-hw-paper2-1' },
    update: {},
    create: {
      id:            'demo-hw-paper2-1',
      schoolId:      school.id,
      classId:       classes['11E/En1'].id,
      title:         'Paper 2 — Comparative Language Analysis Practice',
      instructions:  'Compare how writers convey their perspectives on childhood in Source A (1890s travel writing) and Source B (modern blog). Write a full Question 4 response (approx. 450 words).',
      dueAt:         daysFromNow(10),
      status:        HomeworkStatus.DRAFT,
      type:          HomeworkType.EXTENDED_WRITING,
      releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts:   1,
      createdBy:     teacherId,
    },
  })
  console.log('  ✓ Homework')

  // ── Submissions ────────────────────────────────────────────────────────────
  // Aiden submitted AIC homework (marked)
  const aidenSub = await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId: aicHW.id, studentId: created['a.hughes'].id } },
    update: {},
    create: {
      schoolId:    school.id,
      homeworkId:  aicHW.id,
      studentId:   created['a.hughes'].id,
      content:     'An Inspector Calls was written in 1945 but set in 1912, the year the Titanic sank. The Titanic is symbolic because it shows how arrogant the upper class were about their power — they even divided the passengers by class. Priestley uses the Birling family to represent this same arrogance. In 1945, Britain was just coming out of the Second World War and people voted for a Labour government because they wanted a fairer society. Priestley wrote this play to make his audience think about collective responsibility and how their actions affect others. The Inspector represents Priestley\'s own socialist views — that everyone in society is linked together.',
      status:      SubmissionStatus.RETURNED,
      submittedAt: daysAgo(2),
      markedAt:    daysAgo(1),
      autoScore:   null,
      teacherScore: 7,
      finalScore:   7,
      feedback:    'Excellent contextual understanding, Aiden. You\'ve made strong links between 1912 and 1945 and connected them clearly to Priestley\'s message. To reach Grade 8/9 level, try to embed more specific quotations from the play itself alongside the historical context.',
      grade:       '7',
      integrityReviewed: true,
    },
  })

  // Maya submitted (submitted but not yet marked)
  await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId: aicHW.id, studentId: created['m.johnson'].id } },
    update: {},
    create: {
      schoolId:    school.id,
      homeworkId:  aicHW.id,
      studentId:   created['m.johnson'].id,
      content:     'JB Priestley wrote An Inspector Calls in 1945. The play is set in 1912 when the class system was very strong. The Birlings are an upper-class family who don\'t care about poor people. Priestley wants to show that this is wrong. The Inspector comes and shows that every member of the family contributed to Eva Smith\'s death. This shows that responsibility is shared.',
      status:      SubmissionStatus.SUBMITTED,
      submittedAt: daysAgo(1),
    },
  })

  // Aiden submitted Macbeth homework
  await prisma.submission.upsert({
    where: { homeworkId_studentId: { homeworkId: macbethHW.id, studentId: created['a.hughes'].id } },
    update: {},
    create: {
      schoolId:    school.id,
      homeworkId:  macbethHW.id,
      studentId:   created['a.hughes'].id,
      content:     'Shakespeare presents ambition as a deeply destructive force in Act 1 of Macbeth. When Macbeth says "Stars, hide your fires; / Let not light see my black and deep desires", Shakespeare uses the imagery of darkness to suggest that ambition forces Macbeth to conceal his true nature. The word "black" connotes evil and corruption, implying that ambition has already morally tainted Macbeth before he has committed any crime. In a Jacobean context, the audience would have been acutely aware of the divine right of kings, making Macbeth\'s ambitions not just personally destructive but cosmically transgressive. Furthermore, Lady Macbeth\'s invocation to "unsex me here" shows how ambition corrupts those around Macbeth, infecting even his closest relationship.',
      status:      SubmissionStatus.SUBMITTED,
      submittedAt: daysAgo(1),
    },
  })
  console.log('  ✓ Submissions')

  // ── SEND Status for Aiden ─────────────────────────────────────────────────
  await prisma.sendStatus.upsert({
    where:  { studentId: created['a.hughes'].id },
    update: {},
    create: {
      studentId:    created['a.hughes'].id,
      activeStatus: SendStatusValue.SEN_SUPPORT,
      activeSource: 'MIS',
    },
  })

  // ── Individual Learning Plan (Plan) for Aiden ─────────────────────────────
  const plan = await prisma.plan.upsert({
    where:  { id: 'demo-plan-aiden-1' },
    update: {},
    create: {
      id:          'demo-plan-aiden-1',
      schoolId:    school.id,
      studentId:   created['a.hughes'].id,
      status:      PlanStatus.ACTIVE_INTERNAL,
      reviewDate:  daysFromNow(30),
      activatedById: created['r.morris'].id,
      activatedAt: daysAgo(14),
    },
  })

  await prisma.planTarget.createMany({
    skipDuplicates: true,
    data: [
      { planId: plan.id, needCategory: 'Literacy', metricKey: 'reading_age',      baselineValue: '10y 6m', targetValue: '11y 6m', measurementWindow: '6 months' },
      { planId: plan.id, needCategory: 'Literacy', metricKey: 'written_output',   baselineValue: '180 words/30min', targetValue: '240 words/30min', measurementWindow: '6 months' },
      { planId: plan.id, needCategory: 'Attention', metricKey: 'on_task_duration', baselineValue: '12 min sustained', targetValue: '20 min sustained', measurementWindow: '3 months' },
    ],
  })

  await prisma.planStrategy.createMany({
    skipDuplicates: true,
    data: [
      { planId: plan.id, strategyText: 'Provide sentence starters and writing frames for extended tasks', appliesTo: 'HOMEWORK' },
      { planId: plan.id, strategyText: 'Allow extra time (25%) for timed assessments', appliesTo: 'BOTH' },
      { planId: plan.id, strategyText: 'Seat near the front of the classroom, away from distractions', appliesTo: 'CLASSROOM' },
      { planId: plan.id, strategyText: 'Break extended tasks into numbered sub-tasks', appliesTo: 'BOTH' },
      { planId: plan.id, strategyText: 'Check understanding at each stage before moving on', appliesTo: 'CLASSROOM' },
    ],
  })
  console.log('  ✓ SEND status & Plan for Aiden Hughes')

  // ── IndividualLearningPlan + K Plan for Aiden Hughes ─────────────────────
  // Required so the Class tab shows the ILP badge (hasIlp=true) and K Plan
  // classroom tips for students in 9E/En1.
  const aidenIlp = await prisma.individualLearningPlan.upsert({
    where:  { id: 'seed-ilp-aiden-hughes' },
    update: {},
    create: {
      id:               'seed-ilp-aiden-hughes',
      schoolId:         school.id,
      studentId:        created['a.hughes'].id,
      createdBy:        created['r.morris'].id,
      sendCategory:     'SEN_SUPPORT',
      currentStrengths: 'Verbally articulate and contributes well to class discussions. Good memory for quotations and retrieval of texts read in class. Responds positively to teacher encouragement.',
      areasOfNeed:      'Extended writing — difficulty sustaining output beyond two paragraphs without a planning scaffold. Processing speed under timed conditions.',
      strategies: [
        'Provide a 4-box paragraph planner for all extended written tasks',
        'Allow 25% extra time on timed assessments',
        'Seat near the front, away from high-traffic areas',
        'Break extended tasks into clearly numbered sub-tasks',
        'Check understanding at each stage before moving on',
      ],
      successCriteria: 'Independently complete a structured 4-paragraph essay using planning frame by end of Spring term.',
      reviewDate:       new Date('2026-06-20'),
      status:           'active',
      parentConsent:    true,
    },
  })

  await prisma.ilpTarget.createMany({
    skipDuplicates: true,
    data: [
      {
        id:             'seed-ilpt-aiden-1',
        ilpId:          aidenIlp.id,
        target:         'Use a planning frame independently to organise extended written responses',
        strategy:       'Provide 4-box paragraph planner before every extended writing task; teacher models use in starter activity.',
        successMeasure: 'Uses planner without prompting on 3 consecutive written tasks.',
        targetDate:     new Date('2026-06-20'),
        status:         'active',
      },
      {
        id:             'seed-ilpt-aiden-2',
        ilpId:          aidenIlp.id,
        target:         'Complete full-length timed responses within GCSE time allowance (with 25% extra time)',
        strategy:       '25% extra time applied to all in-class assessments; practice timed conditions fortnightly.',
        successMeasure: 'Completes at least 3 full-length timed responses within adjusted time allowance.',
        targetDate:     new Date('2026-06-20'),
        status:         'active',
      },
    ],
  })

  await prisma.learnerPassport.upsert({
    where:  { id: 'seed-kplan-aiden-hughes' },
    update: {},
    create: {
      id:             'seed-kplan-aiden-hughes',
      schoolId:       school.id,
      studentId:      created['a.hughes'].id,
      ilpId:          aidenIlp.id,
      sendInformation:'Aiden has Specific Learning Difficulties affecting reading speed and written output under time pressure. He is verbal, confident in discussion, and responds well to structured writing supports. Parents are fully engaged and supportive.',
      teacherActions: [
        'Provide 4-box paragraph planner before extended writing tasks',
        'Allow 25% extra time — flag on seating plan and assessment coversheet',
        'Seat near the front, away from distractions',
        'Break tasks into numbered sub-steps and confirm understanding after each',
        'Accept verbal responses or bullet-point planning as an alternative to prose drafting',
        'Give quiet 1:1 check-in after whole-class instructions',
      ],
      studentCommitments: [
        'Use the paragraph planner before starting any extended answer',
        'Ask for the writing frame if feeling stuck rather than sitting in silence',
        'Read back answers aloud quietly to self-check before submitting',
      ],
      status:      'APPROVED',
      approvedBy:  created['r.morris'].id,
      approvedAt:  new Date('2026-01-20'),
    },
  })
  console.log('  ✓ ILP + K Plan — Aiden Hughes (9E/En1)')

  // ── Analytics aggregates ───────────────────────────────────────────────────
  const termId = 'term-2025-spring'
  const aggregates = [
    { classId: classes['9E/En1'].id,  completionRate: 0.82, avgScore: 6.4, predictedDelta: 0.3,  integrityFlagRate: 0.0  },
    { classId: classes['10E/En2'].id, completionRate: 0.91, avgScore: 7.1, predictedDelta: 0.5,  integrityFlagRate: 0.02 },
    { classId: classes['11E/En1'].id, completionRate: 0.76, avgScore: 6.8, predictedDelta: -0.1, integrityFlagRate: 0.05 },
  ]
  for (const a of aggregates) {
    await prisma.classPerformanceAggregate.upsert({
      where:  { classId_termId: { classId: a.classId, termId } },
      update: a,
      create: { schoolId: school.id, termId, ...a },
    })
  }

  const subjectMedians = [
    { subjectId: 'English', yearGroup: 9,  termId, mediansJson: { avgScore: 6.1, completionRate: 0.79, homeworkCount: 8  } },
    { subjectId: 'English', yearGroup: 10, termId, mediansJson: { avgScore: 6.8, completionRate: 0.85, homeworkCount: 9  } },
    { subjectId: 'English', yearGroup: 11, termId, mediansJson: { avgScore: 7.0, completionRate: 0.81, homeworkCount: 12 } },
  ]
  for (const s of subjectMedians) {
    await prisma.subjectMedianAggregate.upsert({
      where:  { schoolId_subjectId_yearGroup_termId: { schoolId: school.id, subjectId: s.subjectId, yearGroup: s.yearGroup, termId } },
      update: { mediansJson: s.mediansJson },
      create: { schoolId: school.id, ...s },
    })
  }
  console.log('  ✓ Analytics aggregates')

  // ── Notifications ──────────────────────────────────────────────────────────
  const jpatelId = created['j.patel'].id

  const notifs = [
    { id: 'notif-1', type: 'HOMEWORK_SUBMITTED', title: 'New submission — AIC Context Research', body: 'Maya Johnson submitted "An Inspector Calls — Context Research" for 9E/En1. Ready to mark.', read: false, createdAt: daysAgo(0), linkHref: '/homework' },
    { id: 'notif-2', type: 'HOMEWORK_SUBMITTED', title: 'New submission — AIC Context Research', body: 'Aiden Hughes submitted "An Inspector Calls — Context Research" for 9E/En1.', read: true, createdAt: daysAgo(1), linkHref: '/homework' },
    { id: 'notif-3', type: 'HOMEWORK_SUBMITTED', title: 'New submission — Macbeth Essay Plan', body: 'Aiden Hughes submitted the Macbeth essay plan. Pending your review.', read: false, createdAt: daysAgo(1), linkHref: '/homework' },
    { id: 'notif-4', type: 'PLAN_REVIEW_DUE',    title: 'ILP Review due in 30 days — Aiden Hughes', body: 'Aiden Hughes\'s Individual Learning Plan is due for review on ' + daysFromNow(30).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + '. Please prepare updated targets.', read: false, createdAt: daysAgo(2), linkHref: '/plans' },
    { id: 'notif-5', type: 'GENERAL',             title: 'SEND review completed — Aiden Hughes', body: 'Rachel Morris (SENCo) has confirmed Aiden Hughes\'s SEN Support status. His ILP is now active.', read: true, createdAt: daysAgo(14), linkHref: '/plans' },
    { id: 'notif-6', type: 'GENERAL',             title: 'New resource SEND review available', body: 'Your Macbeth slides have been reviewed. SEND score: 72/100. View suggestions to improve accessibility.', read: false, createdAt: daysAgo(3), linkHref: '/resources' },
    { id: 'notif-7', type: 'GENERAL',             title: 'Homework published — 10E/En2', body: '"Macbeth — Ambition Essay Plan" is now live for 10E/En2. Students can begin submitting.', read: true, createdAt: daysAgo(5), linkHref: '/homework' },
  ]
  for (const n of notifs) {
    await prisma.notification.upsert({
      where:  { id: n.id },
      update: { read: n.read },
      create: {
        id: n.id, schoolId: school.id, userId: jpatelId,
        type: n.type, title: n.title, body: n.body,
        read: n.read, linkHref: n.linkHref, createdAt: n.createdAt,
      },
    })
  }
  console.log('  ✓ Notifications')

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION C — SEND WORKFLOW VALIDATION DATASET
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n── Section C: SEND Workflow Validation Dataset ──────────────────────────\n')

  // ── C1/C2: Classes ──────────────────────────────────────────────────────────
  const class7A = await prisma.schoolClass.upsert({
    where:  { id: 'demo-class-7A-eng' },
    update: {},
    create: { id: 'demo-class-7A-eng', schoolId: school.id, name: '7A/En1', subject: 'English', yearGroup: 7, department: 'English' },
  })
  const class7B = await prisma.schoolClass.upsert({
    where:  { id: 'demo-class-7B-ma' },
    update: {},
    create: { id: 'demo-class-7B-ma', schoolId: school.id, name: '7B/Ma1', subject: 'Maths', yearGroup: 7, department: 'Mathematics' },
  })
  // Assign j.patel to English, add a maths teacher
  const kwright = await prisma.user.upsert({
    where:  { email: 'k.wright@omnisdemo.school' },
    update: { firstName: 'Kate', lastName: 'Wright' },
    create: { schoolId: school.id, email: 'k.wright@omnisdemo.school', passwordHash, role: Role.TEACHER, firstName: 'Kate', lastName: 'Wright' },
  })
  await prisma.classTeacher.upsert({
    where:  { classId_userId: { classId: class7A.id, userId: created['j.patel'].id } },
    update: {}, create: { classId: class7A.id, userId: created['j.patel'].id },
  })
  await prisma.classTeacher.upsert({
    where:  { classId_userId: { classId: class7B.id, userId: kwright.id } },
    update: {}, create: { classId: class7B.id, userId: kwright.id },
  })

  // ── C2: Students ────────────────────────────────────────────────────────────
  const sectionCStudents: { key: string; email: string; firstName: string; lastName: string; classId: string }[] = [
    // 7A/En1
    { key: 's.novak',    email: 's.novak@students.omnisdemo.school',    firstName: 'Sam',    lastName: 'Novak',    classId: class7A.id },
    { key: 'p.reddy',    email: 'p.reddy@students.omnisdemo.school',    firstName: 'Priya',  lastName: 'Reddy',    classId: class7A.id },
    { key: 'j.blake',    email: 'j.blake@students.omnisdemo.school',    firstName: 'Jordan', lastName: 'Blake',    classId: class7A.id },
    { key: 'f.yusuf',    email: 'f.yusuf@students.omnisdemo.school',    firstName: 'Fatima', lastName: 'Yusuf',    classId: class7A.id },
    // 7B/Ma1
    { key: 'l.okafor',  email: 'l.okafor@students.omnisdemo.school',   firstName: 'Leo',    lastName: 'Okafor',   classId: class7B.id },
    { key: 'm.brennan', email: 'm.brennan@students.omnisdemo.school',   firstName: 'Mia',    lastName: 'Brennan',  classId: class7B.id },
    { key: 'c.doherty', email: 'c.doherty@students.omnisdemo.school',   firstName: 'Callum', lastName: 'Doherty',  classId: class7B.id },
    { key: 'a.nurova',  email: 'a.nurova@students.omnisdemo.school',    firstName: 'Asel',   lastName: 'Nurova',   classId: class7B.id },
  ]
  const sc: Record<string, { id: string }> = {}
  for (const s of sectionCStudents) {
    const user = await prisma.user.upsert({
      where:  { email: s.email },
      update: { firstName: s.firstName, lastName: s.lastName },
      create: { schoolId: school.id, email: s.email, passwordHash, role: Role.STUDENT, firstName: s.firstName, lastName: s.lastName },
    })
    sc[s.key] = user
    await prisma.enrolment.upsert({
      where:  { classId_userId: { classId: s.classId, userId: user.id } },
      update: {}, create: { classId: s.classId, userId: user.id },
    })
    console.log(`  ✓ STUDENT  ${s.email}`)
  }

  // ── C3: SEND profiles ───────────────────────────────────────────────────────

  // S1 — Sam Novak: Communication & Interaction
  await prisma.sendStatus.upsert({
    where:  { studentId: sc['s.novak'].id },
    update: {},
    create: { studentId: sc['s.novak'].id, activeStatus: SendStatusValue.SEN_SUPPORT, activeSource: 'SENCO', needArea: 'Communication & Interaction' },
  })
  const planS1 = await prisma.plan.upsert({
    where:  { id: 'demo-plan-s1-novak' },
    update: {},
    create: {
      id: 'demo-plan-s1-novak', schoolId: school.id, studentId: sc['s.novak'].id,
      status: PlanStatus.ACTIVE_INTERNAL, reviewDate: daysFromNow(30),
      activatedById: created['r.morris'].id, activatedAt: daysAgo(21),
    },
  })
  await prisma.planTarget.createMany({
    skipDuplicates: true,
    data: [
      { planId: planS1.id, needCategory: 'Communication', metricKey: 'expressive_language',      baselineValue: '3-word utterances in structured tasks',     targetValue: '5+ word utterances independently',              measurementWindow: '6 months' },
      { planId: planS1.id, needCategory: 'Communication', metricKey: 'listening_comprehension',  baselineValue: 'Follows 1-step instruction reliably',        targetValue: 'Follows 2-step instruction independently',       measurementWindow: '3 months' },
    ],
  })
  await prisma.planStrategy.createMany({
    skipDuplicates: true,
    data: [
      { planId: planS1.id, strategyText: 'Break all written instructions into single numbered steps — no multi-part sentences', appliesTo: 'BOTH' },
      { planId: planS1.id, strategyText: 'Accompany verbal instructions with visual supports (icons, diagrams, or written key words)', appliesTo: 'CLASSROOM' },
      { planId: planS1.id, strategyText: 'Reduce language complexity: avoid passive voice, idioms, and complex subordinate clauses', appliesTo: 'BOTH' },
      { planId: planS1.id, strategyText: 'Provide sentence starters and a structured writing frame for all written tasks', appliesTo: 'HOMEWORK' },
    ],
  })

  // S2 — Priya Reddy: Cognition & Learning
  await prisma.sendStatus.upsert({
    where:  { studentId: sc['p.reddy'].id },
    update: {},
    create: { studentId: sc['p.reddy'].id, activeStatus: SendStatusValue.SEN_SUPPORT, activeSource: 'SENCO', needArea: 'Cognition & Learning' },
  })
  const planS2 = await prisma.plan.upsert({
    where:  { id: 'demo-plan-s2-reddy' },
    update: {},
    create: {
      id: 'demo-plan-s2-reddy', schoolId: school.id, studentId: sc['p.reddy'].id,
      status: PlanStatus.ACTIVE_INTERNAL, reviewDate: daysFromNow(45),
      activatedById: created['r.morris'].id, activatedAt: daysAgo(14),
    },
  })
  await prisma.planTarget.createMany({
    skipDuplicates: true,
    data: [
      { planId: planS2.id, needCategory: 'Literacy',   metricKey: 'reading_fluency',   baselineValue: 'Reading age 8y 3m',             targetValue: 'Reading age 9y 0m',              measurementWindow: '6 months' },
      { planId: planS2.id, needCategory: 'Processing', metricKey: 'written_output',    baselineValue: 'Completes 3 questions in 30 min', targetValue: 'Completes 5 questions in 30 min', measurementWindow: '3 months' },
    ],
  })
  await prisma.planStrategy.createMany({
    skipDuplicates: true,
    data: [
      { planId: planS2.id, strategyText: 'Always provide a worked example before any independent task', appliesTo: 'BOTH' },
      { planId: planS2.id, strategyText: 'Allow 25% extra time on all timed assessments and homework', appliesTo: 'BOTH' },
      { planId: planS2.id, strategyText: 'Provide graphic organisers and mind-map templates for planning tasks', appliesTo: 'HOMEWORK' },
      { planId: planS2.id, strategyText: 'Pair with a reading partner for extended texts; pre-teach key vocabulary', appliesTo: 'CLASSROOM' },
    ],
  })
  console.log('  ✓ SEND profiles: Sam Novak (C&I) + Priya Reddy (C&L)')

  // ── C4: Lessons ─────────────────────────────────────────────────────────────

  const engLesson = await prisma.lesson.upsert({
    where:  { id: 'demo-lesson-7A-eng' },
    update: { title: 'Descriptive Writing — Sensory Detail', objectives: ['Use sensory language to create vivid descriptive writing', 'Identify and analyse the effect of sensory imagery in a model text', 'Draft and refine a descriptive paragraph independently'] },
    create: {
      id: 'demo-lesson-7A-eng', schoolId: school.id, classId: class7A.id,
      title: 'Descriptive Writing — Sensory Detail',
      objectives: [
        'Use sensory language to create vivid descriptive writing',
        'Identify and analyse the effect of sensory imagery in a model text',
        'Draft and refine a descriptive paragraph independently',
      ],
      scheduledAt: lessonDate(0, 1, 14),   // Tue 14:00
      endsAt:      lessonDate(0, 1, 15),
      published: true, lessonType: LessonType.NORMAL, createdBy: created['j.patel'].id,
    },
  })

  const mathLesson = await prisma.lesson.upsert({
    where:  { id: 'demo-lesson-7B-maths' },
    update: { title: 'Fractions — Adding & Subtracting with Different Denominators', objectives: ['Find the lowest common multiple (LCM) of two numbers', 'Add and subtract fractions with different denominators', 'Simplify answers to lowest terms'] },
    create: {
      id: 'demo-lesson-7B-maths', schoolId: school.id, classId: class7B.id,
      title: 'Fractions — Adding & Subtracting with Different Denominators',
      objectives: [
        'Find the lowest common multiple (LCM) of two numbers',
        'Add and subtract fractions with different denominators',
        'Simplify answers to lowest terms',
      ],
      scheduledAt: lessonDate(0, 3, 9),    // Thu 09:00
      endsAt:      lessonDate(0, 3, 10),
      published: true, lessonType: LessonType.NORMAL, createdBy: kwright.id,
    },
  })
  console.log('  ✓ Lessons: Descriptive Writing (7A/En1) + Fractions (7B/Ma1)')

  // Lesson resources — English
  const engResources = [
    { id: 'demo-7A-res-plan',      type: ResourceType.PLAN,      label: 'Descriptive Writing Lesson Plan.pdf',          url: 'https://cdn.example.com/7a-desc-plan.pdf' },
    { id: 'demo-7A-res-slides',    type: ResourceType.SLIDES,    label: 'Sensory Language — Lesson Slides.pptx',         url: 'https://cdn.example.com/7a-desc-slides.pptx' },
    { id: 'demo-7A-res-extract',   type: ResourceType.WORKSHEET, label: 'Model Text Extract — The Storm.pdf',            url: 'https://cdn.example.com/7a-storm-extract.pdf' },
    { id: 'demo-7A-res-ws',        type: ResourceType.WORKSHEET, label: 'Sensory Language Annotation Frame.pdf',         url: 'https://cdn.example.com/7a-annotation-frame.pdf' },
    { id: 'demo-7A-res-wordbank',  type: ResourceType.WORKSHEET, label: 'Sensory Word Bank & Sentence Starters.pdf',     url: 'https://cdn.example.com/7a-wordbank.pdf' },
    { id: 'demo-7A-res-bbc',       type: ResourceType.LINK,      label: 'BBC Bitesize — Descriptive Writing Techniques', url: 'https://www.bbc.co.uk/bitesize/topics/zfkk6yc' },
    { id: 'demo-7A-res-video',     type: ResourceType.VIDEO,     label: 'How to Write Descriptively — GCSE Tips (YouTube)', url: 'https://www.youtube.com/watch?v=descriptive-writing' },
  ]
  for (const r of engResources) {
    await prisma.resource.upsert({
      where:  { id: r.id }, update: {},
      create: { id: r.id, schoolId: school.id, lessonId: engLesson.id, type: r.type, label: r.label, url: r.url, createdBy: created['j.patel'].id },
    })
  }
  // SEND review on the English slides
  await prisma.resourceReview.upsert({
    where:  { resourceId: 'demo-7A-res-slides' },
    update: {},
    create: {
      resourceId: 'demo-7A-res-slides', sendScore: 61,
      suggestions: [
        { text: 'Instructions on slide 3 contain 4 steps in one sentence — split into numbered list', accepted: false },
        { text: 'Key vocabulary not pre-taught before task — add a glossary slide', accepted: false },
        { text: 'Task 2 prompt uses abstract language ("create atmosphere") — rephrase with concrete example', accepted: false },
        { text: 'No visual scaffold for the writing frame — add a labelled example paragraph', accepted: false },
        { text: 'Slide 5 has dense body text (>80 words) — reduce or chunk', accepted: false },
      ],
      accepted: false,
    },
  })

  // Lesson resources — Maths
  const mathResources = [
    { id: 'demo-7B-res-plan',      type: ResourceType.PLAN,      label: 'Fractions Lesson Plan.pdf',                  url: 'https://cdn.example.com/7b-frac-plan.pdf' },
    { id: 'demo-7B-res-slides',    type: ResourceType.SLIDES,    label: 'LCM & Adding Fractions — Slides.pptx',       url: 'https://cdn.example.com/7b-frac-slides.pptx' },
    { id: 'demo-7B-res-worked',    type: ResourceType.WORKSHEET, label: 'Worked Examples — Finding LCM.pdf',          url: 'https://cdn.example.com/7b-lcm-worked.pdf' },
    { id: 'demo-7B-res-ws',        type: ResourceType.WORKSHEET, label: 'Fraction Practice Grid (Task 1 & 2).pdf',    url: 'https://cdn.example.com/7b-frac-practice.pdf' },
    { id: 'demo-7B-res-bbc',       type: ResourceType.LINK,      label: 'BBC Bitesize — Adding Fractions',            url: 'https://www.bbc.co.uk/bitesize/topics/zt9n9ty/articles/zx73o9q' },
    { id: 'demo-7B-res-video',     type: ResourceType.VIDEO,     label: 'Adding Fractions Step-by-Step (YouTube)',    url: 'https://www.youtube.com/watch?v=fractions-lcm' },
  ]
  for (const r of mathResources) {
    await prisma.resource.upsert({
      where:  { id: r.id }, update: {},
      create: { id: r.id, schoolId: school.id, lessonId: mathLesson.id, type: r.type, label: r.label, url: r.url, createdBy: kwright.id },
    })
  }
  console.log('  ✓ Lesson resources')

  // ── C5: Homework assignments (standard + scaffolded) ─────────────────────────

  // English — Standard
  const engHWStd = await prisma.homework.upsert({
    where:  { id: 'demo-hw-7A-desc-std' },
    update: {},
    create: {
      id: 'demo-hw-7A-desc-std', schoolId: school.id, classId: class7A.id, lessonId: engLesson.id,
      title: 'Descriptive Writing — A Place You Know Well (Standard)',
      instructions: 'Write a descriptive paragraph (150–200 words) about a place that is special to you. Use at least four different sensory details (sight, sound, smell, touch or taste). Try to include one metaphor or simile.',
      modelAnswer: 'A strong response will open with an establishing sentence that situates the reader. Sensory details should be varied (not all visual) and embedded naturally rather than listed. A metaphor or simile should be used purposefully to create effect. The paragraph should have a clear focus and a sense of atmosphere throughout.',
      gradingBands: {
        '1–3': 'Some description; limited sensory detail; language choices are straightforward',
        '4–6': 'Clear description; 3+ sensory details; some figurative language; some control of atmosphere',
        '7–9': 'Vivid, controlled description; varied sensory detail; effective figurative language; sustained atmosphere',
      },
      dueAt: daysFromNow(6), status: HomeworkStatus.PUBLISHED,
      type: HomeworkType.EXTENDED_WRITING, releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts: 2, createdBy: created['j.patel'].id,
    },
  })

  // English — Scaffolded (SEND variant)
  const engHWScaf = await prisma.homework.upsert({
    where:  { id: 'demo-hw-7A-desc-scaf' },
    update: {},
    create: {
      id: 'demo-hw-7A-desc-scaf', schoolId: school.id, classId: class7A.id, lessonId: engLesson.id,
      title: 'Descriptive Writing — A Place You Know Well (Scaffolded)',
      instructions: [
        'Step 1: Choose a place you know well (e.g. your bedroom, a park, a shop).',
        'Step 2: Write one sentence about what you can SEE in that place.',
        'Step 3: Write one sentence about what you can HEAR in that place.',
        'Step 4: Write one sentence about what you can SMELL or FEEL in that place.',
        'Step 5: Use one word from the Sensory Word Bank in each sentence.',
        'Aim for 3–5 sentences in total.',
      ].join('\n'),
      modelAnswer: 'A supported response should demonstrate an attempt to describe a specific place using at least 3 sensory modalities. Sentence starters may be used. Vocabulary from the word bank is acceptable and encouraged. Atmosphere is secondary to sensory specificity at this stage.',
      gradingBands: {
        '1–3': 'Describes place with 1–2 sensory details; minimal vocabulary variety',
        '4–6': 'Describes place with 3 sensory details; uses word bank vocabulary appropriately',
        '7–9': 'Describes place with 3+ sensory details; goes beyond word bank; shows emerging control of effect',
      },
      dueAt: daysFromNow(6), status: HomeworkStatus.PUBLISHED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts: 3, createdBy: created['j.patel'].id,
    },
  })

  // Maths — Standard
  const mathHWStd = await prisma.homework.upsert({
    where:  { id: 'demo-hw-7B-frac-std' },
    update: {},
    create: {
      id: 'demo-hw-7B-frac-std', schoolId: school.id, classId: class7B.id, lessonId: mathLesson.id,
      title: 'Fractions — Adding & Subtracting Practice (Standard)',
      instructions: 'Show all working. Simplify all answers.\n1. 1/3 + 1/4\n2. 3/4 + 2/5\n3. 5/6 − 1/4\n4. 7/8 − 2/3\n5. Explain in your own words: why do you need to find a common denominator before adding fractions?',
      modelAnswer: '1. 7/12  |  2. 23/20 = 1 3/20  |  3. 7/12  |  4. 5/24  |  5. Pupils should reference that fractions must refer to equal-sized parts before they can be combined; the common denominator creates equivalent fractions with equal-sized parts.',
      gradingBands: {
        '1–2': 'Correct method on 1–2 questions; errors in LCM or equivalent fractions',
        '3–4': 'Correct method on 3–4 questions; minor arithmetic errors; partial explanation',
        '5':   'All 4 calculations correct and simplified; clear, accurate explanation of common denominator',
      },
      dueAt: daysFromNow(5), status: HomeworkStatus.PUBLISHED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 2, createdBy: kwright.id,
    },
  })

  // Maths — Scaffolded (SEND variant)
  const mathHWScaf = await prisma.homework.upsert({
    where:  { id: 'demo-hw-7B-frac-scaf' },
    update: {},
    create: {
      id: 'demo-hw-7B-frac-scaf', schoolId: school.id, classId: class7B.id, lessonId: mathLesson.id,
      title: 'Fractions — Adding & Subtracting Practice (Scaffolded)',
      instructions: [
        'A step-by-step method card is attached. Follow each step.',
        'Step 1: Find the LCM of the two denominators.',
        'Step 2: Convert each fraction to an equivalent fraction with the LCM as the denominator.',
        'Step 3: Add or subtract the numerators. Keep the denominator the same.',
        'Step 4: Simplify if possible.',
        '---',
        '1. 1/2 + 1/4  (hint: LCM of 2 and 4 is 4)',
        '2. 2/3 + 1/6  (hint: LCM of 3 and 6 is 6)',
        '3. 3/4 − 1/2  (hint: LCM of 4 and 2 is 4)',
      ].join('\n'),
      modelAnswer: '1. 3/4  |  2. 5/6  |  3. 1/4  |  All answers already in simplest form. Credit method even if arithmetic errors are minor.',
      gradingBands: {
        '1': 'Attempts method with method card; errors in LCM or conversion',
        '2': 'Correct LCM and conversion; minor arithmetic error in 1 question',
        '3': 'All 3 correct with clear working shown',
      },
      dueAt: daysFromNow(7), status: HomeworkStatus.PUBLISHED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts: 3, createdBy: kwright.id,
    },
  })
  console.log('  ✓ Homework: 2× standard + 2× scaffolded')

  // ── C6: Submissions + marking outcomes ───────────────────────────────────────

  // English standard homework submissions (7A)
  // Sam Novak (S1) — submitted, low score, misconception tagged
  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: engHWStd.id, studentId: sc['s.novak'].id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: engHWStd.id, studentId: sc['s.novak'].id,
      content: 'My bedroom is nice. It is quiet and warm. There is a window. I can see trees outside. My blanket is soft. It smells like home.',
      status: SubmissionStatus.RETURNED, submittedAt: daysAgo(2), markedAt: daysAgo(1),
      autoScore: 2, teacherScore: 3, finalScore: 3,
      grade: '3',
      feedback: 'You have made a good start by including some sensory details (soft blanket, smell). To improve, try to develop each detail into a longer sentence that creates atmosphere. For example, instead of "It smells like home", try "A faint warmth — like freshly washed sheets — hung in the air." Try to include a simile or metaphor in your next draft.',
      misconceptionTags: ['insufficient_figurative_language', 'sensory_details_not_developed', 'sentence_variety_limited'],
      integrityReviewed: true,
    },
  })

  // Priya Reddy (S2) — submitted, low score, misconception tagged
  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: engHWStd.id, studentId: sc['p.reddy'].id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: engHWStd.id, studentId: sc['p.reddy'].id,
      content: 'The park near my house has lots of green grass. I can smell flowers when I walk past. Children are playing loudly and their laughs echo. The metal of the gate is cold when I touch it. I like going there in the morning.',
      status: SubmissionStatus.RETURNED, submittedAt: daysAgo(2), markedAt: daysAgo(1),
      autoScore: 4, teacherScore: 4, finalScore: 4,
      grade: '4',
      feedback: 'Good work Priya — you have used four sensory details and they are specific (cold gate, flower smell, echoing laughter). To reach the next band, try to use a metaphor or simile to deepen the effect. You could also vary your sentence openings — try starting one with a verb (e.g. "Laughing, the children…") or a sensory phrase.',
      misconceptionTags: ['no_figurative_language', 'sentence_openings_repetitive'],
      integrityReviewed: true,
    },
  })

  // Jordan Blake — submitted, high score
  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: engHWStd.id, studentId: sc['j.blake'].id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: engHWStd.id, studentId: sc['j.blake'].id,
      content: 'The old library swallowed me whole the moment I stepped inside. A cathedral of silence pressed down from the vaulted ceiling, broken only by the rustle of turning pages — dry as autumn leaves. The scent of aged paper drifted between the shelves like a ghost, and the wooden floor groaned softly beneath my feet, cold even through my shoes. Every breath tasted faintly of dust and possibility.',
      status: SubmissionStatus.RETURNED, submittedAt: daysAgo(3), markedAt: daysAgo(2),
      autoScore: 8, teacherScore: 8, finalScore: 8,
      grade: '8',
      feedback: 'Excellent writing, Jordan. Your extended metaphor ("swallowed me whole", "cathedral of silence") is sustained and purposeful. Sensory variety is strong and every detail contributes to atmosphere. For a top-band response, consider whether "dust and possibility" needs the slightly clichéd "possibility" — trust your concrete imagery to do the work.',
      misconceptionTags: [],
      integrityReviewed: true,
    },
  })

  // Fatima Yusuf — MISSING (no submission)
  // No submission record created — represents a non-submission for validation

  // Maths standard homework submissions (7B)
  // Leo Okafor — submitted, high score
  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: mathHWStd.id, studentId: sc['l.okafor'].id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: mathHWStd.id, studentId: sc['l.okafor'].id,
      content: '1. 1/3 + 1/4 = 4/12 + 3/12 = 7/12\n2. 3/4 + 2/5 = 15/20 + 8/20 = 23/20 = 1 3/20\n3. 5/6 − 1/4 = 10/12 − 3/12 = 7/12\n4. 7/8 − 2/3 = 21/24 − 16/24 = 5/24\n5. You need a common denominator because you can only add fractions that have been split into the same size parts. Without it you would be adding different-sized pieces which gives the wrong answer.',
      status: SubmissionStatus.RETURNED, submittedAt: daysAgo(1), markedAt: daysAgo(0),
      autoScore: 5, teacherScore: 5, finalScore: 5,
      grade: '5',
      feedback: 'Full marks — excellent working shown throughout. Your explanation in Q5 is clear and uses the right reasoning. Well done.',
      misconceptionTags: [],
      integrityReviewed: true,
    },
  })

  // Mia Brennan — submitted, mid score, misconception tagged
  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: mathHWStd.id, studentId: sc['m.brennan'].id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: mathHWStd.id, studentId: sc['m.brennan'].id,
      content: '1. 1/3 + 1/4 = 2/7\n2. 3/4 + 2/5 = 5/9\n3. 5/6 − 1/4 = 4/2 = 2\n4. 7/8 − 2/3 = 5/5 = 1\n5. You need to make the denominators the same so the fractions are the same type.',
      status: SubmissionStatus.RETURNED, submittedAt: daysAgo(1), markedAt: daysAgo(0),
      autoScore: 1, teacherScore: 2, finalScore: 2,
      grade: '2',
      feedback: 'Mia, I can see you understand that the denominators need to match, which is the right idea. However, in Q1 and Q2 you have added the numerators and denominators separately (1+1=2, 3+4=7) which gives incorrect answers. The key step is to find the LCM first and convert each fraction — the denominator should never change when you add the numerators. Please revisit the worked example from Thursday and attempt the scaffolded version.',
      misconceptionTags: ['adds_numerators_and_denominators_directly', 'LCM_not_applied', 'equivalent_fractions_not_formed'],
      integrityReviewed: true,
    },
  })

  // Callum Doherty — submitted, mid score
  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: mathHWStd.id, studentId: sc['c.doherty'].id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: mathHWStd.id, studentId: sc['c.doherty'].id,
      content: '1. 4/12 + 3/12 = 7/12 ✓\n2. 15/20 + 8/20 = 23/20 ✓\n3. 10/12 − 3/12 = 7/12 ✓\n4. 21/24 − 16/24 = 5/24 ✓\n5. The denominators have to be the same size.',
      status: SubmissionStatus.RETURNED, submittedAt: daysAgo(1), markedAt: daysAgo(0),
      autoScore: 4, teacherScore: 4, finalScore: 4,
      grade: '4',
      feedback: 'Great work on Q1–Q4, all correct with clear working. Your Q5 explanation is on the right track but needs more detail — try to explain WHY the denominators need to be the same (think about equal-sized parts). One more sentence would push this to full marks.',
      misconceptionTags: ['partial_explanation_q5'],
      integrityReviewed: true,
    },
  })

  // Asel Nurova — MISSING (no submission)
  // No submission record created

  console.log('  ✓ Submissions: 3× English (1 missing: Fatima Yusuf), 3× Maths (1 missing: Asel Nurova)')
  console.log('  ✓ Misconception tags applied to low-scoring submissions')

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D: EXPANDED TEST DATA
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n── Section D: Expanded test data ──────────────────────────────────────────')

  // ── Fix staff metadata ─────────────────────────────────────────────────────
  await prisma.user.update({ where: { email: 't.adeyemi@omnisdemo.school' }, data: { yearGroup: 9 } })
  await prisma.user.update({ where: { email: 'd.brooks@omnisdemo.school'  }, data: { department: 'English' } })
  console.log('  ✓ Set Temi Adeyemi yearGroup=9, David Brooks department=English')

  // ── SLT user ───────────────────────────────────────────────────────────────
  const caroline = await prisma.user.upsert({
    where:  { email: 'c.roberts@omnisdemo.school' },
    update: { firstName: 'Caroline', lastName: 'Roberts' },
    create: { schoolId: school.id, email: 'c.roberts@omnisdemo.school', passwordHash, role: Role.SLT, firstName: 'Caroline', lastName: 'Roberts' },
  })
  console.log('  ✓ SLT user: Caroline Roberts (c.roberts@omnisdemo.school)')

  // ── Look up existing classes ───────────────────────────────────────────────
  const cls9  = await prisma.schoolClass.findUniqueOrThrow({ where: { id: 'demo-class-9E-En1'  } })
  const cls10 = await prisma.schoolClass.findUniqueOrThrow({ where: { id: 'demo-class-10E-En2' } })
  const cls11 = await prisma.schoolClass.findUniqueOrThrow({ where: { id: 'demo-class-11E-En1' } })

  // ── Year 10 Maths class ────────────────────────────────────────────────────
  const cls10Ma = await prisma.schoolClass.upsert({
    where:  { id: 'demo-class-10M-Ma1' },
    update: {},
    create: { id: 'demo-class-10M-Ma1', schoolId: school.id, name: '10M/Ma1', subject: 'Maths', yearGroup: 10, department: 'Mathematics' },
  })
  // Kate Wright — upsert (also exists in Section C)
  const kwrightD = await prisma.user.upsert({
    where:  { email: 'k.wright@omnisdemo.school' },
    update: { firstName: 'Kate', lastName: 'Wright', department: 'Mathematics' },
    create: { schoolId: school.id, email: 'k.wright@omnisdemo.school', passwordHash, role: Role.TEACHER, firstName: 'Kate', lastName: 'Wright', department: 'Mathematics' },
  })
  await prisma.classTeacher.upsert({
    where:  { classId_userId: { classId: cls10Ma.id, userId: kwrightD.id } },
    update: {},
    create: { classId: cls10Ma.id, userId: kwrightD.id },
  })
  console.log('  ✓ Year 10 Maths class: 10M/Ma1 (Kate Wright)')

  // ── New students ──────────────────────────────────────────────────────────
  // Helper: upsert student + enrolment
  async function addStudent(email: string, firstName: string, lastName: string, classId: string) {
    const u = await prisma.user.upsert({
      where:  { email },
      update: { firstName, lastName },
      create: { schoolId: school.id, email, passwordHash, role: Role.STUDENT, firstName, lastName },
    })
    await prisma.enrolment.upsert({
      where:  { classId_userId: { classId, userId: u.id } },
      update: {},
      create: { classId, userId: u.id },
    })
    return u
  }

  // 9E/En1 — add 3 more (to 10 total)
  const sophieChen   = await addStudent('s.chen@students.omnisdemo.school',    'Sophie',   'Chen',    cls9.id)
  const marcusBell   = await addStudent('m.bell@students.omnisdemo.school',    'Marcus',   'Bell',    cls9.id)
  const kieranMurphy = await addStudent('k.murphy@students.omnisdemo.school',  'Kieran',   'Murphy',  cls9.id)

  // 10E/En2 — add 4 more (to 10 total)
  const naomiClarke  = await addStudent('n.clarke@students.omnisdemo.school',  'Naomi',    'Clarke',  cls10.id)
  const danielMwangi = await addStudent('d.mwangi@students.omnisdemo.school',  'Daniel',   'Mwangi',  cls10.id)
  const rosaFerretti = await addStudent('r.ferretti@students.omnisdemo.school','Rosa',     'Ferretti',cls10.id)
  const aaronWalsh   = await addStudent('a.walsh@students.omnisdemo.school',   'Aaron',    'Walsh',   cls10.id)

  // 11E/En1 — add 4 more (to 10 total)
  const anyaPatel    = await addStudent('a.patel@students.omnisdemo.school',   'Anya',     'Patel',   cls11.id)
  const benHartley   = await addStudent('b.hartley@students.omnisdemo.school', 'Ben',      'Hartley', cls11.id)
  const caitlinFox   = await addStudent('c.fox@students.omnisdemo.school',     'Caitlin',  'Fox',     cls11.id)
  const michaelT     = await addStudent('m.torres@students.omnisdemo.school',  'Michael',  'Torres',  cls11.id)

  // 10M/Ma1 — 8 students
  const rubyPham     = await addStudent('r.pham@students.omnisdemo.school',    'Ruby',     'Pham',    cls10Ma.id)
  const tylerNash    = await addStudent('t.nash@students.omnisdemo.school',    'Tyler',    'Nash',    cls10Ma.id)
  const jackOsei     = await addStudent('j.osei@students.omnisdemo.school',    'Jack',     'Osei',    cls10Ma.id)
  const imogenHart   = await addStudent('i.hart@students.omnisdemo.school',    'Imogen',   'Hart',    cls10Ma.id)
  const davidKim     = await addStudent('d.kim@students.omnisdemo.school',     'David',    'Kim',     cls10Ma.id)
  const laylaHassan  = await addStudent('l.hassan@students.omnisdemo.school',  'Layla',    'Hassan',  cls10Ma.id)
  const connorWebb   = await addStudent('c.webb@students.omnisdemo.school',    'Connor',   'Webb',    cls10Ma.id)
  const nadiaP       = await addStudent('n.popescu@students.omnisdemo.school', 'Nadia',    'Popescu', cls10Ma.id)

  console.log('  ✓ 19 new students added across 9E/En1, 10E/En2, 11E/En1, 10M/Ma1')

  // ── SEND profiles ─────────────────────────────────────────────────────────
  type SendSetup = { studentId: string; status: SendStatusValue; needArea: string }
  const sendSetups: SendSetup[] = [
    { studentId: sophieChen.id,   status: SendStatusValue.SEN_SUPPORT, needArea: 'Specific Learning Difficulty (Dyslexia)' },
    { studentId: marcusBell.id,   status: SendStatusValue.SEN_SUPPORT, needArea: 'Social, Emotional & Mental Health'       },
    { studentId: rosaFerretti.id, status: SendStatusValue.EHCP,        needArea: 'Specific Learning Difficulty (SpLD)'    },
    { studentId: aaronWalsh.id,   status: SendStatusValue.SEN_SUPPORT, needArea: 'Social, Emotional & Mental Health'      },
    { studentId: caitlinFox.id,   status: SendStatusValue.EHCP,        needArea: 'Communication & Interaction'            },
    { studentId: michaelT.id,     status: SendStatusValue.SEN_SUPPORT, needArea: 'Cognition & Learning'                   },
    { studentId: tylerNash.id,    status: SendStatusValue.SEN_SUPPORT, needArea: 'Social, Emotional & Mental Health'      },
    { studentId: laylaHassan.id,  status: SendStatusValue.SEN_SUPPORT, needArea: 'Specific Learning Difficulty (Dyslexia)'},
  ]
  for (const s of sendSetups) {
    await prisma.sendStatus.upsert({
      where:  { studentId: s.studentId },
      update: { activeStatus: s.status, needArea: s.needArea },
      create: { studentId: s.studentId, activeStatus: s.status, activeSource: 'SENCO', needArea: s.needArea },
    })
  }
  console.log('  ✓ 8 SEND profiles (2 EHCP, 6 SEN Support)')

  // ── ILP Plans ─────────────────────────────────────────────────────────────
  const senco = await prisma.user.findUniqueOrThrow({ where: { email: 'r.morris@omnisdemo.school' } })

  type PlanSeed = {
    id: string; studentId: string; status: PlanStatus
    reviewDate: Date; activatedAt: Date
    targets: { needCategory: string; metricKey: string; baselineValue: string; targetValue: string; measurementWindow: string }[]
    strategies: { strategyText: string; appliesTo: 'HOMEWORK' | 'CLASSROOM' | 'BOTH' }[]
  }

  const plans: PlanSeed[] = [
    // Sophie Chen — SEN Support, SpLD/Dyslexia — review in 45 days
    {
      id: 'demo-plan-d-chen',
      studentId: sophieChen.id,
      status: PlanStatus.ACTIVE_INTERNAL,
      reviewDate: daysFromNow(45),
      activatedAt: daysAgo(30),
      targets: [
        { needCategory: 'Literacy', metricKey: 'Reading Age', baselineValue: '9y 8m', targetValue: '10y 6m', measurementWindow: '6 months' },
        { needCategory: 'Literacy', metricKey: 'Written output (words/30 min)', baselineValue: '140', targetValue: '200', measurementWindow: '6 months' },
      ],
      strategies: [
        { strategyText: 'Provide coloured overlay or tinted paper for reading tasks', appliesTo: 'BOTH' },
        { strategyText: 'Allow use of a word processor for extended writing tasks', appliesTo: 'HOMEWORK' },
        { strategyText: 'Pre-teach key vocabulary before the lesson', appliesTo: 'CLASSROOM' },
        { strategyText: 'Offer 25% extra time for all timed assessments', appliesTo: 'BOTH' },
        { strategyText: 'Provide dyslexia-friendly font (Arial min 14pt) on all printed materials', appliesTo: 'CLASSROOM' },
      ],
    },
    // Marcus Bell — SEN Support, SEMH — review in 14 days (approaching)
    {
      id: 'demo-plan-d-bell',
      studentId: marcusBell.id,
      status: PlanStatus.ACTIVE_INTERNAL,
      reviewDate: daysFromNow(14),
      activatedAt: daysAgo(60),
      targets: [
        { needCategory: 'Social, Emotional & Mental Health', metricKey: 'On-task duration (mins)', baselineValue: '8', targetValue: '20', measurementWindow: '6 months' },
        { needCategory: 'Social, Emotional & Mental Health', metricKey: 'Homework completion rate (%)', baselineValue: '30', targetValue: '70', measurementWindow: '3 months' },
      ],
      strategies: [
        { strategyText: 'Daily 2-minute check-in at the start of each lesson', appliesTo: 'CLASSROOM' },
        { strategyText: 'Access to a calm space / pastoral team if feeling overwhelmed', appliesTo: 'CLASSROOM' },
        { strategyText: 'Break homework into small, clearly numbered steps', appliesTo: 'HOMEWORK' },
        { strategyText: 'Seat away from distractions, near the classroom door if needed', appliesTo: 'CLASSROOM' },
      ],
    },
    // Rosa Ferretti — EHCP, SpLD — OVERDUE by 5 days
    {
      id: 'demo-plan-d-ferretti',
      studentId: rosaFerretti.id,
      status: PlanStatus.ACTIVE_PARENT_SHARED,
      reviewDate: daysAgo(5),
      activatedAt: daysAgo(180),
      targets: [
        { needCategory: 'Literacy', metricKey: 'Extended writing output (words)', baselineValue: '120', targetValue: '300', measurementWindow: '6 months' },
        { needCategory: 'Literacy', metricKey: 'Reading comprehension accuracy (%)', baselineValue: '55', targetValue: '75', measurementWindow: '6 months' },
        { needCategory: 'Processing', metricKey: 'Processing speed (RAN test, secs)', baselineValue: '72', targetValue: '55', measurementWindow: '12 months' },
      ],
      strategies: [
        { strategyText: 'Provide writing frames and paragraph scaffolds for all extended tasks', appliesTo: 'BOTH' },
        { strategyText: 'Allow use of laptop for all writing tasks (school-issued device)', appliesTo: 'BOTH' },
        { strategyText: '25% extra time plus rest breaks in assessments (EHCP provision)', appliesTo: 'BOTH' },
        { strategyText: 'Provide pre-reading materials 24 hours in advance', appliesTo: 'HOMEWORK' },
        { strategyText: 'Use visual timers during timed activities', appliesTo: 'CLASSROOM' },
        { strategyText: 'Check understanding verbally before independent work', appliesTo: 'CLASSROOM' },
      ],
    },
    // Aaron Walsh — SEN Support, SEMH — review in 7 days (urgent)
    {
      id: 'demo-plan-d-walsh',
      studentId: aaronWalsh.id,
      status: PlanStatus.ACTIVE_INTERNAL,
      reviewDate: daysFromNow(7),
      activatedAt: daysAgo(90),
      targets: [
        { needCategory: 'Social, Emotional & Mental Health', metricKey: 'Lesson attendance (%)', baselineValue: '62', targetValue: '85', measurementWindow: '6 months' },
        { needCategory: 'Social, Emotional & Mental Health', metricKey: 'Homework submitted per term', baselineValue: '2', targetValue: '6', measurementWindow: '3 months' },
      ],
      strategies: [
        { strategyText: 'Pastoral check-in every Monday morning — flag any concerns to form tutor', appliesTo: 'CLASSROOM' },
        { strategyText: 'Flexible homework deadlines with 48-hour extension available on request', appliesTo: 'HOMEWORK' },
        { strategyText: 'Preferential seating near the teacher', appliesTo: 'CLASSROOM' },
        { strategyText: 'Celebrate small wins — verbal praise for homework completion', appliesTo: 'BOTH' },
      ],
    },
    // Caitlin Fox — EHCP, C&I — OVERDUE by 10 days
    {
      id: 'demo-plan-d-fox',
      studentId: caitlinFox.id,
      status: PlanStatus.ACTIVE_PARENT_SHARED,
      reviewDate: daysAgo(10),
      activatedAt: daysAgo(365),
      targets: [
        { needCategory: 'Communication & Interaction', metricKey: 'Verbal contributions per lesson', baselineValue: '0–1', targetValue: '3–4', measurementWindow: '6 months' },
        { needCategory: 'Communication & Interaction', metricKey: 'Social communication rating (1–5)', baselineValue: '2', targetValue: '4', measurementWindow: '12 months' },
        { needCategory: 'Literacy', metricKey: 'Independent writing (paragraphs)', baselineValue: '1', targetValue: '3', measurementWindow: '6 months' },
      ],
      strategies: [
        { strategyText: 'Allow processing/thinking time before expecting a verbal response (min. 20 seconds)', appliesTo: 'CLASSROOM' },
        { strategyText: 'Use structured paired talk before whole-class discussion', appliesTo: 'CLASSROOM' },
        { strategyText: 'Provide sentence starters and writing frames for all tasks', appliesTo: 'BOTH' },
        { strategyText: 'Pre-warn Caitlin before she will be asked to contribute', appliesTo: 'CLASSROOM' },
        { strategyText: 'Accept written responses as an alternative to verbal where appropriate', appliesTo: 'BOTH' },
        { strategyText: 'All homework tasks must include a visual example/model answer', appliesTo: 'HOMEWORK' },
      ],
    },
    // Michael Torres — SEN Support, Cognition & Learning — review in 21 days
    {
      id: 'demo-plan-d-torres',
      studentId: michaelT.id,
      status: PlanStatus.ACTIVE_INTERNAL,
      reviewDate: daysFromNow(21),
      activatedAt: daysAgo(45),
      targets: [
        { needCategory: 'Cognition & Learning', metricKey: 'Working memory tasks completed accurately (%)', baselineValue: '40', targetValue: '65', measurementWindow: '6 months' },
        { needCategory: 'Cognition & Learning', metricKey: 'Independent note-taking quality (1–5 rubric)', baselineValue: '2', targetValue: '4', measurementWindow: '6 months' },
      ],
      strategies: [
        { strategyText: 'Provide graphic organisers and structured note-taking templates', appliesTo: 'BOTH' },
        { strategyText: 'Record verbal instructions and share link with student after lesson', appliesTo: 'HOMEWORK' },
        { strategyText: 'Chunk tasks into short steps with visual checklist', appliesTo: 'BOTH' },
        { strategyText: 'Reduce written copying — provide printed copies of board notes', appliesTo: 'CLASSROOM' },
      ],
    },
    // Tyler Nash — SEN Support, SEMH — Maths — review in 30 days
    {
      id: 'demo-plan-d-nash',
      studentId: tylerNash.id,
      status: PlanStatus.ACTIVE_INTERNAL,
      reviewDate: daysFromNow(30),
      activatedAt: daysAgo(20),
      targets: [
        { needCategory: 'Social, Emotional & Mental Health', metricKey: 'Maths homework completion rate (%)', baselineValue: '25', targetValue: '60', measurementWindow: '3 months' },
        { needCategory: 'Social, Emotional & Mental Health', metricKey: 'Classroom anxiety level (1–5 self-report)', baselineValue: '4', targetValue: '2', measurementWindow: '6 months' },
      ],
      strategies: [
        { strategyText: 'Offer a "no hands up" environment — approach Tyler directly if needed', appliesTo: 'CLASSROOM' },
        { strategyText: 'Provide maths homework with worked examples included', appliesTo: 'HOMEWORK' },
        { strategyText: 'Access to a times table reference card in all lessons and assessments', appliesTo: 'BOTH' },
      ],
    },
    // Layla Hassan — SEN Support, SpLD — Maths — review in 60 days
    {
      id: 'demo-plan-d-hassan',
      studentId: laylaHassan.id,
      status: PlanStatus.ACTIVE_PARENT_SHARED,
      reviewDate: daysFromNow(60),
      activatedAt: daysAgo(14),
      targets: [
        { needCategory: 'Literacy', metricKey: 'Maths vocabulary recognition (%)', baselineValue: '50', targetValue: '80', measurementWindow: '6 months' },
        { needCategory: 'Literacy', metricKey: 'Reading speed (words per min)', baselineValue: '90', targetValue: '130', measurementWindow: '6 months' },
      ],
      strategies: [
        { strategyText: 'Provide maths keyword glossary at the start of each unit', appliesTo: 'BOTH' },
        { strategyText: '25% extra time for assessments', appliesTo: 'BOTH' },
        { strategyText: 'Coloured overlays available on request', appliesTo: 'CLASSROOM' },
      ],
    },
  ]

  for (const p of plans) {
    const plan = await prisma.plan.upsert({
      where:  { id: p.id },
      update: { status: p.status, reviewDate: p.reviewDate },
      create: {
        id: p.id, schoolId: school.id, studentId: p.studentId,
        status: p.status, reviewDate: p.reviewDate,
        activatedById: senco.id, activatedAt: p.activatedAt,
        ...(p.status === PlanStatus.ACTIVE_PARENT_SHARED
          ? { parentSharedById: senco.id, parentSharedAt: p.activatedAt }
          : {}),
      },
    })
    for (const [i, t] of p.targets.entries()) {
      await prisma.planTarget.upsert({
        where:  { id: `${p.id}-tgt-${i}` },
        update: {},
        create: { id: `${p.id}-tgt-${i}`, planId: plan.id, ...t },
      })
    }
    for (const [i, s] of p.strategies.entries()) {
      await prisma.planStrategy.upsert({
        where:  { id: `${p.id}-str-${i}` },
        update: {},
        create: { id: `${p.id}-str-${i}`, planId: plan.id, strategyText: s.strategyText, appliesTo: s.appliesTo },
      })
    }
  }
  console.log('  ✓ 8 ILP plans (2 EHCP shared with parents, 2 overdue reviews)')

  // ── SendStatusReview records ───────────────────────────────────────────────
  const reviewCases = [
    { id: 'demo-d-rev-fox',      studentId: caitlinFox.id,   status: SendStatusValue.EHCP,        notes: 'Annual review overdue — EHCP renewal required. Contact LA.' },
    { id: 'demo-d-rev-ferretti', studentId: rosaFerretti.id, status: SendStatusValue.EHCP,        notes: 'EHCP review overdue — schedule meeting with parents and SENCO.' },
    { id: 'demo-d-rev-walsh',    studentId: aaronWalsh.id,   status: SendStatusValue.SEN_SUPPORT, notes: 'Pastoral concern raised by form tutor — review SEMH support package.' },
    { id: 'demo-d-rev-bell',     studentId: marcusBell.id,   status: SendStatusValue.SEN_SUPPORT, notes: 'Review approaching — assess progress against homework completion target.' },
  ]
  for (const r of reviewCases) {
    await prisma.sendStatusReview.upsert({
      where:  { id: r.id },
      update: {},
      create: { id: r.id, studentId: r.studentId, incomingStatus: r.status, status: 'PENDING', notes: r.notes },
    })
  }
  console.log('  ✓ 4 SEND review records (2 overdue, 2 approaching)')

  // ── Homework: add more to existing + new published ones ───────────────────

  // Look up existing homework
  const hwAic     = await prisma.homework.findUnique({ where: { id: 'demo-hw-aic-1'       } })
  const hwMacbeth = await prisma.homework.findUnique({ where: { id: 'demo-hw-macbeth-1'   } })

  // New Year-11 homework (published)
  const hw11 = await prisma.homework.upsert({
    where:  { id: 'demo-d-hw-11-romeo' },
    update: {},
    create: {
      id: 'demo-d-hw-11-romeo', schoolId: school.id, classId: cls11.id,
      title: 'Romeo & Juliet — How does Shakespeare present conflict?',
      instructions: 'Write two paragraphs analysing how Shakespeare presents conflict in Act 3 Scene 1. Use PEE structure and refer to at least two quotations. Consider language, structure and context.',
      modelAnswer: 'Shakespeare presents conflict as explosive and inevitable through the rapid escalation of violence in Act 3 Scene 1. When Tybalt challenges Romeo ("Romeo, the love I bear thee can afford / No better term than this: thou art a villain"), Shakespeare uses direct address and a formal challenge to show how honour culture forces conflict even when Romeo wishes to avoid it. The plosive alliteration in "Romeo, the love" ironically precedes an act of hatred, highlighting the contradiction at the heart of Verona\'s feud.\n\nFurthermore, Mercutio\'s death scene is structured to maximise dramatic irony and tragic inevitability. Romeo\'s cry "O, I am fortune\'s fool!" marks the moment he recognises he is powerless against fate, and the short exclamatory sentence reflects the shock of this realisation. The repetition of death imagery throughout the scene — "a grave man", "thy beauty hath made me effeminate" — foreshadows the tragedy to come, suggesting that conflict is not just physical but is woven into the very language of the play.',
      gradingBands: { '8-9': 'Detailed, perceptive analysis with sophisticated vocabulary and control.', '6-7': 'Clear analysis with subject terminology and developed ideas.', '4-5': 'Some analysis with relevant quotations and basic terminology.', '1-3': 'Descriptive response with limited quotations.' },
      dueAt: daysFromNow(4), status: HomeworkStatus.PUBLISHED,
      type: HomeworkType.EXTENDED_WRITING, releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts: 1, createdBy: created['j.patel'].id,
    },
  })

  // New Year-10 Maths homework
  const hwMaths10 = await prisma.homework.upsert({
    where:  { id: 'demo-d-hw-10-algebra' },
    update: {},
    create: {
      id: 'demo-d-hw-10-algebra', schoolId: school.id, classId: cls10Ma.id,
      title: 'Algebra — Solving Linear Equations',
      instructions: 'Solve the following equations, showing all working:\n1. 3x + 7 = 22\n2. 5x − 3 = 2x + 9\n3. 2(x + 4) = 18\n4. (x + 3)/2 = 7\n5. 4(2x − 1) = 3x + 11\n\nFor each equation, write a sentence explaining what operation you used at each step.',
      modelAnswer: '1. 3x+7=22 → 3x=15 → x=5\n2. 5x−3=2x+9 → 3x=12 → x=4\n3. 2(x+4)=18 → x+4=9 → x=5\n4. (x+3)/2=7 → x+3=14 → x=11\n5. 4(2x−1)=3x+11 → 8x−4=3x+11 → 5x=15 → x=3',
      gradingBands: { '5': 'All correct with clear working and full explanations.', '4': 'All correct with working but explanations incomplete.', '3': 'Q1–3 correct, minor errors in Q4–5.', '2': 'Q1–2 correct, significant errors thereafter.', '1': 'Attempts made with some correct steps.' },
      dueAt: daysFromNow(5), status: HomeworkStatus.PUBLISHED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 2, createdBy: kwrightD.id,
    },
  })

  console.log('  ✓ 2 new homework assignments (Yr11 Romeo & Juliet, Yr10 Maths Algebra)')

  // ── Bulk submissions ──────────────────────────────────────────────────────
  type SubInput = {
    hwId: string; studentId: string; content: string
    status: SubmissionStatus; score?: number; grade?: string
    feedback?: string; tags?: string[]; daysAgoSub?: number
  }

  async function upsertSub(s: SubInput) {
    const hw = await prisma.homework.findUniqueOrThrow({ where: { id: s.hwId } })
    const unique = { homeworkId: hw.id, studentId: s.studentId }
    // markedAt must always be AFTER submittedAt — set to 1 day after submission
    const submittedAt = daysAgo(s.daysAgoSub ?? 2)
    const markedAt    = s.status === SubmissionStatus.RETURNED
      ? new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000)
      : undefined
    await prisma.submission.upsert({
      where:  { homeworkId_studentId: unique },
      // Also update markedAt on existing records to fix any previously bad seed dates
      update: s.status === SubmissionStatus.RETURNED ? { markedAt } : {},
      create: {
        schoolId: school.id, homeworkId: hw.id, studentId: s.studentId,
        content: s.content,
        status: s.status,
        submittedAt,
        markedAt,
        finalScore: s.score,
        teacherScore: s.score,
        grade: s.grade,
        feedback: s.feedback,
        misconceptionTags: s.tags ?? [],
        integrityReviewed: s.status === SubmissionStatus.RETURNED,
      },
    })
  }

  if (hwAic) {
    // AIC Context Research — 9E/En1
    const cls9Students = await prisma.enrolment.findMany({
      where: { classId: cls9.id }, include: { user: true },
    })
    const aicSubs: SubInput[] = [
      { hwId: hwAic.id, studentId: (cls9Students.find(e=>e.user.email==='t.cooper@students.omnisdemo.school')!).userId,
        content: 'The play was written in 1945 and is set in 1912. Priestly was a socialist and used the play to criticise capitalist attitudes. The Birlings represent the upper classes who were selfish and ignored the poor.',
        status: SubmissionStatus.RETURNED, score: 6, grade: '6',
        feedback: 'Good understanding of context, Tyler. You have identified the time period and Priestley\'s political motivation clearly. To improve, develop your analysis of how Priestley uses the Birlings specifically — what does each character symbolise?',
        tags: ['context_not_linked_to_character'] },
      { hwId: hwAic.id, studentId: (cls9Students.find(e=>e.user.email==='a.osei@students.omnisdemo.school')!).userId,
        content: 'Priestley wrote An Inspector Calls in 1945 but set it in 1912 to highlight how little had changed in society despite two world wars. He was a socialist who believed in collective responsibility. The play critiques capitalism by showing how the Birlings\' selfish attitudes contributed to Eva Smith\'s death.',
        status: SubmissionStatus.RETURNED, score: 8, grade: '8',
        feedback: 'Excellent, Amara. You have linked the historical context to the play\'s message very effectively. The phrase "despite two world wars" is particularly insightful. For a 9, explore the specific political climate of 1945 post-war Britain and how audiences would have responded differently to the Birlings.',
        tags: [] },
      { hwId: hwAic.id, studentId: (cls9Students.find(e=>e.user.email==='f.jenkins@students.omnisdemo.school')!).userId,
        content: 'An Inspector Calls was written to show people that they should care about each other. Priestley sets it in 1912 before WW1 so we know that the Birlings are wrong about everything. The Inspector represents Priestley\'s own views about society.',
        status: SubmissionStatus.RETURNED, score: 5, grade: '5',
        feedback: 'Good start, Freya. You are right that the Inspector represents Priestley\'s views — develop this by explaining what exactly those views were (socialist, collective responsibility). Avoid vague phrases like "wrong about everything"; be specific about which predictions Mr Birling gets wrong.',
        tags: ['vague_contextual_reference'] },
      { hwId: hwAic.id, studentId: (cls9Students.find(e=>e.user.email==='r.sharma@students.omnisdemo.school')!).userId,
        content: 'The play is about 1912 but written in 1945. Priestley wanted to warn people not to be like the Birlings who are greedy. The Inspector is like a ghost or time traveller. Eva Smith is a symbol of working class people.',
        status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
      { hwId: hwAic.id, studentId: (cls9Students.find(e=>e.user.email==='b.walsh@students.omnisdemo.school')!).userId,
        content: 'Priestley uses the Birlings to represent everything wrong with capitalist Britain. By setting the play in 1912, he is warning 1945 audiences not to return to the old class divisions after the war. Eva Smith represents all the women who were exploited by the wealthy.',
        status: SubmissionStatus.RETURNED, score: 7, grade: '7',
        feedback: 'Very good, Bella. Strong contextual links here. Your comment about 1945 audiences is perceptive. To push to 8–9, you need to explore specific language used by characters and link it to Priestley\'s message.',
        tags: [] },
      { hwId: hwAic.id, studentId: sophieChen.id,
        content: 'Priestley wrote the play after the war to show that things had to change. The Birling family are rich and dont care about poor people. Eva Smith is a working class girl who they all treat badly. Priestley thinks we should all take responsibility.',
        status: SubmissionStatus.RETURNED, score: 4, grade: '4',
        feedback: 'Sophie, you have understood the key message about responsibility — well done for identifying that. Your writing shows some good ideas. To improve, try to use specific details about the historical context (when was the play written, when is it set, and why does that gap matter?). A writing frame is available in the lesson folder to help you structure your analysis.',
        tags: ['limited_contextual_detail', 'no_quotation_reference'] },
      { hwId: hwAic.id, studentId: kieranMurphy.id,
        content: 'The play is set in 1912 but written in 1945 just after the Second World War. Priestley uses this gap in time deliberately — he wanted audiences to see that the selfish attitudes of the Birlings had not changed despite the suffering of two world wars. As a socialist, Priestley believed in collective responsibility, which is embodied by the Inspector.',
        status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
      // Marcus Bell — SEMH, expected missing — add SUBMITTED (overdue student finally submitted)
      { hwId: hwAic.id, studentId: marcusBell.id,
        content: 'Priestley wrote the play in 1945. The Birlings are a posh family. The Inspector asks about Eva Smith.',
        status: SubmissionStatus.SUBMITTED, daysAgoSub: 0 },
    ]
    for (const sub of aicSubs) await upsertSub(sub)
    console.log('  ✓ AIC homework: 8 submissions added for 9E/En1')
  }

  if (hwMacbeth) {
    // Macbeth Essay Plan — 10E/En2
    const cls10Students = await prisma.enrolment.findMany({
      where: { classId: cls10.id }, include: { user: true },
    })
    const macSubs: SubInput[] = [
      { hwId: hwMacbeth.id, studentId: (cls10Students.find(e=>e.user.email==='o.thompson@students.omnisdemo.school')!).userId,
        content: 'Intro: Macbeth is driven by ambition and Lady Macbeth\'s manipulation. P1: "I have no spur to prick the sides of my intent, but only vaulting ambition" — shows Macbeth knows he is driven purely by ambition, not by moral right. P2: Lady Macbeth calls him "too full o\' the milk of human kindness" suggesting she must push him further. P3: After the murder, ambition curdles into tyranny — Duncan\'s murder leads to Banquo\'s and then Macduff\'s family.',
        status: SubmissionStatus.RETURNED, score: 8, grade: '8',
        feedback: 'Oliver, this is an excellent, well-structured plan. Your quotation analysis is perceptive and the progression from ambition to tyranny shows sophisticated thinking. For a 9, explore how Shakespeare uses structural irony — Macbeth\'s downfall is implicit from the witches\' prophecy from the start.', tags: [] },
      { hwId: hwMacbeth.id, studentId: (cls10Students.find(e=>e.user.email==='c.williams@students.omnisdemo.school')!).userId,
        content: 'I will write about how ambition causes Macbeth to do bad things. First point: the witches make Macbeth want to be king. Quote: "All hail, Macbeth, that shalt be king hereafter". Second point: Lady Macbeth makes him kill Duncan. Third point: after he is king he becomes cruel.',
        status: SubmissionStatus.RETURNED, score: 5, grade: '5',
        feedback: 'Chloe, your plan covers the key events, which is a solid start. To improve the quality of your analysis, you need to do more than summarise what happens — explain HOW the language shows ambition. For example, "All hail" has regal, ceremonial connotations; Shakespeare suggests the witches are crowning Macbeth even before he acts. Try to develop one of your points with this level of language analysis.',
        tags: ['summary_not_analysis', 'quotation_not_analysed'] },
      { hwId: hwMacbeth.id, studentId: (cls10Students.find(e=>e.user.email==='j.brown@students.omnisdemo.school')!).userId,
        content: 'Plan: ambition is the main theme. Lady Macbeth convinces Macbeth. He kills Duncan then Banquo.',
        status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
      { hwId: hwMacbeth.id, studentId: (cls10Students.find(e=>e.user.email==='e.davies@students.omnisdemo.school')!).userId,
        content: 'Shakespeare presents Macbeth\'s ambition as a fatal flaw that he initially attempts to resist. The metaphor "vaulting ambition which o\'erleaps itself" suggests something that goes too far and inevitably collapses, foreshadowing his downfall. However, I will also argue that ambition alone is insufficient — it is combined with Lady Macbeth\'s manipulation and the witches\' prophecy to create the fatal chain of events.',
        status: SubmissionStatus.RETURNED, score: 8, grade: '8',
        feedback: 'Excellent analytical thinking, Emma. The phrase "fatal flaw" shows you understand the tragic structure, and your metaphor analysis is well developed. Ensure your plan has 3 clear, separate paragraphs — from your submission it is slightly unclear where each paragraph starts.', tags: [] },
      { hwId: hwMacbeth.id, studentId: (cls10Students.find(e=>e.user.email==='l.ahmed@students.omnisdemo.school')!).userId,
        content: 'Macbeth is ambitious because of the witches. Lady Macbeth helps him. In the end ambition destroys him.',
        status: SubmissionStatus.SUBMITTED, daysAgoSub: 2 },
      { hwId: hwMacbeth.id, studentId: (cls10Students.find(e=>e.user.email==='z.king@students.omnisdemo.school')!).userId,
        content: 'Introduction: Shakespeare shows ambition as a destructive force. Point 1: the witches ignite Macbeth\'s ambition — "All hail, Macbeth, that shalt be king hereafter" — the future tense creates inevitability. Point 2: Lady Macbeth manipulates Macbeth by attacking his masculinity — "unsex me here". Point 3: Once king, ambition becomes paranoia — Macbeth orders Banquo\'s murder because he fears losing power.',
        status: SubmissionStatus.RETURNED, score: 7, grade: '7',
        feedback: 'Really good plan, Zara. I particularly liked your observation about the future tense in the prophecy. For 8–9, develop Point 2 further — Lady Macbeth\'s language of gender and power is very rich for analysis.', tags: [] },
      { hwId: hwMacbeth.id, studentId: naomiClarke.id,
        content: 'My plan: 1. Macbeth wants power so much he kills the king. 2. Lady Macbeth is even more ambitious at first. 3. Ambition turns into fear and then madness.',
        status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
      { hwId: hwMacbeth.id, studentId: danielMwangi.id,
        content: 'Intro: Macbeth\'s ambition is tied to his vulnerability to external pressure — the witches and Lady Macbeth exploit an existing desire. P1: "Stars, hide your fires, let not light see my black and deep desires" — Shakespeare uses imperative voice to show Macbeth is actively trying to suppress his conscience, suggesting his moral self still exists even as ambition grows. P2: The regicide is presented as a point of no return — "I am in blood / Stepp\'d in so far" signals that ambition has become irreversible. P3: Ultimately ambition produces not satisfaction but paranoia.',
        status: SubmissionStatus.RETURNED, score: 9, grade: '9',
        feedback: 'Exceptional planning, Daniel. The insight about Macbeth suppressing his conscience rather than lacking one entirely is genuinely perceptive and shows A-grade thinking. Your quotation from Act 3 is equally well chosen. This is a 9/9 plan.', tags: [] },
      { hwId: hwMacbeth.id, studentId: rosaFerretti.id,
        content: 'Macbeth wants to be king and Lady Macbeth makes him do it. The quote is "I have done the deed". Ambition is bad in the play.',
        status: SubmissionStatus.RETURNED, score: 3, grade: '3',
        feedback: 'Rosa, I can see you understand the basic story of Macbeth\'s ambition. Your quotation is from the right part of the play but try to find one that shows his ambition BEFORE the murder, not after. I have attached the writing frame and paragraph scaffold from the lesson — please use these to restructure your response. Your EHCP provision (extra time + writing frame) is always available.', tags: ['wrong_quotation', 'summary_not_analysis'] },
      // Aaron Walsh — SEMH, missing
    ]
    for (const sub of macSubs) await upsertSub(sub)
    console.log('  ✓ Macbeth homework: 9 submissions added for 10E/En2')
  }

  // Year 11 — Romeo & Juliet submissions
  const cls11Students = await prisma.enrolment.findMany({
    where: { classId: cls11.id }, include: { user: true },
  })
  const romeoCont: SubInput[] = [
    { hwId: hw11.id, studentId: (cls11Students.find(e=>e.user.email==='g.wilson@students.omnisdemo.school')!).userId,
      content: 'Shakespeare presents conflict as central to the play\'s tragedy through the structural positioning of Act 3 Scene 1. When Mercutio dies crying "A plague on both your houses!", the tricolon structure of the curse emphasises the senseless destruction caused by the feud. The word "plague" has Biblical connotations of divine punishment, suggesting that the conflict is not merely human but cosmic in its consequences.\n\nFurthermore, Romeo\'s realisation "O I am fortune\'s fool!" positions him as a victim of fate rather than a free agent, which is central to Shakespeare\'s argument about how conflict corrupts individual agency.',
      status: SubmissionStatus.RETURNED, score: 9, grade: '9',
      feedback: 'Grace, this is exceptional work. The biblical connotations of "plague" and your structural comment about Act 3 Scene 1 show a genuinely sophisticated understanding of Shakespeare\'s craft. Outstanding.', tags: [] },
    { hwId: hw11.id, studentId: (cls11Students.find(e=>e.user.email==='j.robinson@students.omnisdemo.school')!).userId,
      content: 'Shakespeare presents conflict as inevitable through the opening prologue. The phrase "star-crossed lovers" uses astrological imagery to show the audience from the start that the conflict cannot be avoided. In Act 3 Scene 1, Tybalt\'s challenge to Romeo shows that honour culture makes conflict unavoidable.',
      status: SubmissionStatus.RETURNED, score: 6, grade: '6',
      feedback: 'Jack, your point about the prologue is well chosen. For 7–8, you need to engage more closely with the language — WHY does astrological imagery suggest inevitability? What does Shakespeare suggest about human choice vs fate? Develop this further.', tags: ['quotation_not_fully_analysed'] },
    { hwId: hw11.id, studentId: (cls11Students.find(e=>e.user.email==='i.moore@students.omnisdemo.school')!).userId,
      content: 'Shakespeare shows conflict using Romeo and Tybalt. Romeo tries to make peace but Tybalt wont let him. This shows conflict is forced on people by society. The quote "O calm, dishonourable, vile submission!" shows Mercutio thinks avoiding a fight is shameful.',
      status: SubmissionStatus.RETURNED, score: 5, grade: '5',
      feedback: 'Good start, Isabella. Your quotation is well chosen. Develop your analysis of the word "dishonourable" — what does this reveal about 16th-century attitudes to masculinity and how does Shakespeare critique this?', tags: ['quotation_not_analysed'] },
    { hwId: hw11.id, studentId: (cls11Students.find(e=>e.user.email==='e.clarke@students.omnisdemo.school')!).userId,
      content: 'Conflict in the play is presented through language and structure. Shakespeare uses oxymorons like "loving hate" in Act 1 to show that love and conflict are intertwined. In Act 3 Tybalt kills Mercutio, which forces Romeo to abandon love and return to conflict — showing how family honour overrides personal choice.',
      status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
    { hwId: hw11.id, studentId: (cls11Students.find(e=>e.user.email==='p.taylor@students.omnisdemo.school')!).userId,
      content: 'Shakespeare presents conflict as destructive. Many characters die because of the feud. Mercutio says "A plague on both your houses" which shows he blames both families. Romeo kills Tybalt then gets banished.',
      status: SubmissionStatus.RETURNED, score: 4, grade: '4',
      feedback: 'Poppy, your summary of events is accurate. To improve, focus on HOW Shakespeare presents conflict, not just what happens. Choose one quotation and analyse the language in it — what specific words or techniques show conflict?', tags: ['narrative_not_analysis'] },
    { hwId: hw11.id, studentId: (cls11Students.find(e=>e.user.email==='n.martin@students.omnisdemo.school')!).userId,
      content: 'I will argue that Shakespeare presents conflict as both a social construct and a personal failing. The feud is presented as absurd from the opening scene — the servants of both houses quarrel over trivial honour codes. By Act 3, the feud has claimed Mercutio, Tybalt and will ultimately claim Romeo and Juliet — suggesting that inherited conflict destroys everyone, including the innocent.',
      status: SubmissionStatus.RETURNED, score: 8, grade: '8',
      feedback: 'Excellent, Noah. The observation that the conflict claims "the innocent" is perceptive. Your contextual point about honour codes is strong. For 9, engage with specific language — choose the most striking word in a key quotation and analyse it in depth.', tags: [] },
    { hwId: hw11.id, studentId: anyaPatel.id,
      content: 'Conflict in Romeo and Juliet is central to everything. Act 3 Scene 1 is the turning point. Tybalt kills Mercutio and Romeo kills Tybalt. This changes everything.',
      status: SubmissionStatus.SUBMITTED, daysAgoSub: 2 },
    { hwId: hw11.id, studentId: benHartley.id,
      content: 'Shakespeare uses the feud between Montagues and Capulets to show that conflict is pointless. Nobody can even remember why it started. In Act 3 "A plague on both your houses" from Mercutio — dying because of a feud he wasn\'t even directly part of — shows that bystanders suffer most from conflict.',
      status: SubmissionStatus.RETURNED, score: 7, grade: '7',
      feedback: 'Ben, the observation that Mercutio is a bystander who suffers is very strong — you\'ve identified something about the injustice of the feud. Develop this with closer language analysis and you\'ll reach 8–9.', tags: [] },
    { hwId: hw11.id, studentId: caitlinFox.id,
      content: 'Conflict is shown in the play when people fight. Romeo and Tybalt fight. Mercutio dies. Shakespeare wants us to see that fighting is wrong.',
      status: SubmissionStatus.RETURNED, score: 3, grade: '3',
      feedback: 'Caitlin, I can see the core idea here — you understand that Shakespeare is criticising the violence. Let\'s work on developing this together. I am going to give you the sentence starter worksheet from Monday\'s lesson — use it to rebuild one of your points with a quotation and an analysis sentence. Your ILP strategies are in place to support you.', tags: ['underdeveloped_analysis'] },
    { hwId: hw11.id, studentId: michaelT.id,
      content: 'Shakespeare presents conflict as inevitable because of the city context of Verona. Public spaces force characters together. Quote: "What, drawn and talk of peace? I hate the word / As I hate hell, all Montagues and thee" — Tybalt\'s use of "hate" three times (anaphora) shows obsessive, irrational hatred that cannot be reasoned with.',
      status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
  ]
  for (const sub of romeoCont) await upsertSub(sub)
  console.log('  ✓ Romeo & Juliet homework: 10 submissions added for 11E/En1')

  // Year 10 Maths — Algebra submissions
  const cls10MaStudents = await prisma.enrolment.findMany({
    where: { classId: cls10Ma.id }, include: { user: true },
  })
  const algebraSubs: SubInput[] = [
    { hwId: hwMaths10.id, studentId: rubyPham.id,
      content: '1. 3x+7=22 → 3x=15 → x=5 (subtract 7, divide by 3)\n2. 5x−3=2x+9 → 3x=12 → x=4 (collect x terms, then divide)\n3. 2(x+4)=18 → x+4=9 → x=5 (divide by 2, subtract 4)\n4. (x+3)/2=7 → x+3=14 → x=11 (multiply by 2, subtract 3)\n5. 4(2x−1)=3x+11 → 8x−4=3x+11 → 5x=15 → x=3 (expand bracket, collect terms)',
      status: SubmissionStatus.RETURNED, score: 5, grade: '5',
      feedback: 'Full marks Ruby — excellent clear working throughout with every step explained. Well done.', tags: [] },
    { hwId: hwMaths10.id, studentId: tylerNash.id,
      content: '1. x=5\n2. x=4\n3. x=5',
      status: SubmissionStatus.RETURNED, score: 2, grade: '2',
      feedback: 'Tyler, I can see you got Q1–3 correct — well done. For Q4 and Q5, write out each step clearly. The method card we used in Tuesday\'s lesson is attached to this homework — use it to show your working for the remaining questions.', tags: ['working_not_shown', 'incomplete'] },
    { hwId: hwMaths10.id, studentId: jackOsei.id,
      content: '1. 3x=15, x=5\n2. 3x=12, x=4\n3. x+4=9, x=5\n4. x+3=14, x=11\n5. 8x−4=3x+11 → 5x=15 → x=3',
      status: SubmissionStatus.RETURNED, score: 4, grade: '4',
      feedback: 'Good work, Jack — all answers correct with working shown. Q5 is well done. For full marks, add a sentence explaining the operation at each step as the task asks.', tags: ['explanation_missing'] },
    { hwId: hwMaths10.id, studentId: imogenHart.id,
      content: '1. 3x+7=22: subtract 7 from both sides: 3x=15, divide by 3: x=5\n2. 5x−3=2x+9: subtract 2x: 3x−3=9, add 3: 3x=12, divide: x=4\n3. 2(x+4)=18: expand: 2x+8=18, subtract 8: 2x=10, divide: x=5\n4. Multiply both sides by 2: x+3=14, subtract 3: x=11\n5. Expand: 8x−4=3x+11, subtract 3x: 5x−4=11, add 4: 5x=15, divide: x=3',
      status: SubmissionStatus.RETURNED, score: 5, grade: '5',
      feedback: 'Perfect, Imogen. Every step is clearly explained and all answers are correct. Excellent work.', tags: [] },
    { hwId: hwMaths10.id, studentId: davidKim.id,
      content: '1. x=5\n2. x=4\n3. x=5\n4. x=11\n5. x=3\nI divided or subtracted to solve each one.',
      status: SubmissionStatus.RETURNED, score: 3, grade: '3',
      feedback: 'David, all your answers are correct which is impressive! However, the task asks you to show ALL working and explain each step separately. Without this I can\'t award full marks. Please resubmit with step-by-step working for each equation.', tags: ['working_not_shown'] },
    { hwId: hwMaths10.id, studentId: laylaHassan.id,
      content: '1. 3x+7=22 take away 7 = 15 then 15÷3 = 5\n2. 5x-3=2x+9 take away 2x both sides = 3x-3=9 then +3 both sides = 3x=12 then ÷3 = 4\n3. 2 times x+4=18 so x+4=9 so x=5',
      status: SubmissionStatus.RETURNED, score: 2, grade: '2',
      feedback: 'Layla, good clear explanations for Q1–3, you are on the right track. Don\'t forget to attempt Q4 and Q5 — the keyword glossary and worked examples are on the class sheet. Use the extra 25% time that\'s available to you and take your time.', tags: ['incomplete'] },
    { hwId: hwMaths10.id, studentId: connorWebb.id,
      content: '1. x=5 ✓\n2. x=4 ✓\n3. x=5 ✓\n4. x=11 ✓\n5. First expand the brackets: 8x-4=3x+11. Then move 3x: 5x=15. Answer: x=3',
      status: SubmissionStatus.SUBMITTED, daysAgoSub: 1 },
    { hwId: hwMaths10.id, studentId: nadiaP.id,
      content: '1. subtract 7: 3x=15, divide 3: x=5\n2. collect x: 3x-3=9, add 3: 3x=12, x=4\n3. divide 2: x+4=9, subtract 4: x=5\n4. multiply 2: x+3=14, subtract 3: x=11\n5. expand: 8x-4=3x+11, collect: 5x=15, x=3',
      status: SubmissionStatus.RETURNED, score: 4, grade: '4',
      feedback: 'Great working shown, Nadia. All correct! For full marks write one explanatory sentence per step rather than just the operation — e.g. "I subtract 7 from both sides to isolate the x term."', tags: ['explanation_missing'] },
  ]
  for (const sub of algebraSubs) await upsertSub(sub)
  console.log('  ✓ Algebra homework: 8 submissions added for 10M/Ma1')

  // ── Parent conversations with messages ────────────────────────────────────
  const lauraHughes = await prisma.user.findUniqueOrThrow({ where: { email: 'l.hughes@parents.omnisdemo.school' } })
  const aidenHughes = await prisma.user.findUniqueOrThrow({ where: { email: 'a.hughes@students.omnisdemo.school' } })
  const jayPatel    = await prisma.user.findUniqueOrThrow({ where: { email: 'j.patel@omnisdemo.school' } })
  const rachelMorris= await prisma.user.findUniqueOrThrow({ where: { email: 'r.morris@omnisdemo.school' } })

  // Conversation 1: Laura ↔ Jay Patel — Aiden's English progress
  const conv1 = await prisma.parentConversation.upsert({
    where:  { id: 'demo-d-conv-1' },
    update: {},
    create: {
      id: 'demo-d-conv-1', schoolId: school.id,
      teacherId: jayPatel.id, parentId: lauraHughes.id,
      studentId: aidenHughes.id, subjectId: 'English',
      status: 'OPEN', createdAt: daysAgo(14),
    },
  })
  const conv1Messages = [
    { id: 'demo-d-msg-1-1', senderType: 'TEACHER' as const, sentAt: daysAgo(14), content: `Hi Laura, I'm writing to update you on Aiden's progress in English this term.\n\nAiden submitted his An Inspector Calls context research last week and scored 7/9 — a strong result that shows he has a solid understanding of Priestley's intentions and the historical context. He's engaging well in class discussions too.\n\nI wanted to flag that his ILP strategies are working well — in particular, the writing frame approach has helped him structure his arguments more clearly. He is making real progress.\n\nPlease let me know if you have any questions or if there is anything you'd like to discuss.` },
    { id: 'demo-d-msg-1-2', senderType: 'PARENT' as const, sentAt: daysAgo(13), content: `Thank you so much for the update, Mr Patel. It's really reassuring to hear that Aiden is doing well.\n\nWe've been encouraging him to read at home each evening and working on his vocabulary. He's been using his reading overlay which has made a big difference.\n\nIs there anything specific we should be focusing on at home to help him reach the top band?` },
    { id: 'demo-d-msg-1-3', senderType: 'TEACHER' as const, sentAt: daysAgo(12), content: `That's brilliant to hear, Laura — the reading at home is definitely having an impact. To push Aiden toward 8–9, I'd encourage him to practise analysing individual words in quotations rather than just identifying the technique. For example, rather than saying "this is a metaphor", explain what the specific word choice suggests.\n\nI've attached his feedback to his last submission on the system — it has some specific quotations to work with.\n\nWell done to Aiden for the hard work this term.` },
    { id: 'demo-d-msg-1-4', senderType: 'PARENT' as const, sentAt: daysAgo(11), content: `Thank you — we'll look at the feedback together this weekend. He's been talking about the Inspector Calls play a lot at home so I think he's genuinely interested in it. Really appreciate you taking the time to be in touch.` },
    { id: 'demo-d-msg-1-5', senderType: 'TEACHER' as const, sentAt: daysAgo(10), content: `That's great to hear! Enthusiasm makes all the difference. Keep encouraging him — he's on a really positive trajectory.` },
  ]
  for (const m of conv1Messages) {
    await prisma.parentMessage.upsert({
      where:  { id: m.id },
      update: {},
      create: { id: m.id, conversationId: conv1.id, senderType: m.senderType, content: m.content, sentAt: m.sentAt },
    })
  }

  // Conversation 2: Laura ↔ Rachel Morris (SENCO) — ILP review
  const conv2 = await prisma.parentConversation.upsert({
    where:  { id: 'demo-d-conv-2' },
    update: {},
    create: {
      id: 'demo-d-conv-2', schoolId: school.id,
      teacherId: rachelMorris.id, parentId: lauraHughes.id,
      studentId: aidenHughes.id, subjectId: 'SEND',
      status: 'OPEN', createdAt: daysAgo(7),
    },
  })
  const conv2Messages = [
    { id: 'demo-d-msg-2-1', senderType: 'TEACHER' as const, sentAt: daysAgo(7), content: `Hi Laura, this is Rachel Morris, Aiden's SENCo. I wanted to get in touch because Aiden's ILP review is coming up in approximately 30 days.\n\nAt the review, we'll look at his progress against his targets — reading age, written output and on-task duration. His teachers have reported good progress, particularly with the writing frame strategy.\n\nI'd love to hear how things are going from your perspective at home. Are there any areas where you feel Aiden needs additional support?` },
    { id: 'demo-d-msg-2-2', senderType: 'PARENT' as const, sentAt: daysAgo(6), content: `Hi Rachel, thank you for getting in touch. It's really good to have this communication.\n\nAt home, the reading overlay has been really useful — he uses it for everything now. We have noticed that he still finds longer writing tasks quite tiring; he'll often get a good start but then seems to run out of steam after about 20 minutes.\n\nWould it be possible to discuss adding a short break strategy into his plan? Also, is there anything we should be doing specifically to support his reading age progress?` },
    { id: 'demo-d-msg-2-3', senderType: 'TEACHER' as const, sentAt: daysAgo(5), content: `Thank you Laura, that's really helpful feedback. The "running out of steam" pattern is actually very common with SpLD students and suggests his working memory is being taxed.\n\nI'll add a structured break strategy to his ILP ahead of the review — specifically, we'll pilot a "2 paragraphs, then a 3-minute brain break" approach for extended writing both in class and at home.\n\nFor reading age progress: 10 minutes of independent reading aloud at home (using the overlay) each evening is the most evidence-based approach. Even a chapter of any book he enjoys counts.\n\nI'll send you a draft of the updated targets before the formal review so you can comment.` },
    { id: 'demo-d-msg-2-4', senderType: 'PARENT' as const, sentAt: daysAgo(4), content: `That's perfect, thank you Rachel. The structured break approach makes a lot of sense. We'll start the 10 minutes reading aloud tonight.\n\nWe're looking forward to the review — it's really reassuring to know the school is monitoring this so carefully.` },
  ]
  for (const m of conv2Messages) {
    await prisma.parentMessage.upsert({
      where:  { id: m.id },
      update: {},
      create: { id: m.id, conversationId: conv2.id, senderType: m.senderType, content: m.content, sentAt: m.sentAt },
    })
  }
  console.log('  ✓ 2 parent conversations (Jay Patel + Rachel Morris) with message threads')

  // ── Performance aggregates for new classes ────────────────────────────────
  const dTermId = 'term-2025-spring'
  const newAggs = [
    { classId: 'demo-class-7A-eng',  completionRate: 0.78, avgScore: 5.8, predictedDelta: 0.2,  integrityFlagRate: 0.0  },
    { classId: 'demo-class-7B-ma',   completionRate: 0.85, avgScore: 6.2, predictedDelta: 0.3,  integrityFlagRate: 0.0  },
    { classId: 'demo-class-10M-Ma1', completionRate: 0.80, avgScore: 6.5, predictedDelta: 0.1,  integrityFlagRate: 0.01 },
  ]
  for (const a of newAggs) {
    await prisma.classPerformanceAggregate.upsert({
      where:  { classId_termId: { classId: a.classId, termId: dTermId } },
      update: { completionRate: a.completionRate, avgScore: a.avgScore, predictedDelta: a.predictedDelta },
      create: { schoolId: school.id, termId: dTermId, classId: a.classId, completionRate: a.completionRate, avgScore: a.avgScore, predictedDelta: a.predictedDelta, integrityFlagRate: a.integrityFlagRate },
    })
  }
  // Subject medians for Maths
  const mathMedians = [
    { subjectId: 'Maths', yearGroup: 7,  mediansJson: { avgScore: 6.0, completionRate: 0.82, homeworkCount: 6 } },
    { subjectId: 'Maths', yearGroup: 10, mediansJson: { avgScore: 6.3, completionRate: 0.77, homeworkCount: 8 } },
  ]
  for (const m of mathMedians) {
    await prisma.subjectMedianAggregate.upsert({
      where:  { schoolId_subjectId_yearGroup_termId: { schoolId: school.id, subjectId: m.subjectId, yearGroup: m.yearGroup, termId: dTermId } },
      update: { mediansJson: m.mediansJson },
      create: { schoolId: school.id, subjectId: m.subjectId, yearGroup: m.yearGroup, mediansJson: m.mediansJson, termId: dTermId },
    })
  }
  console.log('  ✓ Performance aggregates: 7A/En1, 7B/Ma1, 10M/Ma1 + Maths subject medians')

  // ── Section E: All-subjects classes & cross-subject enrolments ──────────────
  console.log('\n── Section E: All-subjects classes ─────────────────────────────')

  // Additional subject-specialist teachers
  const extraTeachersE = [
    { email: 'p.ahmed@omnisdemo.school',   firstName: 'Priya',   lastName: 'Ahmed',    role: Role.TEACHER },
    { email: 'm.lewis@omnisdemo.school',   firstName: 'Mike',    lastName: 'Lewis',    role: Role.TEACHER },
    { email: 's.chan@omnisdemo.school',     firstName: 'Steven',  lastName: 'Chan',     role: Role.TEACHER },
    { email: 'n.obi@omnisdemo.school',     firstName: 'Ngozi',   lastName: 'Obi',      role: Role.TEACHER },
    { email: 'f.brennan@omnisdemo.school', firstName: 'Fionnuala', lastName: 'Brennan', role: Role.TEACHER },
  ]
  for (const u of extraTeachersE) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: { schoolId: school.id, email: u.email, passwordHash, role: u.role, firstName: u.firstName, lastName: u.lastName },
    })
  }

  const subjectDeptMap: Record<string, string> = {
    English: 'English', Maths: 'Mathematics', Science: 'Science',
    History: 'Humanities', Geography: 'Humanities',
    French: 'Languages', Spanish: 'Languages',
    Art: 'Creative Arts', Music: 'Creative Arts', Drama: 'Creative Arts',
    PE: 'PE', Computing: 'Computing', RE: 'RE', PSHE: 'PSHE',
  }

  // Subject teacher assignments (j.patel covers English; others by department)
  const subjectTeacherEmail: Record<string, string> = {
    English: 'j.patel@omnisdemo.school',    Maths: 'k.wright@omnisdemo.school',
    Science: 'p.ahmed@omnisdemo.school',    History: 'm.lewis@omnisdemo.school',
    Geography: 'm.lewis@omnisdemo.school',  French: 'f.brennan@omnisdemo.school',
    Spanish: 'f.brennan@omnisdemo.school',  Art: 'n.obi@omnisdemo.school',
    Music: 'n.obi@omnisdemo.school',        PE: 's.chan@omnisdemo.school',
    Drama: 'n.obi@omnisdemo.school',        Computing: 's.chan@omnisdemo.school',
    RE: 'm.lewis@omnisdemo.school',         PSHE: 'j.patel@omnisdemo.school',
  }

  // Look up teacher IDs
  const teacherIdByEmail: Record<string, string> = {}
  for (const email of Object.values(subjectTeacherEmail)) {
    if (!teacherIdByEmail[email]) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } })
      teacherIdByEmail[email] = u.id
    }
  }

  type ClassSpec = { id: string; name: string; subject: string; yearGroup: number }

  // New classes to create (skip already-existing ones)
  const sectionEClasses: ClassSpec[] = [
    // English — Y7, Y8 (Y9, Y10, Y11 already exist)
    { id: 'demo-class-7E-En1',  name: '7E/En1',  subject: 'English',   yearGroup: 7  },
    { id: 'demo-class-8E-En1',  name: '8E/En1',  subject: 'English',   yearGroup: 8  },
    // Science — Y7, Y8, Y10, Y11 (Y9 already exists)
    { id: 'demo-class-7S-Sc1',  name: '7S/Sc1',  subject: 'Science',   yearGroup: 7  },
    { id: 'demo-class-8S-Sc1',  name: '8S/Sc1',  subject: 'Science',   yearGroup: 8  },
    { id: 'demo-class-10S-Sc1', name: '10S/Sc1', subject: 'Science',   yearGroup: 10 },
    { id: 'demo-class-11S-Sc1', name: '11S/Sc1', subject: 'Science',   yearGroup: 11 },
    // History
    { id: 'demo-class-7-Hi1',   name: '7/Hi1',   subject: 'History',   yearGroup: 7  },
    { id: 'demo-class-8-Hi1',   name: '8/Hi1',   subject: 'History',   yearGroup: 8  },
    { id: 'demo-class-9-Hi1',   name: '9/Hi1',   subject: 'History',   yearGroup: 9  },
    { id: 'demo-class-10-Hi1',  name: '10/Hi1',  subject: 'History',   yearGroup: 10 },
    { id: 'demo-class-11-Hi1',  name: '11/Hi1',  subject: 'History',   yearGroup: 11 },
    // Geography
    { id: 'demo-class-7-Ge1',   name: '7/Ge1',   subject: 'Geography', yearGroup: 7  },
    { id: 'demo-class-8-Ge1',   name: '8/Ge1',   subject: 'Geography', yearGroup: 8  },
    { id: 'demo-class-9-Ge1',   name: '9/Ge1',   subject: 'Geography', yearGroup: 9  },
    { id: 'demo-class-10-Ge1',  name: '10/Ge1',  subject: 'Geography', yearGroup: 10 },
    { id: 'demo-class-11-Ge1',  name: '11/Ge1',  subject: 'Geography', yearGroup: 11 },
    // French
    { id: 'demo-class-7-Fr1',   name: '7/Fr1',   subject: 'French',    yearGroup: 7  },
    { id: 'demo-class-8-Fr1',   name: '8/Fr1',   subject: 'French',    yearGroup: 8  },
    { id: 'demo-class-9-Fr1',   name: '9/Fr1',   subject: 'French',    yearGroup: 9  },
    { id: 'demo-class-10-Fr1',  name: '10/Fr1',  subject: 'French',    yearGroup: 10 },
    { id: 'demo-class-11-Fr1',  name: '11/Fr1',  subject: 'French',    yearGroup: 11 },
    // Spanish
    { id: 'demo-class-7-Sp1',   name: '7/Sp1',   subject: 'Spanish',   yearGroup: 7  },
    { id: 'demo-class-8-Sp1',   name: '8/Sp1',   subject: 'Spanish',   yearGroup: 8  },
    { id: 'demo-class-9-Sp1',   name: '9/Sp1',   subject: 'Spanish',   yearGroup: 9  },
    { id: 'demo-class-10-Sp1',  name: '10/Sp1',  subject: 'Spanish',   yearGroup: 10 },
    { id: 'demo-class-11-Sp1',  name: '11/Sp1',  subject: 'Spanish',   yearGroup: 11 },
    // Art
    { id: 'demo-class-7-Ar1',   name: '7/Ar1',   subject: 'Art',       yearGroup: 7  },
    { id: 'demo-class-8-Ar1',   name: '8/Ar1',   subject: 'Art',       yearGroup: 8  },
    { id: 'demo-class-9-Ar1',   name: '9/Ar1',   subject: 'Art',       yearGroup: 9  },
    { id: 'demo-class-10-Ar1',  name: '10/Ar1',  subject: 'Art',       yearGroup: 10 },
    { id: 'demo-class-11-Ar1',  name: '11/Ar1',  subject: 'Art',       yearGroup: 11 },
    // Music
    { id: 'demo-class-7-Mu1',   name: '7/Mu1',   subject: 'Music',     yearGroup: 7  },
    { id: 'demo-class-8-Mu1',   name: '8/Mu1',   subject: 'Music',     yearGroup: 8  },
    { id: 'demo-class-9-Mu1',   name: '9/Mu1',   subject: 'Music',     yearGroup: 9  },
    { id: 'demo-class-10-Mu1',  name: '10/Mu1',  subject: 'Music',     yearGroup: 10 },
    { id: 'demo-class-11-Mu1',  name: '11/Mu1',  subject: 'Music',     yearGroup: 11 },
    // PE
    { id: 'demo-class-7-Pe1',   name: '7/Pe1',   subject: 'PE',        yearGroup: 7  },
    { id: 'demo-class-8-Pe1',   name: '8/Pe1',   subject: 'PE',        yearGroup: 8  },
    { id: 'demo-class-9-Pe1',   name: '9/Pe1',   subject: 'PE',        yearGroup: 9  },
    { id: 'demo-class-10-Pe1',  name: '10/Pe1',  subject: 'PE',        yearGroup: 10 },
    { id: 'demo-class-11-Pe1',  name: '11/Pe1',  subject: 'PE',        yearGroup: 11 },
    // Drama
    { id: 'demo-class-7-Dr1',   name: '7/Dr1',   subject: 'Drama',     yearGroup: 7  },
    { id: 'demo-class-8-Dr1',   name: '8/Dr1',   subject: 'Drama',     yearGroup: 8  },
    { id: 'demo-class-9-Dr1',   name: '9/Dr1',   subject: 'Drama',     yearGroup: 9  },
    { id: 'demo-class-10-Dr1',  name: '10/Dr1',  subject: 'Drama',     yearGroup: 10 },
    { id: 'demo-class-11-Dr1',  name: '11/Dr1',  subject: 'Drama',     yearGroup: 11 },
    // Computing
    { id: 'demo-class-7-Cp1',   name: '7/Cp1',   subject: 'Computing', yearGroup: 7  },
    { id: 'demo-class-8-Cp1',   name: '8/Cp1',   subject: 'Computing', yearGroup: 8  },
    { id: 'demo-class-9-Cp1',   name: '9/Cp1',   subject: 'Computing', yearGroup: 9  },
    { id: 'demo-class-10-Cp1',  name: '10/Cp1',  subject: 'Computing', yearGroup: 10 },
    { id: 'demo-class-11-Cp1',  name: '11/Cp1',  subject: 'Computing', yearGroup: 11 },
    // RE
    { id: 'demo-class-7-Re1',   name: '7/Re1',   subject: 'RE',        yearGroup: 7  },
    { id: 'demo-class-8-Re1',   name: '8/Re1',   subject: 'RE',        yearGroup: 8  },
    { id: 'demo-class-9-Re1',   name: '9/Re1',   subject: 'RE',        yearGroup: 9  },
    { id: 'demo-class-10-Re1',  name: '10/Re1',  subject: 'RE',        yearGroup: 10 },
    { id: 'demo-class-11-Re1',  name: '11/Re1',  subject: 'RE',        yearGroup: 11 },
    // PSHE
    { id: 'demo-class-7-Ps1',   name: '7/Ps1',   subject: 'PSHE',      yearGroup: 7  },
    { id: 'demo-class-8-Ps1',   name: '8/Ps1',   subject: 'PSHE',      yearGroup: 8  },
    { id: 'demo-class-9-Ps1',   name: '9/Ps1',   subject: 'PSHE',      yearGroup: 9  },
    { id: 'demo-class-10-Ps1',  name: '10/Ps1',  subject: 'PSHE',      yearGroup: 10 },
    { id: 'demo-class-11-Ps1',  name: '11/Ps1',  subject: 'PSHE',      yearGroup: 11 },
  ]

  for (const c of sectionEClasses) {
    const cls = await prisma.schoolClass.upsert({
      where:  { id: c.id },
      update: {},
      create: {
        id: c.id, name: c.name, subject: c.subject, yearGroup: c.yearGroup,
        department: subjectDeptMap[c.subject] ?? c.subject,
        schoolId: school.id,
      },
    })
    const tId = teacherIdByEmail[subjectTeacherEmail[c.subject]]
    await prisma.classTeacher.upsert({
      where:  { classId_userId: { classId: cls.id, userId: tId } },
      update: {},
      create: { classId: cls.id, userId: tId },
    })
  }
  console.log(`  ✓ ${sectionEClasses.length} new subject classes created`)

  // New students to add for Y7 and Y8 pools
  const newStudentsE = [
    { email: 'e.young@students.omnisdemo.school',  firstName: 'Emily',   lastName: 'Young'   },
    { email: 'm.rivera@students.omnisdemo.school', firstName: 'Marco',   lastName: 'Rivera'  },
    { email: 't.morgan@students.omnisdemo.school', firstName: 'Tia',     lastName: 'Morgan'  },
    { email: 'b.jones@students.omnisdemo.school',  firstName: 'Brandon', lastName: 'Jones'   },
    { email: 'o.rashid@students.omnisdemo.school', firstName: 'Omar',    lastName: 'Rashid'  },
  ]
  for (const s of newStudentsE) {
    await prisma.user.upsert({
      where:  { email: s.email },
      update: {},
      create: { schoolId: school.id, email: s.email, passwordHash, role: Role.STUDENT, firstName: s.firstName, lastName: s.lastName },
    })
  }

  // Existing class IDs already created in Sections A–D, grouped by year
  const existingClassIdsByYear: Record<number, string[]> = {
    7:  ['demo-class-7M-Ma1'],
    8:  ['demo-class-8M-Ma1'],
    9:  ['demo-class-9E-En1', 'demo-class-9M-Ma2', 'demo-class-9S-Sc1'],
    10: ['demo-class-10E-En2', 'demo-class-10M-Ma1'],
    11: ['demo-class-11E-En1', 'demo-class-11M-Ma1'],
  }

  // All new class IDs grouped by year
  const newClassIdsByYear: Record<number, string[]> = { 7: [], 8: [], 9: [], 10: [], 11: [] }
  for (const c of sectionEClasses) newClassIdsByYear[c.yearGroup].push(c.id)

  // Year group student pools (8 students per year)
  const yearGroupStudentPools: Record<number, string[]> = {
    7: [
      's.patel@students.omnisdemo.school', 'h.chen@students.omnisdemo.school',
      'd.okafor@students.omnisdemo.school', 'c.james@students.omnisdemo.school',
      'l.ford@students.omnisdemo.school', 'k.stone@students.omnisdemo.school',
      'e.young@students.omnisdemo.school', 'm.rivera@students.omnisdemo.school',
    ],
    8: [
      'r.ali@students.omnisdemo.school', 'c.harris@students.omnisdemo.school',
      'w.nguyen@students.omnisdemo.school', 'p.evans@students.omnisdemo.school',
      'a.scott@students.omnisdemo.school', 't.morgan@students.omnisdemo.school',
      'b.jones@students.omnisdemo.school', 'o.rashid@students.omnisdemo.school',
    ],
    9: [
      'a.hughes@students.omnisdemo.school', 'm.johnson@students.omnisdemo.school',
      't.cooper@students.omnisdemo.school', 'a.osei@students.omnisdemo.school',
      'f.jenkins@students.omnisdemo.school', 'r.sharma@students.omnisdemo.school',
      'b.walsh@students.omnisdemo.school', 's.ahmed@students.omnisdemo.school',
    ],
    10: [
      'o.thompson@students.omnisdemo.school', 'c.williams@students.omnisdemo.school',
      'j.brown@students.omnisdemo.school', 'e.davies@students.omnisdemo.school',
      'l.ahmed@students.omnisdemo.school', 'z.king@students.omnisdemo.school',
      'm.hall@students.omnisdemo.school', 'a.price@students.omnisdemo.school',
    ],
    11: [
      'g.wilson@students.omnisdemo.school', 'j.robinson@students.omnisdemo.school',
      'i.moore@students.omnisdemo.school', 'e.clarke@students.omnisdemo.school',
      'p.taylor@students.omnisdemo.school', 'n.martin@students.omnisdemo.school',
      'j.fox@students.omnisdemo.school', 'h.bailey@students.omnisdemo.school',
    ],
  }

  // Enrol each year group's pool in all subject classes for their year
  let enrolCount = 0
  for (const [ygStr, emails] of Object.entries(yearGroupStudentPools)) {
    const yg = Number(ygStr)
    const allClassIds = [
      ...(existingClassIdsByYear[yg] ?? []),
      ...(newClassIdsByYear[yg] ?? []),
    ]
    for (const email of emails) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } })
      for (const classId of allClassIds) {
        await prisma.enrolment.upsert({
          where:  { classId_userId: { classId, userId: u.id } },
          update: {},
          create: { classId, userId: u.id },
        })
        enrolCount++
      }
    }
    console.log(`  ✓ Y${yg}: ${emails.length} students × ${allClassIds.length} classes`)
  }
  console.log(`  ✓ ${enrolCount} total enrolments across all year groups & subjects`)

  // ── User Settings (demo data for 3 test users) ─────────────────────────────
  const settingsSeed = [
    {
      userId: created['j.patel'].id,
      phone:             '+44 7700 900142',
      bio:               'English teacher with 8 years experience specialising in KS4 and KS5 Literature.',
      defaultSubject:    'English',
      allowEmailNotifications:    true,
      allowSmsNotifications:      false,
      allowAnalyticsInsights:     true,
      profileVisibleToColleagues: true,
      profileVisibleToAdmins:     true,
      lessonSharing:     'SCHOOL'  as const,
      allowAiImprovement: true,
    },
    {
      userId: created['r.morris'].id,
      phone:             '+44 7911 123456',
      bio:               'SENCo with 12 years of SEND experience across primary and secondary settings.',
      defaultSubject:    null,
      allowEmailNotifications:    true,
      allowSmsNotifications:      true,
      allowAnalyticsInsights:     false,
      profileVisibleToColleagues: true,
      profileVisibleToAdmins:     true,
      lessonSharing:     'PRIVATE' as const,
      allowAiImprovement: false,
    },
    {
      userId: created['t.adeyemi'].id,
      phone:             '+44 7800 555123',
      bio:               'Head of Year 10, passionate about student wellbeing and academic achievement.',
      defaultSubject:    'Science',
      allowEmailNotifications:    true,
      allowSmsNotifications:      false,
      allowAnalyticsInsights:     true,
      profileVisibleToColleagues: true,
      profileVisibleToAdmins:     true,
      lessonSharing:     'SELECTED' as const,
      allowAiImprovement: false,
    },
  ]
  for (const s of settingsSeed) {
    await prisma.userSettings.upsert({
      where:  { userId: s.userId },
      create: s,
      update: s,
    })
  }
  console.log(`  ✓ UserSettings seeded for 3 demo users`)

  // ── School Calendar entries ────────────────────────────────────────────────
  const calendarEntries = [
    { id: 'CAL-DEMO-1', date: new Date('2026-01-05'), type: 'TERM_START', label: 'Spring Term begins' },
    { id: 'CAL-DEMO-2', date: new Date('2026-02-16'), type: 'HOLIDAY',    label: 'Spring Half Term'   },
    { id: 'CAL-DEMO-3', date: new Date('2026-03-02'), type: 'INSET',      label: 'Staff INSET Day'    },
    { id: 'CAL-DEMO-4', date: new Date('2026-04-01'), type: 'TERM_END',   label: 'Spring Term ends'   },
    { id: 'CAL-DEMO-5', date: new Date('2026-04-20'), type: 'TERM_START', label: 'Summer Term begins' },
  ]
  for (const e of calendarEntries) {
    await prisma.schoolCalendar.upsert({
      where:  { id: e.id },
      create: { ...e, schoolId: school.id },
      update: {},
    })
  }
  console.log(`  ✓ SchoolCalendar seeded (${calendarEntries.length} entries)`)

  // ── RAG demo data — StudentBaseline + TeacherPrediction + submissions ─────
  // Term label must match currentTermLabel() at runtime.  March 2026 = Spring 2026.
  const RAG_TERM = 'Spring 2026'

  // Look up 8M/Ma1 students (enrolled via the students loop above)
  const ragStudents8M = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'r.ali@students.omnisdemo.school'    } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'c.harris@students.omnisdemo.school' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'w.nguyen@students.omnisdemo.school' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'p.evans@students.omnisdemo.school'  } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'a.scott@students.omnisdemo.school'  } }),
  ])
  const [rehanAli, caitlinHarris, williamNguyen, priyaEvans, alexScott] = ragStudents8M

  // StudentBaselines (0-100 normalised %, KS2-derived)
  const baselines8M = [
    { studentId: rehanAli.id,      subject: 'Maths', baselineScore: 65, source: 'KS2' },
    { studentId: caitlinHarris.id, subject: 'Maths', baselineScore: 70, source: 'KS2' },
    { studentId: williamNguyen.id, subject: 'Maths', baselineScore: 68, source: 'KS2' },
    { studentId: priyaEvans.id,    subject: 'Maths', baselineScore: 75, source: 'KS2' },
    { studentId: alexScott.id,     subject: 'Maths', baselineScore: 62, source: 'KS2' },
  ]
  for (const b of baselines8M) {
    await prisma.studentBaseline.upsert({
      where:  { studentId_subject: { studentId: b.studentId, subject: b.subject } },
      update: { baselineScore: b.baselineScore, source: b.source },
      create: { ...b, schoolId: school.id, recordedBy: created['j.patel'].id },
    })
  }

  // TeacherPredictions for j.patel — 8M/Ma1 Maths (all on 0-100 scale)
  const predictions8M = [
    { studentId: rehanAli.id,      predictedScore: 68, adjustment: 0, notes: 'Strong effort in class; needs to show working clearly' },
    { studentId: caitlinHarris.id, predictedScore: 72, adjustment: 0, notes: null },
    { studentId: williamNguyen.id, predictedScore: 70, adjustment: 0, notes: 'Struggling with algebra; receiving extra support' },
    { studentId: priyaEvans.id,    predictedScore: 80, adjustment: 0, notes: null },
    { studentId: alexScott.id,     predictedScore: 65, adjustment: 0, notes: null },
  ]
  for (const p of predictions8M) {
    await prisma.teacherPrediction.upsert({
      where: { studentId_teacherId_subject_termLabel: { studentId: p.studentId, teacherId: created['j.patel'].id, subject: 'Maths', termLabel: RAG_TERM } },
      update: { predictedScore: p.predictedScore, adjustment: p.adjustment, notes: p.notes },
      create: { studentId: p.studentId, teacherId: created['j.patel'].id, schoolId: school.id, subject: 'Maths', termLabel: RAG_TERM, predictedScore: p.predictedScore, adjustment: p.adjustment, notes: p.notes },
    })
  }

  // Homework for 8M/Ma1 — "Algebra and Equations" (due within Spring 2026 term)
  // gradingBands keys 0-10, so maxFromBands = 10; raw finalScore ÷ 10 × 100 = pct
  const ragHw8M = await prisma.homework.upsert({
    where:  { id: 'demo-rag-hw-8M-algebra' },
    update: {},
    create: {
      id:           'demo-rag-hw-8M-algebra',
      schoolId:     school.id,
      classId:      classes['8M/Ma1'].id,
      title:        'Algebra and Equations — Spring Assessment',
      instructions: 'Solve the algebra problems showing full working. Marks awarded for method as well as correct answers.',
      type:         HomeworkType.SHORT_ANSWER,
      status:       HomeworkStatus.CLOSED,
      gradingBands: { '0-2': 'Little evidence of algebraic method', '3-5': 'Working towards expected; some correct steps', '6-8': 'Meets expected standard; mostly accurate', '9-10': 'Above expected; accurate with full working shown' },
      dueAt:        daysAgo(21),
      createdBy:    created['j.patel'].id,
    },
  })

  // RETURNED submissions — finalScores on 0-10 scale; after normalisation these produce
  // a mix of GREEN / AMBER / RED statuses for a compelling RAG demo view.
  // Rehan (7/10=70% vs pred 68): +2 → GREEN
  // Caitlin (6/10=60% vs pred 72): -12 → AMBER
  // William (4/10=40% vs pred 70): -30 → RED
  // Priya (9/10=90% vs pred 80): +10 → GREEN
  // Alex (5/10=50% vs pred 65): -15 → AMBER
  const submissions8M = [
    { studentId: rehanAli.id,      finalScore: 7,  grade: '7', feedback: 'Good algebraic reasoning, Rehan. Ensure you always write the equals sign on each line.' },
    { studentId: caitlinHarris.id, finalScore: 6,  grade: '6', feedback: 'Solid attempt on Q1–3. Review simultaneous equations — some sign errors crept in on Q4.' },
    { studentId: williamNguyen.id, finalScore: 4,  grade: '4', feedback: 'You attempted all questions which is great. We need to revisit expanding brackets — come see me at lunch.' },
    { studentId: priyaEvans.id,    finalScore: 9,  grade: '9', feedback: 'Excellent work, Priya. Full marks on Q1–4 and strong method on Q5. Consider entering the Maths Challenge.' },
    { studentId: alexScott.id,     finalScore: 5,  grade: '5', feedback: 'Good effort. Q1–2 were fully correct. Factorising needs more practice — try the worksheet I shared.' },
  ]
  for (const s of submissions8M) {
    await prisma.submission.upsert({
      where:  { homeworkId_studentId: { homeworkId: ragHw8M.id, studentId: s.studentId } },
      update: {},
      create: {
        schoolId:     school.id,
        homeworkId:   ragHw8M.id,
        studentId:    s.studentId,
        content:      '',
        status:       SubmissionStatus.RETURNED,
        submittedAt:  daysAgo(22),
        markedAt:     daysAgo(20),
        teacherScore: s.finalScore,
        finalScore:   s.finalScore,
        grade:        s.grade,
        feedback:     s.feedback,
        integrityReviewed: true,
      },
    })
  }

  // Also seed English predictions for j.patel's 9E/En1 class so the English RAG
  // view shows coloured dots.  Aiden Hughes already has a RETURNED AIC submission
  // (finalScore 7, maxScore 9 from gradingBands → 78%).
  const ragAiden  = created['a.hughes']
  const ragMaya   = created['m.johnson']
  const ragSophia = await prisma.user.findUniqueOrThrow({ where: { email: 's.ahmed@students.omnisdemo.school' } })

  const baselines9E = [
    { studentId: ragAiden.id,  subject: 'English', baselineScore: 72, source: 'KS2' },
    { studentId: ragMaya.id,   subject: 'English', baselineScore: 68, source: 'KS2' },
    { studentId: ragSophia.id, subject: 'English', baselineScore: 68, source: 'KS2' },
  ]
  for (const b of baselines9E) {
    await prisma.studentBaseline.upsert({
      where:  { studentId_subject: { studentId: b.studentId, subject: b.subject } },
      update: { baselineScore: b.baselineScore, source: b.source },
      create: { ...b, schoolId: school.id, recordedBy: created['j.patel'].id },
    })
  }

  const predictions9E = [
    { studentId: ragAiden.id,  predictedScore: 75, adjustment: 0, notes: 'Strong analytical writer; on track for Grade 7+' },
    { studentId: ragMaya.id,   predictedScore: 70, adjustment: 0, notes: null },
    { studentId: ragSophia.id, predictedScore: 72, adjustment: 0, notes: 'Consistent progress; predicted Grade 6–7 range' },
  ]
  for (const p of predictions9E) {
    await prisma.teacherPrediction.upsert({
      where: { studentId_teacherId_subject_termLabel: { studentId: p.studentId, teacherId: created['j.patel'].id, subject: 'English', termLabel: RAG_TERM } },
      update: { predictedScore: p.predictedScore, adjustment: p.adjustment, notes: p.notes },
      create: { studentId: p.studentId, teacherId: created['j.patel'].id, schoolId: school.id, subject: 'English', termLabel: RAG_TERM, predictedScore: p.predictedScore, adjustment: p.adjustment, notes: p.notes },
    })
  }
  console.log('  ✓ RAG demo data — StudentBaseline × 8, TeacherPrediction × 8, Submission × 5 (8M/Ma1 algebra)')

  // ── SEND data for Rehan Ali (8M/Ma1) ────────────────────────────────────────
  // SendStatus, IndividualLearningPlan + IlpTargets, LearnerPassport (K Plan)
  // so document badges and Classroom Adjustments render in the Class tab.

  const rehanUserId = rehanAli.id

  // SendStatus — SEN_SUPPORT
  await prisma.sendStatus.upsert({
    where:  { studentId: rehanUserId },
    update: { activeStatus: 'SEN_SUPPORT', needArea: 'Communication and Interaction' },
    create: {
      studentId:    rehanUserId,
      activeStatus: 'SEN_SUPPORT',
      needArea:     'Communication and Interaction',
    },
  })

  // IndividualLearningPlan
  const rehanIlp = await prisma.individualLearningPlan.upsert({
    where:  { id: 'seed-ilp-rehan-ali' },
    update: {},
    create: {
      id:              'seed-ilp-rehan-ali',
      schoolId:        school.id,
      studentId:       rehanUserId,
      createdBy:       created['r.morris'].id,
      sendCategory:    'SEN_SUPPORT',
      currentStrengths:'Enthusiastic in class discussions; strong visual-spatial reasoning; responds well to structured tasks.',
      areasOfNeed:     'Extended writing — difficulty organising paragraphs under time pressure. Processing speed when reading multi-step problems.',
      strategies:      [
        'Break multi-step problems into clearly numbered sub-tasks',
        'Allow extra 10% time on timed written tasks',
        'Use graphic organisers before extended writing',
        'Seat at the front to reduce distractions',
      ],
      successCriteria: 'Independently structure a 4-paragraph extended answer using a planning frame by end of term.',
      reviewDate:      new Date('2026-06-15'),
      status:          'active',
      parentConsent:   true,
    },
  })

  // ILP Targets
  await prisma.ilpTarget.createMany({
    skipDuplicates: true,
    data: [
      {
        id:             'seed-ilpt-rehan-1',
        ilpId:          rehanIlp.id,
        target:         'Use a planning frame to structure extended writing before attempting the task',
        strategy:       'Provide a 4-box paragraph planner for all extended written tasks; model during lesson starter.',
        successMeasure: 'Independently uses planner on at least 3 consecutive pieces of written work with no prompting.',
        targetDate:     new Date('2026-05-30'),
        status:         'active',
      },
      {
        id:             'seed-ilpt-rehan-2',
        ilpId:          rehanIlp.id,
        target:         'Demonstrate understanding of multi-step problems by writing out each step clearly',
        strategy:       'Chunk problem sheets with sub-question numbering; allow rough-working space per sub-step.',
        successMeasure: 'Shows all working in at least 80% of multi-step questions over a half-term.',
        targetDate:     new Date('2026-06-15'),
        status:         'active',
      },
    ],
  })

  // LearnerPassport (K Plan) with teacherActions for Classroom Adjustments section
  await prisma.learnerPassport.upsert({
    where:  { id: 'seed-kplan-rehan-ali' },
    update: {},
    create: {
      id:             'seed-kplan-rehan-ali',
      schoolId:       school.id,
      studentId:      rehanUserId,
      ilpId:          rehanIlp.id,
      sendInformation:'Rehan has Communication and Interaction needs. He benefits from clear structure, visual supports, and chunked instructions. Not on medication. Parents fully engaged.',
      teacherActions: [
        'Seat near the front, away from high-traffic areas',
        'Break instructions into no more than 3 steps at a time',
        'Provide a written copy of verbal instructions on the board',
        'Allow paragraph planning frame for all extended writing',
        'Give 10% extra time on timed written tasks',
        'Check in quietly after whole-class instruction to confirm understanding',
      ],
      studentCommitments: [
        'Use the paragraph planner before starting extended answers',
        'Ask for help rather than staying stuck for more than 2 minutes',
        'Attempt to write out all working steps in maths problems',
      ],
      status:      'APPROVED',
      approvedBy:  created['r.morris'].id,
      approvedAt:  new Date('2026-01-15'),
    },
  })

  console.log('  ✓ SEND data — Rehan Ali: SendStatus, ILP + 2 targets, K Plan (LearnerPassport)')

  console.log('\nSeed complete. All passwords: Demo1234!')
  console.log('\n── Test accounts ────────────────────────────────────────')
  console.log('  j.patel@omnisdemo.school       TEACHER    (English, 3 classes)')
  console.log('  r.morris@omnisdemo.school       SENCO')
  console.log('  t.adeyemi@omnisdemo.school      HEAD_OF_YEAR (Year 9)')
  console.log('  d.brooks@omnisdemo.school       HEAD_OF_DEPT (English)')
  console.log('  c.roberts@omnisdemo.school      SLT')
  console.log('  k.wright@omnisdemo.school       TEACHER    (Maths, 10M/Ma1)')
  console.log('  a.hughes@students.omnisdemo.school STUDENT (Year 9)')
  console.log('  l.hughes@parents.omnisdemo.school  PARENT (Aiden\'s mum)')
  console.log('  admin@omnisdemo.school          SCHOOL_ADMIN')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
