import { PrismaClient, Role, LessonType, ResourceType, HomeworkType, HomeworkStatus, SubmissionStatus, ReleasePolicy, PlanStatus, SendStatusValue, LessonSharingLevel } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function monday(offsetWeeks = 0): Date {
  const now = new Date()
  const dow = now.getDay() // 0=Sun … 6=Sat
  const d = new Date(now)
  // If run on Sat/Sun, snap forward to the upcoming Monday so lessons
  // always land on the school week the teacher will see next.
  if (dow === 6) d.setDate(now.getDate() + 2)
  else if (dow === 0) d.setDate(now.getDate() + 1)
  else d.setDate(now.getDate() - (dow - 1))
  d.setDate(d.getDate() + offsetWeeks * 7)
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

  // AIC homework — gradingBands added so max=9 is explicit (fixes percentage normalisation)
  const aicHW = await prisma.homework.upsert({
    where: { id: 'demo-hw-aic-1' },
    update: { gradingBands: { '0-3': 'Limited contextual knowledge; key dates absent or inaccurate', '4-6': 'Developing: relevant context with some link to Priestley\'s message', '7-9': 'Secure: accurate, specific historical context clearly linked to Priestley\'s socialist message' } },
    create: {
      id:            'demo-hw-aic-1',
      schoolId:      school.id,
      classId:       classes['9E/En1'].id,
      lessonId:      lessonIds['demo-lesson-9E-d0-h9'],
      title:         'An Inspector Calls — Context Research',
      instructions:  'Research the historical context of "An Inspector Calls". Write 150 words explaining how the events of 1912 and 1945 are important to understanding Priestley\'s message. Include at least two specific historical facts.',
      modelAnswer:   'Students should reference the Titanic (class divide), WW1/WW2, the 1945 Labour election and the creation of the welfare state as key context points that inform Priestley\'s socialist message.',
      gradingBands:  { '0-3': 'Limited contextual knowledge; key dates absent or inaccurate', '4-6': 'Developing: relevant context with some link to Priestley\'s message', '7-9': 'Secure: accurate, specific historical context clearly linked to Priestley\'s socialist message' },
      dueAt:         daysAgo(7),
      status:        HomeworkStatus.CLOSED,
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
    update: {
      title: 'Descriptive Writing — Sensory Detail',
      objectives: ['Use sensory language to create vivid descriptive writing', 'Identify and analyse the effect of sensory imagery in a model text', 'Draft and refine a descriptive paragraph independently'],
      scheduledAt: lessonDate(0, 1, 14),   // Tue 14:00 — refresh to current week
      endsAt:      lessonDate(0, 1, 15),
    },
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
    update: {
      title: 'Fractions — Adding & Subtracting with Different Denominators',
      objectives: ['Find the lowest common multiple (LCM) of two numbers', 'Add and subtract fractions with different denominators', 'Simplify answers to lowest terms'],
      scheduledAt: lessonDate(0, 3, 9),    // Thu 09:00 — refresh to current week
      endsAt:      lessonDate(0, 3, 10),
    },
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

  // 9E/En1 — Fatima Al-Amin (Speech, Language & Communication, SEN Support)
  const fatimaAlAmin = await addStudent('f.alamin@students.omnisdemo.school',  'Fatima',   'Al-Amin', cls9.id)

  // 10M/Ma1 — 8 students
  const rubyPham     = await addStudent('r.pham@students.omnisdemo.school',    'Ruby',     'Pham',    cls10Ma.id)
  const tylerNash    = await addStudent('t.nash@students.omnisdemo.school',    'Tyler',    'Nash',    cls10Ma.id)
  const jackOsei     = await addStudent('j.osei@students.omnisdemo.school',    'Jack',     'Osei',    cls10Ma.id)
  const imogenHart   = await addStudent('i.hart@students.omnisdemo.school',    'Imogen',   'Hart',    cls10Ma.id)
  const davidKim     = await addStudent('d.kim@students.omnisdemo.school',     'David',    'Kim',     cls10Ma.id)
  const laylaHassan  = await addStudent('l.hassan@students.omnisdemo.school',  'Layla',    'Hassan',  cls10Ma.id)
  const connorWebb   = await addStudent('c.webb@students.omnisdemo.school',    'Connor',   'Webb',    cls10Ma.id)
  const nadiaP       = await addStudent('n.popescu@students.omnisdemo.school', 'Nadia',    'Popescu', cls10Ma.id)

  console.log('  ✓ 20 new students added across 9E/En1, 10E/En2, 11E/En1, 10M/Ma1')

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
    { studentId: fatimaAlAmin.id, status: SendStatusValue.SEN_SUPPORT, needArea: 'Speech, Language & Communication'        },
  ]
  for (const s of sendSetups) {
    await prisma.sendStatus.upsert({
      where:  { studentId: s.studentId },
      update: { activeStatus: s.status, needArea: s.needArea },
      create: { studentId: s.studentId, activeStatus: s.status, activeSource: 'SENCO', needArea: s.needArea },
    })
  }
  console.log('  ✓ 9 SEND profiles (2 EHCP, 7 SEN Support)')

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

  // ── IndividualLearningPlan + LearnerPassport for all SEND students ─────────
  // Every student with a SEND badge MUST have an ILP so hasIlp=true and the
  // classroom tips section renders in the Class tab.

  // Helper — create ILP + optional targets + K Plan in one step (idempotent)
  async function seedIlpAndKPlan(opts: {
    ilpId: string; kplanId: string; studentId: string
    sendCategory: string; strengths: string; areasOfNeed: string
    strategies: string[]; successCriteria: string; reviewDate: Date
    sendInfo: string; teacherActions: string[]; studentCommitments: string[]
    targets?: Array<{ id: string; target: string; strategy: string; successMeasure: string; targetDate: Date }>
  }) {
    const ilp = await prisma.individualLearningPlan.upsert({
      where:  { id: opts.ilpId },
      update: {},
      create: {
        id: opts.ilpId, schoolId: school.id, studentId: opts.studentId,
        createdBy: senco.id, sendCategory: opts.sendCategory,
        currentStrengths: opts.strengths, areasOfNeed: opts.areasOfNeed,
        strategies: opts.strategies, successCriteria: opts.successCriteria,
        reviewDate: opts.reviewDate, status: 'active', parentConsent: true,
      },
    })
    if (opts.targets?.length) {
      await prisma.ilpTarget.createMany({
        skipDuplicates: true,
        data: opts.targets.map(t => ({ ...t, ilpId: ilp.id })),
      })
    }
    await prisma.learnerPassport.upsert({
      where:  { id: opts.kplanId },
      update: {},
      create: {
        id: opts.kplanId, schoolId: school.id, studentId: opts.studentId,
        ilpId: ilp.id, sendInformation: opts.sendInfo,
        teacherActions: opts.teacherActions, studentCommitments: opts.studentCommitments,
        status: 'APPROVED', approvedBy: senco.id, approvedAt: new Date('2026-01-15'),
      },
    })
    return ilp
  }

  // Sophie Chen — SpLD/Dyslexia (9E/En1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-sophie-chen', kplanId: 'seed-kplan-sophie-chen',
    studentId: sophieChen.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Strong verbal reasoning; contributes well in class discussions. Good memory for texts read aloud. Motivated and responds well to positive feedback.',
    areasOfNeed: 'Decoding multi-syllabic words under time pressure. Extended written expression — ideas outpace written output. Spelling of subject-specific vocabulary.',
    strategies: [
      'Provide writing frames and sentence starters for all extended tasks',
      'Allow use of coloured overlay and larger-font printed resources',
      'Pre-teach key vocabulary before the lesson',
      'Accept bullet-point planning as an alternative to full prose drafting',
      'Allow 25% extra time on timed written tasks',
    ],
    successCriteria: 'Independently produce a structured two-paragraph analytical response using a writing frame by end of Spring term.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Sophie has Specific Learning Difficulties (Dyslexia) affecting reading fluency and written output. Verbal comprehension is strong. Responds well to structured scaffolds and explicit vocabulary support.',
    teacherActions: [
      'Provide writing frames and sentence starters for extended tasks',
      'Allow use of coloured overlay and larger-font resources',
      'Pre-teach key vocabulary before the lesson',
      'Allow 25% extra time on timed written tasks',
    ],
    studentCommitments: [
      'Use the writing frame before starting any extended answer',
      'Ask for vocabulary support if a word is unclear',
    ],
    targets: [{ id: 'seed-ilpt-sophie-1', target: 'Independently structure a two-paragraph analytical response using the writing frame', strategy: 'Writing frame provided before every extended task; teacher models use during lesson starter.', successMeasure: 'Uses frame without prompting on 3 consecutive written tasks.', targetDate: new Date('2026-06-20') }],
  })

  // Marcus Bell — SEMH (9E/En1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-marcus-bell', kplanId: 'seed-kplan-marcus-bell',
    studentId: marcusBell.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Creative thinker with original ideas when engaged. Good at discussing texts orally. Capable of strong written work when motivated and in the right headspace.',
    areasOfNeed: 'Emotional regulation — can disengage or become confrontational when anxious. Homework completion is inconsistent. Difficulty sustaining focus for extended tasks.',
    strategies: [
      'Quiet check-in before the lesson if there are known stressors',
      'Give advance warning before cold-calling; never put Marcus on the spot without prior notice',
      'Break tasks into small timed chunks with a clear checkpoint',
      'Use a calm-down card or quiet-space protocol if emotional dysregulation begins',
      'Acknowledge effort explicitly before commenting on accuracy',
    ],
    successCriteria: 'Complete at least 3 out of 5 homework tasks each half-term and remain on task for 80% of a 60-minute lesson.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Marcus has Social, Emotional and Mental Health needs. Can become anxious in unstructured situations or when called on unexpectedly. Responds best to predictable routines, positive reinforcement, and quiet 1:1 check-ins.',
    teacherActions: [
      'Check in quietly before the lesson if there are known stressors',
      'Give advance warning before cold-calling',
      'Break tasks into small chunks with a clear checkpoint',
      'Use a calm-down card protocol if emotional dysregulation begins',
    ],
    studentCommitments: [
      'Communicate if feeling overwhelmed before a task rather than after',
      'Attempt each section before asking for help',
    ],
    targets: [{ id: 'seed-ilpt-marcus-1', target: 'Complete at least 3 out of 5 homework tasks per half-term', strategy: 'Homework broken into smaller sections; teacher provides a completion checklist.', successMeasure: '3+ tasks submitted per half-term to any standard.', targetDate: new Date('2026-06-20') }],
  })

  // Rosa Ferretti — EHCP/SpLD (10E/En2)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-rosa-ferretti', kplanId: 'seed-kplan-rosa-ferretti',
    studentId: rosaFerretti.id, sendCategory: 'EHCP',
    strengths: 'Determined and persistent — does not give up easily. Good verbal comprehension; can identify relevant evidence from texts when given structured support.',
    areasOfNeed: 'Decoding, reading fluency and written expression significantly below age-related expectations. Difficulty organising written responses without a detailed scaffold.',
    strategies: [
      'Provide essay planning template before any extended writing task',
      'Allow 25% extra time and laptop access for longer written tasks',
      'Seat near the teacher, away from distractions',
      'Pre-teach vocabulary and provide a glossary for new topics',
      'Offer scribe or voice-to-text for assessed pieces where needed',
    ],
    successCriteria: 'Produce a structured essay plan and a full two-paragraph response using scaffold by end of Summer term.',
    reviewDate: new Date('2026-07-01'),
    sendInfo: 'Rosa has an EHCP — Specific Learning Difficulty (SpLD). EHCP provision: 25% extra time, laptop access, reader for examinations, writing frames in all subjects.',
    teacherActions: [
      'Provide essay planning template before extended writing',
      'Allow 25% extra time and access to laptop for longer tasks',
      'Seat near the teacher, away from distractions',
      'Pre-teach vocabulary and provide a glossary',
    ],
    studentCommitments: [
      'Use the planning template before starting any extended answer',
      'Request the glossary if vocabulary is unclear',
    ],
    targets: [{ id: 'seed-ilpt-rosa-1', target: 'Produce a structured essay plan before writing using the provided template', strategy: 'Planning template provided before every extended task; modelled in lesson starter.', successMeasure: 'Uses template independently on 3 consecutive extended tasks.', targetDate: new Date('2026-07-01') }],
  })

  // Aaron Walsh — SEMH (10E/En2)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-aaron-walsh', kplanId: 'seed-kplan-aaron-walsh',
    studentId: aaronWalsh.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Socially perceptive; responds well to genuine relationship-building. Capable of empathetic analytical responses when confident.',
    areasOfNeed: 'Emotional dysregulation in stressful situations. Homework avoidance — often does not submit. Can become confrontational if challenged publicly about work.',
    strategies: [
      'Avoid public confrontation about incomplete work — address privately',
      'Break tasks into small achievable chunks with individual check-ins',
      'Use an exit pass or calm-down card if Aaron becomes dysregulated',
      'Acknowledge partial attempts as positive engagement',
      'Communicate upcoming assessments in advance to reduce anxiety',
    ],
    successCriteria: 'Complete at least 3 out of 5 homework tasks per half-term and manage classroom stress using self-regulation strategies on at least 2 occasions.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Aaron has Social, Emotional and Mental Health needs. Homework avoidance is a key concern. He responds poorly to public challenge but well to trusted adult relationships. Pastoral team involved.',
    teacherActions: [
      'Address incomplete work privately, never in front of peers',
      'Break tasks into small chunks with individual check-ins',
      'Use an exit pass if Aaron becomes dysregulated',
      'Communicate upcoming assessments in advance',
    ],
    studentCommitments: [
      'Attempt at least one section of each homework before the deadline',
      'Use the calm-down card instead of leaving the room unannounced',
    ],
    targets: [{ id: 'seed-ilpt-aaron-1', target: 'Submit at least 3 homework tasks per half-term to any standard', strategy: 'Tasks broken into sections; partial submission accepted; teacher checks in individually.', successMeasure: '3+ tasks submitted per half-term.', targetDate: new Date('2026-06-20') }],
  })

  // Caitlin Fox — EHCP/C&I (11E/En1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-caitlin-fox', kplanId: 'seed-kplan-caitlin-fox',
    studentId: caitlinFox.id, sendCategory: 'EHCP',
    strengths: 'Conscientious and tries hard. Good factual recall for plot details. Responds well to clear, structured expectations and consistent classroom routines.',
    areasOfNeed: 'Difficulty interpreting implicit meaning in texts and figurative language. Extended analytical writing is significantly underdeveloped. Misses implied instructions when given verbally only.',
    strategies: [
      'Give written instructions alongside all verbal explanations',
      'Allow additional processing time before expecting a response',
      'Use a clear visual lesson structure (objective → tasks → success criteria) on the board',
      'Break analytical tasks into explicit steps with a worked example',
      'Provide a sentence-starter sheet for all analytical paragraphs',
    ],
    successCriteria: 'Write a three-sentence analytical paragraph using the sentence-starter sheet independently on at least 3 occasions by end of term.',
    reviewDate: new Date('2026-07-01'),
    sendInfo: 'Caitlin has an EHCP — Communication and Interaction. Social communication difficulties affect interpretation of implicit meaning and response to verbal-only instructions. EHCP provision: written instructions in all subjects, processing time, laptop access, weekly mentor meeting.',
    teacherActions: [
      'Give written instructions alongside verbal explanations',
      'Allow processing time before expecting a response',
      'Use a clear visual lesson structure on the board',
      'Provide sentence-starter sheet for analytical paragraphs',
    ],
    studentCommitments: [
      'Ask for clarification if an instruction is unclear rather than guessing',
      'Use the sentence-starter sheet before asking for help',
    ],
    targets: [{ id: 'seed-ilpt-caitlin-1', target: 'Write a three-sentence PEE paragraph using the sentence-starter sheet independently', strategy: 'Sentence-starter sheet provided before every analytical task; teacher models use.', successMeasure: 'Independently produces a full PEE paragraph on 3 consecutive tasks.', targetDate: new Date('2026-07-01') }],
  })

  // Michael Torres — Cognition & Learning (11E/En1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-michael-torres', kplanId: 'seed-kplan-michael-torres',
    studentId: michaelT.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Resilient and good-natured. Quick to grasp concepts when demonstrated step by step. Good at identifying patterns in texts when not under time pressure.',
    areasOfNeed: 'Working memory difficulties — struggles to hold multi-step instructions simultaneously. Processing speed below age-related expectations. Written output is slow under timed conditions.',
    strategies: [
      'Break instructions into single steps and check comprehension after each one',
      'Provide a worked example before every independent task',
      'Use concrete visual models (graphic organisers, concept maps)',
      'Allow additional writing time; accept shorter responses of equivalent quality',
      'Seat away from distractions; use a task-completion checklist',
    ],
    successCriteria: 'Complete at least 3 multi-step written tasks independently using a graphic organiser by end of term.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Michael has Cognition and Learning needs. Working memory difficulties mean he cannot hold multiple instructions simultaneously. Works best with step-by-step modelling, visual organisers, and clearly chunked tasks.',
    teacherActions: [
      'Break instructions into single steps',
      'Provide a worked example before independent tasks',
      'Use visual organisers and concept maps',
      'Allow additional writing time',
    ],
    studentCommitments: [
      'Use the task checklist to track progress through each activity',
      'Ask for a worked example if unsure how to start',
    ],
    targets: [{ id: 'seed-ilpt-michael-1', target: 'Complete a multi-step written task using a graphic organiser without teacher prompting', strategy: 'Graphic organiser provided before every multi-step task; teacher models in lesson starter.', successMeasure: 'Independently completes task with organiser on 3 consecutive occasions.', targetDate: new Date('2026-06-20') }],
  })

  // Tyler Nash — SEMH (10M/Ma1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-tyler-nash', kplanId: 'seed-kplan-tyler-nash',
    studentId: tylerNash.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Gets correct answers when working at own pace. Responds well to low-stakes practice. Has improved significantly in willingness to attempt tasks this year.',
    areasOfNeed: 'Significant anxiety around Maths performance and fear of failure in front of peers. Homework avoidance is a consistent pattern. Reluctant to ask for help when stuck.',
    strategies: [
      'Acknowledge effort before accuracy in all feedback',
      'Start each lesson with a short achievable starter activity Tyler can succeed at',
      'Accept partial homework submissions without penalty; follow up privately',
      'Avoid asking Tyler to perform on the board in front of peers without consent',
      'Provide a pre-worked example alongside each homework task',
    ],
    successCriteria: 'Submit at least 3 homework tasks per half-term and attempt a full question set (Q1–3) without support on at least 2 occasions.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Tyler has Social, Emotional and Mental Health needs. Maths performance anxiety drives avoidance. Responds best to low-stakes starts, private check-ins, and explicit praise for effort.',
    teacherActions: [
      'Acknowledge effort before accuracy',
      'Offer an achievable starter activity to build confidence',
      'Accept partial homework submission without penalty',
      'Avoid cold-calling Tyler to perform on the board without consent',
    ],
    studentCommitments: [
      'Attempt at least Q1–3 of every homework before the deadline',
      'Signal if feeling anxious rather than shutting down',
    ],
    targets: [{ id: 'seed-ilpt-tyler-1', target: 'Submit at least 3 homework tasks per half-term to any standard', strategy: 'Pre-worked example provided; partial submission accepted; teacher follows up privately.', successMeasure: '3+ tasks submitted per half-term.', targetDate: new Date('2026-06-20') }],
  })

  // Layla Hassan — SpLD/Dyslexia (10M/Ma1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-layla-hassan', kplanId: 'seed-kplan-layla-hassan',
    studentId: laylaHassan.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Good mental arithmetic and pattern recognition. Understands mathematical concepts well when explained verbally or with visual models. Resilient and does not give up easily.',
    areasOfNeed: 'Decoding mathematical notation and multi-syllabic vocabulary. Spatial processing of longer written methods. Written output is slow under timed conditions.',
    strategies: [
      'Provide enlarged-print or zoomed worksheets for all written tasks',
      'Allow use of number line, multiplication grid, and calculator where appropriate',
      'Give a step-by-step method card for all multi-stage calculations',
      'Pre-teach mathematical vocabulary before new topic introductions',
      'Allow 25% extra time on timed tasks',
    ],
    successCriteria: 'Independently complete a 5-question algebra task using the method card within extended time by end of term.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Layla has Specific Learning Difficulties (Dyslexia) affecting decoding of complex written mathematical notation and written working speed. Visual and verbal processing strengths can be leveraged with appropriate scaffolding.',
    teacherActions: [
      'Provide large-print or zoomed worksheets',
      'Allow use of number line and multiplication grid',
      'Give step-by-step method card for multi-stage calculations',
      'Allow 25% extra time on timed tasks',
    ],
    studentCommitments: [
      'Use the method card for multi-stage calculations',
      'Ask for a zoomed copy of the worksheet if the text is unclear',
    ],
    targets: [{ id: 'seed-ilpt-layla-1', target: 'Independently complete a 5-question algebra task using the method card within extended time', strategy: 'Method card provided before every algebra task; teacher checks Layla has the correct card.', successMeasure: 'Completes 5-question set independently with method card on 3 consecutive occasions.', targetDate: new Date('2026-06-20') }],
  })

  // Fatima Al-Amin — Speech, Language & Communication (9E/En1)
  await seedIlpAndKPlan({
    ilpId: 'seed-ilp-fatima-alamin', kplanId: 'seed-kplan-fatima-alamin',
    studentId: fatimaAlAmin.id, sendCategory: 'SEN_SUPPORT',
    strengths: 'Highly motivated and conscientious — always attempts homework and engages positively with feedback. Good listening skills and strong comprehension when given sufficient processing time.',
    areasOfNeed: 'Expressive language — takes significantly longer to formulate verbal responses. Can struggle to access meaning from dense written texts without scaffolded support.',
    strategies: [
      'Allow processing time after asking a question — wait at least 10 seconds before prompting',
      'Seat near the front to facilitate direct teacher communication',
      'Provide all instructions in written form alongside verbal delivery',
      'Pre-teach key vocabulary before the lesson using a visual word bank',
      'Accept written responses where verbal responses are expected when needed',
    ],
    successCriteria: 'Independently formulate and deliver a verbal analytical response of 2+ sentences in 3 out of 5 class discussions by end of term.',
    reviewDate: new Date('2026-06-20'),
    sendInfo: 'Fatima has Speech, Language and Communication needs. Expressive language processing takes longer than peers. Benefits from advance notice of questions, processing time, and written supports alongside verbal instructions. NHS SALT sessions fortnightly.',
    teacherActions: [
      'Allow processing time — wait 10 seconds after asking Fatima a question',
      'Seat near the front',
      'Provide written instructions alongside verbal delivery',
    ],
    studentCommitments: [
      'Prepare a written note before class discussions to support verbal responses',
      'Ask for written instructions if unclear rather than guessing',
    ],
    targets: [
      { id: 'seed-ilpt-fatima-1', target: 'Independently formulate a verbal analytical response of 2+ sentences in class discussion', strategy: 'Pre-warn Fatima of questions; allow processing time; accept written note as scaffold.', successMeasure: '2+ sentence verbal response in 3 of 5 class discussions.', targetDate: new Date('2026-06-20') },
      { id: 'seed-ilpt-fatima-2', target: 'Decode and follow multi-step written instructions independently without teacher support', strategy: 'Provide written instructions before verbal; visual word bank for new vocabulary.', successMeasure: 'Starts task from written instruction alone on 3 consecutive occasions.', targetDate: new Date('2026-06-20') },
      { id: 'seed-ilpt-fatima-3', target: 'Write a two-paragraph structured analytical response using sentence-starter scaffold', strategy: 'Sentence-starter sheet provided; written vocabulary bank; teacher checks start before moving on.', successMeasure: 'Produces a full 2-paragraph response with scaffold on 3 consecutive tasks.', targetDate: new Date('2026-06-20') },
    ],
  })

  console.log('  ✓ ILP + K Plan — 9 SEND students (Sophie Chen, Marcus Bell, Rosa Ferretti, Aaron Walsh, Caitlin Fox, Michael Torres, Tyler Nash, Layla Hassan, Fatima Al-Amin)')

  // ── EhcpPlan records for Rosa Ferretti & Caitlin Fox ──────────────────────
  await prisma.ehcpPlan.upsert({
    where:  { id: 'seed-ehcp-rosa-ferretti' },
    update: {},
    create: {
      id: 'seed-ehcp-rosa-ferretti', schoolId: school.id,
      studentId: rosaFerretti.id, createdBy: senco.id,
      localAuthority: 'Oakfield Metropolitan Borough Council',
      planDate: new Date('2024-09-01'), reviewDate: new Date('2026-07-01'),
      coordinatorName: 'Ms J. Freeman', status: 'active',
      outcomes: {
        create: [
          {
            section: 'B',
            outcomeText: 'Rosa will independently read and interpret GCSE-level written texts using phonics and contextual strategies.',
            successCriteria: 'Reading comprehension score at or above 60% on standardised assessment at annual review.',
            targetDate: new Date('2026-07-01'),
            provisionRequired: 'Coloured overlay, enlarged print, reader for examinations, 25% extra time.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Rosa will produce a structured two-paragraph essay response using a writing frame with decreasing scaffolding across the year.',
            successCriteria: 'Three consecutive homework tasks producing a full two-paragraph response to teacher standard.',
            targetDate: new Date('2026-07-01'),
            provisionRequired: 'Writing frame and planning template in all subjects. Laptop access. Scribe available for assessments.',
            status: 'active', evidenceCount: 0,
          },
        ],
      },
    },
  })

  await prisma.ehcpPlan.upsert({
    where:  { id: 'seed-ehcp-caitlin-fox' },
    update: {},
    create: {
      id: 'seed-ehcp-caitlin-fox', schoolId: school.id,
      studentId: caitlinFox.id, createdBy: senco.id,
      localAuthority: 'Oakfield Metropolitan Borough Council',
      planDate: new Date('2024-09-01'), reviewDate: new Date('2026-07-01'),
      coordinatorName: 'Ms J. Freeman', status: 'active',
      outcomes: {
        create: [
          {
            section: 'C',
            outcomeText: 'Caitlin will demonstrate two self-regulation strategies when experiencing anxiety in a classroom setting.',
            successCriteria: 'Pastoral log records independent use of strategies on at least 5 occasions per half-term.',
            targetDate: new Date('2026-07-01'),
            provisionRequired: 'Weekly mentor meeting. Calm-down card. Access to pastoral room.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Caitlin will independently follow written instructions to complete a structured analytical task without teacher support.',
            successCriteria: 'Completes a 3-step written task from written instructions alone on 3 consecutive occasions.',
            targetDate: new Date('2026-07-01'),
            provisionRequired: 'Written instructions alongside verbal in all subjects. Sentence-starter sheets. Processing time.',
            status: 'active', evidenceCount: 0,
          },
        ],
      },
    },
  })

  console.log('  ✓ EhcpPlan records — Rosa Ferretti (10E/En2), Caitlin Fox (11E/En1)')

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

  // ── 3 past homeworks for 9E/En1 — used for Fatima Al-Amin's RAG submissions ─
  // max=20 → score 10 = 50%; max=25 → score 12 = 48%; max=20 → score 11 = 55%
  await prisma.homework.upsert({
    where:  { id: 'demo-hw-9e-birling' },
    update: {},
    create: {
      id: 'demo-hw-9e-birling', schoolId: school.id, classId: cls9.id,
      title: 'Character Analysis — How does Priestley present Mr Birling?',
      instructions: 'Write two paragraphs analysing how Priestley uses Mr Birling to criticise capitalist attitudes. Use at least one quotation and explain the language choices.',
      modelAnswer: 'Priestley presents Mr Birling as a symbol of capitalist arrogance. The dramatic irony of his claim that the Titanic is "unsinkable" positions him as deluded and morally blind from the very start of the play. By having a 1945 audience watch a 1912 businessman confidently predict a future they know to be catastrophic, Priestley invites us to distrust everything Birling says.',
      gradingBands: { '0-5': 'Descriptive response with limited textual reference.', '6-10': 'Some analysis with a quotation identified.', '11-15': 'Clear analytical writing with language analysis.', '16-20': 'Detailed, perceptive analysis with sophisticated language focus.' },
      dueAt: daysAgo(21), status: HomeworkStatus.CLOSED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 1, createdBy: created['j.patel'].id,
    },
  })
  await prisma.homework.upsert({
    where:  { id: 'demo-hw-9e-quiz' },
    update: {},
    create: {
      id: 'demo-hw-9e-quiz', schoolId: school.id, classId: cls9.id,
      title: 'Themes Quiz — Power and Control in An Inspector Calls',
      instructions: 'Answer all 5 questions using full sentences. You must use at least one quotation in your answers.',
      modelAnswer: 'Power in AIC is exercised through wealth, gender, and social class. The Inspector subverts all three by the end of Act Three, exposing how each Birling used power to avoid responsibility.',
      gradingBands: { '0-5': 'Minimal understanding shown.', '6-10': 'Some accurate responses.', '11-15': 'Most questions answered accurately with textual support.', '16-20': 'All questions answered with perceptive analysis and well-chosen quotations.', '21-25': 'Exceptional depth and range — every answer explores nuance.' },
      dueAt: daysAgo(14), status: HomeworkStatus.CLOSED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 1, createdBy: created['j.patel'].id,
    },
  })
  await prisma.homework.upsert({
    where:  { id: 'demo-hw-9e-closeread' },
    update: {},
    create: {
      id: 'demo-hw-9e-closeread', schoolId: school.id, classId: cls9.id,
      title: 'Close Reading — Act 1 Opening Scene',
      instructions: 'Read the opening of Act 1 carefully and answer: How does Priestley establish the Birling family as morally flawed? Write two paragraphs — one on staging/setting and one on character dialogue.',
      modelAnswer: 'The ostentatious champagne and celebratory mood of the opening contrast sharply with what the audience will come to learn — that this family is morally bankrupt. Priestley deliberately opens with prosperity to expose it as hollow.',
      gradingBands: { '0-5': 'Descriptive comment on what happens.', '6-10': 'Some link between staging/dialogue and meaning.', '11-15': 'Clear analytical paragraphs with textual detail.', '16-20': 'Insightful structural analysis with language focus.' },
      dueAt: daysAgo(7), status: HomeworkStatus.CLOSED,
      type: HomeworkType.EXTENDED_WRITING, releasePolicy: ReleasePolicy.TEACHER_EXTENDED,
      maxAttempts: 1, createdBy: created['j.patel'].id,
    },
  })
  console.log('  ✓ 3 past 9E/En1 homeworks for Fatima Al-Amin RAG submissions')

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
      // Fatima Al-Amin — SLCN, score 4/9 = 44% → contributes to AMBER RAG status
      { hwId: hwAic.id, studentId: fatimaAlAmin.id,
        content: 'The play was set in 1912 but written in 1945. Priestley wanted people to think about how we treat each other. The Birlings are selfish because they only care about money and their reputation. Priestley thinks this is wrong.',
        status: SubmissionStatus.RETURNED, score: 4, grade: '4',
        feedback: 'Fatima, I can see you have understood the core message about responsibility — well done for identifying the time gap between the setting and writing date. To improve, try to connect this gap to what Priestley was saying to his 1945 audience specifically. What had happened in between? The written vocabulary bank from Monday is in the lesson folder — use it to help you phrase your ideas.',
        tags: ['limited_contextual_detail'], daysAgoSub: 22 },
    ]
    for (const sub of aicSubs) await upsertSub(sub)
    console.log('  ✓ AIC homework: 9 submissions added for 9E/En1 (incl. Fatima Al-Amin)')
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

  // ── Fatima Al-Amin — 3 additional returned submissions for 9E/En1 ──────────
  // Scores: 10/20=50%, 12/25=48%, 11/20=55% → avg with AIC 44% = ~49% → AMBER vs prediction 58%
  const fatimaSubs: SubInput[] = [
    { hwId: 'demo-hw-9e-birling',   studentId: fatimaAlAmin.id,
      content: 'Priestley uses Mr Birling to show that rich people in 1912 thought only about money. He says things like he is not responsible for his workers. This is selfish. Priestley disagrees with this attitude and uses the play to show it is wrong.',
      status: SubmissionStatus.RETURNED, score: 10, grade: '5',
      feedback: 'Fatima, you have identified the key idea that Priestley disagrees with Birling\'s attitudes — that is a strong foundation. To push higher, try to quote Birling\'s exact words (e.g. "a man has to look after himself and his own") and explain the specific language. What does "look after himself" suggest about his values? The sentence-starter sheet is in the lesson folder — use it to structure your analysis.',
      tags: ['quotation_not_used'], daysAgoSub: 20 },
    { hwId: 'demo-hw-9e-quiz',      studentId: fatimaAlAmin.id,
      content: 'Power in AIC is about money. The Inspector has moral power. Mr Birling has money but the Inspector shows he is wrong. Women in the play have less power like Sheila and Eva Smith. Eva Smith is powerless because she is poor and a woman.',
      status: SubmissionStatus.RETURNED, score: 12, grade: '5',
      feedback: 'Fatima, good identification of the different types of power — moral vs financial is exactly the right distinction to make. Your point about Eva Smith being doubly disadvantaged is insightful. For a higher mark, develop one of these ideas with a specific quotation and analyse the language. What does a particular word or phrase tell us about power in the play?',
      tags: ['ideas_underdeveloped'], daysAgoSub: 13 },
    { hwId: 'demo-hw-9e-closeread', studentId: fatimaAlAmin.id,
      content: 'The opening scene shows a wealthy family eating and celebrating. The stage directions say the lighting is pink and intimate which makes them seem comfortable and happy. But we know from the rest of the play that they are not good people. Priestley wants us to notice the contrast between how they look at the start and who they really are. In the dialogue Mr Birling talks a lot about business and money which shows his priorities.',
      status: SubmissionStatus.RETURNED, score: 11, grade: '6',
      feedback: 'Excellent observation on the stage directions, Fatima — "pink and intimate" is exactly the right detail to focus on and your point about contrast is very perceptive. This is your best piece yet. To push to 7–8, analyse the specific word "intimate" — what connotations does it carry, and how does Priestley use lighting to create a false sense of closeness in a family that will later fall apart?',
      tags: [], daysAgoSub: 6 },
  ]
  for (const sub of fatimaSubs) await upsertSub(sub)
  console.log('  ✓ Fatima Al-Amin: 4 submissions total (44%, 50%, 48%, 55%) → avg ~49% → AMBER RAG vs prediction 58%')

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
    { studentId: ragAiden.id,      subject: 'English', baselineScore: 72, source: 'KS2' },
    { studentId: ragMaya.id,       subject: 'English', baselineScore: 68, source: 'KS2' },
    { studentId: ragSophia.id,     subject: 'English', baselineScore: 68, source: 'KS2' },
    { studentId: fatimaAlAmin.id,  subject: 'English', baselineScore: 48, source: 'KS2' },
  ]
  for (const b of baselines9E) {
    await prisma.studentBaseline.upsert({
      where:  { studentId_subject: { studentId: b.studentId, subject: b.subject } },
      update: { baselineScore: b.baselineScore, source: b.source },
      create: { ...b, schoolId: school.id, recordedBy: created['j.patel'].id },
    })
  }

  const predictions9E = [
    { studentId: ragAiden.id,     predictedScore: 75, adjustment: 0, notes: 'Strong analytical writer; on track for Grade 7+' },
    { studentId: ragMaya.id,      predictedScore: 70, adjustment: 0, notes: null },
    { studentId: ragSophia.id,    predictedScore: 72, adjustment: 0, notes: 'Consistent progress; predicted Grade 6–7 range' },
    { studentId: fatimaAlAmin.id, predictedScore: 55, adjustment: 0, notes: 'SLCN — working hard; predicted Grade 4–5 range. Monitor expressive language in extended writing tasks.' },
  ]
  for (const p of predictions9E) {
    await prisma.teacherPrediction.upsert({
      where: { studentId_teacherId_subject_termLabel: { studentId: p.studentId, teacherId: created['j.patel'].id, subject: 'English', termLabel: RAG_TERM } },
      update: { predictedScore: p.predictedScore, adjustment: p.adjustment, notes: p.notes },
      create: { studentId: p.studentId, teacherId: created['j.patel'].id, schoolId: school.id, subject: 'English', termLabel: RAG_TERM, predictedScore: p.predictedScore, adjustment: p.adjustment, notes: p.notes },
    })
  }
  console.log('  ✓ RAG demo data — StudentBaseline × 9, TeacherPrediction × 9, Submission × 5 (8M/Ma1 algebra)')

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

  // ── Section F: Complete SEND Document Chains (Demo quality) ──────────────────
  console.log('\n── Section F: SEND Document Chains ──────────────────────────────────')

  const mLewis = await prisma.user.findUniqueOrThrow({ where: { email: 'm.lewis@omnisdemo.school' } })

  // ── Rehan Ali: update to Dyslexia, add History chain ─────────────────────────

  // 1. Update SendStatus needArea to Dyslexia
  await prisma.sendStatus.update({
    where: { studentId: rehanAli.id },
    data: { needArea: 'Specific Learning Difficulty (Dyslexia)' },
  })

  // 2. Update ILP to Dyslexia-specific content (overwrite the C&I content from earlier)
  await prisma.individualLearningPlan.update({
    where: { id: 'seed-ilp-rehan-ali' },
    data: {
      sendCategory: 'SEN_SUPPORT',
      currentStrengths: 'Enthusiastic learner who contributes well to class discussions. Strong auditory memory — retains content delivered verbally very effectively. Good spatial reasoning and visual pattern recognition. Responds very positively to encouragement and achieves well in practical activities.',
      areasOfNeed: 'Phonological processing and reading fluency — significant difficulty decoding multi-syllabic and subject-specific vocabulary. Extended written responses are brief and lack structure without explicit scaffolding. Working memory under time pressure impacts test performance.',
      strategies: [
        'Provide printed copies of board notes before the lesson begins',
        'Allow use of coloured overlay — Rehan uses blue',
        'Pre-teach key vocabulary using visual word-image matching cards before each new topic',
        'Provide a PEEL writing frame for all extended writing tasks in every subject',
        'Allow 25% extra time on all timed tasks and assessments',
      ],
      successCriteria: 'Independently structure a four-paragraph historical essay using a PEEL writing frame by end of Summer term, with no verbal prompting from teacher.',
      reviewDate: new Date('2026-07-10'),
    },
  })

  // 3. Add Dyslexia-specific ILP targets
  await prisma.ilpTarget.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'seed-ilpt-rehan-dys-1',
        ilpId: 'seed-ilp-rehan-ali',
        target: 'Use a coloured overlay and audio support to read and understand primary sources independently in History',
        strategy: 'Blue overlay provided in every lesson. Audio versions of key texts on class shared drive. Rehan pre-reads sources at home using audio before classroom discussion.',
        successMeasure: 'Independently reads and annotates 3 primary sources with overlay in class without teacher prompting, on 3 consecutive lessons.',
        targetDate: new Date('2026-06-30'),
        status: 'active',
      },
      {
        id: 'seed-ilpt-rehan-dys-2',
        ilpId: 'seed-ilp-rehan-ali',
        target: 'Produce a structured 4-paragraph essay response using a PEEL writing frame independently',
        strategy: 'PEEL frame provided before every extended writing task. Teacher models use in lesson starter. Rehan highlights each section before writing.',
        successMeasure: 'Produces a full PEEL essay with frame independently, no verbal prompting, on 3 consecutive extended tasks.',
        targetDate: new Date('2026-06-30'),
        status: 'active',
      },
      {
        id: 'seed-ilpt-rehan-dys-3',
        ilpId: 'seed-ilp-rehan-ali',
        target: 'Create visual mind maps to organise and retain key historical knowledge independently for revision',
        strategy: 'Mind maps created using colour coding per topic. Fortnightly mind-mapping session with SENCO. Maps shared with parents via parent portal for home revision.',
        successMeasure: 'Produces a complete, colour-coded mind map for 3 consecutive topics without teacher support.',
        targetDate: new Date('2026-07-10'),
        status: 'active',
      },
    ],
  })

  // 4. Update K Plan with specific Dyslexia strategies
  await prisma.learnerPassport.update({
    where: { id: 'seed-kplan-rehan-ali' },
    data: {
      sendInformation: 'Rehan has Specific Learning Difficulties (Dyslexia) affecting phonological processing, reading fluency, and written output under time pressure. He has a strong auditory learning style and benefits from verbal explanations paired with written supports. He uses a blue coloured overlay in all lessons. Parents are engaged and supportive of home revision strategies.',
      teacherActions: [
        'Provide printed copies of board notes before lesson',
        'Allow use of coloured overlay — Rehan uses blue',
        'Seat away from windows to reduce visual distraction',
        'Give written instructions alongside verbal — never verbal only',
        'Allow 25% extra time on all timed tasks',
      ],
    },
  })

  // 5. Enroll Rehan in History class 8/Hi1
  await prisma.enrolment.upsert({
    where:  { classId_userId: { classId: 'demo-class-8-Hi1', userId: rehanAli.id } },
    update: {},
    create: { classId: 'demo-class-8-Hi1', userId: rehanAli.id },
  })

  // 6. History baselines and predictions for Rehan
  await prisma.studentBaseline.upsert({
    where:  { studentId_subject: { studentId: rehanAli.id, subject: 'History' } },
    update: { baselineScore: 52, source: 'KS2' },
    create: { studentId: rehanAli.id, subject: 'History', baselineScore: 52, source: 'KS2', schoolId: school.id, recordedBy: created['r.morris'].id },
  })
  await prisma.teacherPrediction.upsert({
    where: { studentId_teacherId_subject_termLabel: { studentId: rehanAli.id, teacherId: mLewis.id, subject: 'History', termLabel: RAG_TERM } },
    update: { predictedScore: 58, adjustment: 0 },
    create: { studentId: rehanAli.id, teacherId: mLewis.id, schoolId: school.id, subject: 'History', termLabel: RAG_TERM, predictedScore: 58, adjustment: 0, notes: 'Strong verbal ability; written output held back by SpLD. Predicted Grade 4–5 with scaffolding. On track.' },
  })

  // 7. History homework (3 assignments for ILP evidence chain)
  const hwNorman = await prisma.homework.upsert({
    where:  { id: 'demo-hw-8h-norman' },
    update: {},
    create: {
      id: 'demo-hw-8h-norman', schoolId: school.id, classId: 'demo-class-8-Hi1',
      title: 'The Norman Conquest — How Did It Change England?',
      instructions: 'Explain how the Norman Conquest of 1066 changed England. Write two paragraphs: one on political changes and one on cultural and language changes. Use at least one piece of evidence from the lesson in each paragraph.',
      modelAnswer: 'The Norman Conquest transformed England politically by replacing Anglo-Saxon nobility with Norman lords. William imposed the feudal system, redistributing land to his loyal followers who owed him military service. The Domesday Book (1086) recorded all landholdings in England, demonstrating the extent to which Norman lords had replaced Saxon thegns.\n\nCulturally, the Conquest had a lasting impact on the English language. Norman French became the language of the court and educated classes, introducing hundreds of new words. Today words like "beef", "pork" and "justice" come from French, while "cow", "pig" and "right" survive from Old English — reflecting the class division between Norman rulers and Saxon peasants.',
      gradingBands: { '0-2': 'Minimal response with no evidence.', '3-4': 'Some relevant points with limited evidence.', '5-6': 'Clear response with relevant evidence and developing explanation.', '7-8': 'Well-structured response with strong evidence and clear explanation.', '9': 'Detailed, analytical response with precise evidence and insightful conceptual links.' },
      dueAt: daysAgo(28), status: HomeworkStatus.CLOSED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 1, createdBy: mLewis.id,
    },
  })

  const hwWWI = await prisma.homework.upsert({
    where:  { id: 'demo-hw-8h-wwi' },
    update: {},
    create: {
      id: 'demo-hw-8h-wwi', schoolId: school.id, classId: 'demo-class-8-Hi1',
      title: 'Causes of World War I — How Far Was Germany to Blame?',
      instructions: 'Write two paragraphs arguing either for or against the view that Germany was mainly to blame for the outbreak of World War I. Use evidence from your lesson notes to support your arguments.',
      modelAnswer: 'Germany bears significant responsibility for the outbreak of WWI. The "blank cheque" of unconditional support given to Austria-Hungary in July 1914 gave Austria the confidence to issue a harsh ultimatum to Serbia, escalating a regional crisis into a world war. Germany\'s military planning (the Schlieffen Plan) also required a rapid attack on France through neutral Belgium, which brought Britain into the war and transformed a European conflict into a global one.\n\nHowever, to blame Germany alone oversimplifies a complex situation. Austria-Hungary\'s aggressive ultimatum to Serbia, Russia\'s rapid mobilisation, France\'s inflexible alliance commitments, and Britain\'s ambiguous signals all contributed. The alliance system created a situation where a single assassination could trigger a catastrophic chain reaction across Europe.',
      gradingBands: { '0-2': 'Limited response.', '3-4': 'One side argued with basic evidence.', '5-6': 'Both arguments with some evidence.', '7-8': 'Balanced response with strong evidence and clear judgement.', '9': 'Sophisticated analysis of multiple causes with precise evidence and confident conclusion.' },
      dueAt: daysAgo(14), status: HomeworkStatus.CLOSED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 1, createdBy: mLewis.id,
    },
  })

  const hwMedicine = await prisma.homework.upsert({
    where:  { id: 'demo-hw-8h-medicine' },
    update: {},
    create: {
      id: 'demo-hw-8h-medicine', schoolId: school.id, classId: 'demo-class-8-Hi1',
      title: 'Medieval Medicine — Why Did People Have Such Strange Beliefs?',
      instructions: 'Explain why people in the Middle Ages believed in treatments like bloodletting and herbal remedies. Write two paragraphs: one on the role of the Church and one on the influence of Galen.',
      modelAnswer: 'The Church had enormous influence over medical thinking in the Middle Ages. It discouraged dissection of human bodies as sinful, which prevented doctors from learning anatomy. The Church promoted the idea that illness was God\'s punishment for sin, meaning prayer and pilgrimage were considered effective treatments. Hospitals were run by monks and nuns who prioritised spiritual care over scientific investigation.\n\nThe ancient Greek doctor Galen\'s writings were treated as absolute authority throughout the Middle Ages. Galen\'s theory of the Four Humours — that disease was caused by an imbalance of blood, phlegm, yellow bile and black bile — dominated medical practice for over 1,000 years. Bloodletting (removing blood to rebalance the humours) was a standard treatment, even though it often weakened patients further.',
      gradingBands: { '0-2': 'Minimal response.', '3-4': 'One factor explained.', '5-6': 'Both factors with some evidence.', '7-8': 'Both factors with strong evidence and links.', '9': 'Detailed analysis of both factors with precise evidence and sophisticated explanation.' },
      dueAt: daysAgo(7), status: HomeworkStatus.CLOSED,
      type: HomeworkType.SHORT_ANSWER, releasePolicy: ReleasePolicy.AUTO_OBJECTIVE,
      maxAttempts: 1, createdBy: mLewis.id,
    },
  })

  // 8. Rehan's History submissions
  const rehanNormanSub = await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hwNorman.id, studentId: rehanAli.id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: hwNorman.id, studentId: rehanAli.id,
      content: 'The Normans changed England by taking over the land. William gave land to his followers who had to fight for him in return. The Domesday Book shows all the land that was owned. The English language also changed because French words came into English. Words like beef and pork come from French while cow and pig are old English which shows the class divide.',
      status: SubmissionStatus.RETURNED,
      submittedAt: daysAgo(25), markedAt: daysAgo(23),
      teacherScore: 6, finalScore: 6, grade: '6',
      feedback: 'Rehan, you have identified both political and cultural change and included specific evidence from the Domesday Book — well done. Your point about the language divide between "beef/pork" and "cow/pig" is perceptive and shows real historical thinking. To push to 7–8, use your PEEL frame more explicitly — make sure your explanation tells us WHY the feudal system was significant, not just what it was. The PEEL frame is in the lesson folder.',
      integrityReviewed: true,
    },
  })

  const rehanWwiSub = await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hwWWI.id, studentId: rehanAli.id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: hwWWI.id, studentId: rehanAli.id,
      content: 'Germany was to blame for WWI because they gave Austria the blank cheque support. This meant Austria could be aggressive to Serbia. Germany also had the Schlieffen Plan which meant they had to attack France through Belgium. This brought Britain in.\n\nBut other countries also played a role. Austria-Hungary sent the harsh ultimatum. Russia mobilised quickly. The alliance system meant one thing led to another.',
      status: SubmissionStatus.RETURNED,
      submittedAt: daysAgo(11), markedAt: daysAgo(9),
      teacherScore: 5, finalScore: 5, grade: '5',
      feedback: 'Rehan, you have shown both sides of the argument — that is exactly the right structure for a "How far" question. Well done for including the blank cheque and Schlieffen Plan as evidence. To improve, develop your second paragraph — why exactly did the alliance system cause problems? The writing frame helped here: your first paragraph follows PEEL closely but the second needs a clearer explanation sentence. Good effort.',
      integrityReviewed: true,
    },
  })

  const rehanMedSub = await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hwMedicine.id, studentId: rehanAli.id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: hwMedicine.id, studentId: rehanAli.id,
      content: 'The Church controlled medicine in the Middle Ages because they ran the hospitals and thought illness was a punishment from God. This meant people prayed instead of looking for scientific reasons. Doctors were not allowed to cut up bodies so they could not learn anatomy properly.\n\nGalen was a Greek doctor whose ideas were used for over 1000 years. He believed in the Four Humours — blood, phlegm, yellow bile and black bile. If these were out of balance you got ill. Bloodletting was used to fix this by removing blood but this often made people worse. However nobody questioned Galen because the Church said his ideas were correct.',
      status: SubmissionStatus.RETURNED,
      submittedAt: daysAgo(4), markedAt: daysAgo(2),
      teacherScore: 7, finalScore: 7, grade: '7',
      feedback: 'Excellent work, Rehan — this is your best response so far. You have used the PEEL structure independently in both paragraphs and your explanation of WHY bloodletting was still used (Church authority supporting Galen) shows sophisticated historical thinking. The link between Church authority and Galen\'s longevity is exactly the kind of analytical writing I have been asking for. Keep this up.',
      integrityReviewed: true,
    },
  })

  // 9. ILP Evidence entries for Rehan
  await prisma.ilpEvidenceEntry.upsert({
    where:  { submissionId_ilpTargetId: { submissionId: rehanNormanSub.id, ilpTargetId: 'seed-ilpt-rehan-dys-2' } },
    update: {},
    create: {
      schoolId: school.id, studentId: rehanAli.id,
      ilpTargetId: 'seed-ilpt-rehan-dys-2', submissionId: rehanNormanSub.id,
      homeworkTitle: hwNorman.title, subject: 'History', score: 6, maxScore: 9,
      evidenceType: 'PROGRESS',
      aiSummary: 'Rehan\'s response demonstrates developing essay structure. He includes specific historical evidence (Domesday Book, French/English vocabulary divide) and makes a perceptive conceptual link. This represents PROGRESS against Target 2 (structured written responses using PEEL). Some prompting from the writing frame is still evident but the analytical content quality exceeds expectations for this stage.',
      createdBy: mLewis.id,
    },
  })
  await prisma.ilpEvidenceEntry.upsert({
    where:  { submissionId_ilpTargetId: { submissionId: rehanWwiSub.id, ilpTargetId: 'seed-ilpt-rehan-dys-2' } },
    update: {},
    create: {
      schoolId: school.id, studentId: rehanAli.id,
      ilpTargetId: 'seed-ilpt-rehan-dys-2', submissionId: rehanWwiSub.id,
      homeworkTitle: hwWWI.title, subject: 'History', score: 5, maxScore: 9,
      evidenceType: 'NEUTRAL',
      aiSummary: 'Two-sided response but explanation sentences in both paragraphs remain underdeveloped. Rehan correctly identified key evidence (blank cheque, Schlieffen Plan) but the analytical depth needed for Target 2 is not yet consistently present. NEUTRAL — on track for the target but scaffolding still required for complex causation questions.',
      createdBy: mLewis.id,
    },
  })
  await prisma.ilpEvidenceEntry.upsert({
    where:  { submissionId_ilpTargetId: { submissionId: rehanMedSub.id, ilpTargetId: 'seed-ilpt-rehan-dys-2' } },
    update: {},
    create: {
      schoolId: school.id, studentId: rehanAli.id,
      ilpTargetId: 'seed-ilpt-rehan-dys-2', submissionId: rehanMedSub.id,
      homeworkTitle: hwMedicine.title, subject: 'History', score: 7, maxScore: 9,
      evidenceType: 'PROGRESS',
      aiSummary: 'Clear improvement in paragraph structure — PEEL framework used independently in both paragraphs for the first time. Teacher noted "best response so far" and the analytical link between Church authority and Galen\'s longevity shows sophisticated thinking. PROGRESS: Rehan is now meeting Target 2 expectations consistently in a structured task. One more independent performance will meet the success measure.',
      teacherNote: 'Rehan came to see me at lunch before this homework was due and asked for help starting his second paragraph. After a brief 5-minute conversation about the link between Church authority and Galen, he completed the paragraph independently at home. Real evidence of growing confidence.',
      createdBy: mLewis.id,
    },
  })

  // 10. EHCP for Rehan (full mock with Section B, F, I)
  await prisma.ehcpPlan.upsert({
    where:  { id: 'seed-ehcp-rehan-ali' },
    update: {},
    create: {
      id: 'seed-ehcp-rehan-ali', schoolId: school.id,
      studentId: rehanAli.id, createdBy: created['r.morris'].id,
      localAuthority: 'Oakfield Metropolitan Borough Council',
      planDate: new Date('2025-09-01'), reviewDate: new Date('2026-07-10'),
      coordinatorName: 'Ms J. Freeman (SEND Coordinator, Oakfield LA)',
      status: 'active', approvedBySenco: true,
      outcomes: {
        create: [
          {
            section: 'B',
            outcomeText: 'Rehan has Specific Learning Difficulties (Dyslexia) affecting phonological processing, reading fluency, and written language production. Standardised reading assessment (November 2025) places his reading age at approximately 9 years 6 months (chronological age 12 years 8 months), at the 4th percentile. His non-verbal reasoning (Matrices, CATs) is at the 62nd percentile, confirming significant discrepancy between cognitive ability and written output. Working memory under timed conditions is a particular challenge. Rehan does not have co-occurring ADHD or ASD. He is highly motivated and responds positively to structured support.',
            successCriteria: 'Standardised reading assessment at or above the 15th percentile at annual review (July 2026). Teacher-assessed writing quality at age-related expectations with scaffolding.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'Standardised SpLD assessment to be repeated annually. Educational Psychologist review by July 2027.',
            status: 'active', evidenceCount: 3,
          },
          {
            section: 'F',
            outcomeText: 'Provision 1: Coloured overlay (blue) provided in all lessons and examinations.',
            successCriteria: 'Overlay in use in all subjects; reading fluency measured at next annual review.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'Blue overlays supplied by SENCO at start of each academic year. All invigilators briefed.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Provision 2: 25% extra time granted for all timed assessments and formal tests, effective from 20 January 2026.',
            successCriteria: 'All assessments administered with 25% extra time. Access arrangement form on file with exams officer.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'School Access Arrangements coordinator to file Form 8 with JCQ. Annual renewal required.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Provision 3: Printed copies of board notes and lesson resources provided before each lesson in all subjects.',
            successCriteria: 'Teacher confirmation at each half-term review that notes are being provided consistently.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'All subject teachers briefed at INSET. Resources uploaded to student portal by lesson start.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Provision 4: Subject-specific vocabulary pre-teaching using visual word-image matching cards before each new unit.',
            successCriteria: 'Vocabulary cards produced for History, English, and Science. Student uses cards independently in assessments.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'SENCO to produce vocabulary card templates. Subject teachers to populate. Review at each unit start.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Provision 5: PEEL writing frame provided for all extended writing tasks in every subject.',
            successCriteria: 'Three consecutive extended responses produced using PEEL frame independently by July 2026.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'PEEL frames printed and available in class sets. Teacher models use in every extended writing lesson.',
            status: 'active', evidenceCount: 3,
          },
          {
            section: 'F',
            outcomeText: 'Provision 6: Fortnightly mind-mapping revision sessions with SENCO. Mind maps shared with parents via Omnis parent portal.',
            successCriteria: 'At least 12 mind-mapping sessions completed by July 2026. Parent engagement confirmed at each termly review.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'SENCO timetable to include 30-minute fortnightly slot with Rehan. Parent portal notifications set up.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'I',
            outcomeText: 'Rehan Ali will be educated at Omnis Demo Secondary School, Oakfield. The school has been identified as the appropriate placement based on specialist SEND provision available and parental preference.',
            successCriteria: 'Placement reviewed at annual review. Any change of placement to be agreed by LA, school, and parents.',
            targetDate: new Date('2026-07-10'),
            provisionRequired: 'School to confirm continued SEND provision capacity annually. LA to review placement if needs change significantly.',
            status: 'active', evidenceCount: 0,
          },
        ],
      },
    },
  })

  // 11. APDR (Assess, Plan, Do, Review) cycle for Rehan
  await prisma.assessPlanDoReview.upsert({
    where:  { id: 'seed-apdr-rehan-ali' },
    update: {},
    create: {
      id: 'seed-apdr-rehan-ali', schoolId: school.id, studentId: rehanAli.id,
      cycleNumber: 1,
      assessContent: `ASSESS — Spring Term 2026\n\nRehan Ali is a Year 8 student with a confirmed diagnosis of Specific Learning Difficulty (Dyslexia). KS2 baseline reading score is at the 4th percentile for his age group (reading age ≈ 9y 6m against chronological age of 12y 8m). Non-verbal CATs score is at the 62nd percentile, confirming a significant discrepancy between cognitive ability and written output — a hallmark of dyslexia.\n\nIn History (his target subject for this APDR cycle): most recent assessed piece scored 6/9 (Norman Conquest). In Maths, Rehan is performing at the 65th percentile for his class — much stronger — confirming that the primary barrier is written language processing.\n\nStrengths: Enthusiastic, verbally articulate, strong auditory recall. Responds very well to adult encouragement. Has not missed a single session of additional support.\n\nAreas for focus this cycle: (1) Reading fluency using overlay; (2) Structured extended writing using PEEL frame; (3) Independent revision strategies using visual mind maps.`,
      planContent: `PLAN — Spring Term 2026\n\n1. READING SUPPORT\nBlue coloured overlay provided in all lessons and examinations from 20 January 2026. Audio versions of key History texts uploaded to shared class drive. Rehan to pre-read sources at home using audio before classroom discussion. Target: read and annotate 3 primary sources independently in each History unit.\n\n2. WRITING SUPPORT\nPEEL writing frame provided in ALL subjects before every extended writing task — not just History. All form tutors and subject teachers briefed at January INSET. Frame to be modelled in every lesson starter where extended writing is expected. Rehan to highlight each PEEL section in frame before starting.\n\n3. VOCABULARY PRE-TEACHING\nSubject-specific vocabulary card produced for History units: Norman Conquest (10 keywords), WWI Causes (12 keywords), Medieval Medicine (10 keywords). Cards on Rehan's desk during all History lessons and assessments.\n\n4. 25% EXTRA TIME\nAccess Arrangements Form 8 submitted to exams office 20 January 2026 (copy on file in SENCO office). All subject teachers notified. Applies to all timed in-class assessments from this date.\n\n5. MIND-MAPPING SESSIONS\nFortnightly 30-minute sessions with SENCO scheduled for Tuesdays 12:30–1:00. Colour-coded A3 topic maps to be created for each History unit. Photos shared with parents via Omnis parent portal after each session.\n\n6. REVIEW DATE: 30 June 2026. Mid-cycle check-in with form tutor scheduled for 31 March 2026.`,
      doContent: `DO — Implementation notes (January–March 2026)\n\n✓ All subject teachers briefed at January INSET Day (20 Jan). Confirmation emails from History (Mr Lewis), English (Mr Patel), Science (Ms Ahmed), Maths (Ms Wright) received.\n\n✓ Blue overlay confirmed in use — Rehan is consistently using it in all lessons as of February 2026. History teacher confirms overlay improves reading pace noticeably during source work.\n\n✓ 25% extra time applied to all assessments from 20 January. History SAC form submitted to exams officer.\n\n✓ PEEL writing frames in use: confirmed by History (3 assessed tasks) and English (2 assessed tasks). Maths not applicable.\n\n✓ Vocabulary cards produced for Norman Conquest and WWI units. Rehan reported finding the cards "really useful" during Norman assessment.\n\n✓ Mind-mapping sessions: 3 sessions completed (3 Feb, 17 Feb, 3 Mar). Topics covered: Norman Conquest, Anglo-Saxon England. Rehan produced colour-coded maps for both. Parents confirmed receiving photo via portal.\n\n⚠ Note: Rehan missed one session (17 Feb) due to a field trip — rescheduled to 24 Feb. Otherwise consistent attendance at all sessions.`,
      reviewContent: '',
      status: 'ACTIVE',
      reviewDate: new Date('2026-06-30'),
      createdBy: created['r.morris'].id,
      approvedBySenco: true,
      approvedAt: new Date('2026-01-22'),
      approvedBy: created['r.morris'].id,
    },
  })

  console.log('  ✓ Rehan Ali: Dyslexia profile updated, History chain (3 homeworks, 3 submissions, 3 ILP evidence entries), EHCP, APDR')

  // ── Caitlin Harris: ADHD profile + History chain ──────────────────────────────

  // 1. Create/update SendStatus for Caitlin (currently no SendStatus)
  await prisma.sendStatus.upsert({
    where:  { studentId: caitlinHarris.id },
    update: { activeStatus: SendStatusValue.SEN_SUPPORT, needArea: 'Attention Deficit Hyperactivity Disorder (ADHD)' },
    create: { studentId: caitlinHarris.id, activeStatus: SendStatusValue.SEN_SUPPORT, activeSource: 'SENCO', needArea: 'Attention Deficit Hyperactivity Disorder (ADHD)' },
  })

  // 2. ILP for Caitlin
  const caitlinIlp = await prisma.individualLearningPlan.upsert({
    where:  { id: 'seed-ilp-caitlin-harris' },
    update: {},
    create: {
      id: 'seed-ilp-caitlin-harris', schoolId: school.id, studentId: caitlinHarris.id,
      createdBy: created['r.morris'].id,
      sendCategory: 'SEN_SUPPORT',
      currentStrengths: 'High energy and enthusiasm when engaged with a topic. Creative thinker who generates original ideas quickly. Responds well to movement, variety, and hands-on tasks. Can produce strong work in short, focused bursts.',
      areasOfNeed: 'Sustained attention — difficulty maintaining focus for more than 10–15 minutes without a structured break or change of activity. Impulsive responses in class (calling out, off-task behaviour). Emotional regulation — can become frustrated when tasks feel too long or ambiguous. Homework completion is inconsistent.',
      strategies: [
        'Use a visible timer — tasks should be chunked into 10–12 minute focused blocks',
        'Provide a task checklist so Caitlin can tick off stages and see progress',
        'Allow brief movement breaks between task stages (e.g. hand out resources, sharpen pencil)',
        'Give brief, clear instructions — no more than 2 steps at a time',
        'Seat away from peers most likely to cause distraction, ideally near the teacher',
      ],
      successCriteria: 'Maintain on-task behaviour for at least 3 consecutive 10-minute focused blocks per lesson, as recorded by teacher in fortnightly observation log, by end of Summer term.',
      reviewDate: new Date('2026-06-20'),
      status: 'active', parentConsent: true,
    },
  })

  // 3. K Plan for Caitlin
  await prisma.learnerPassport.upsert({
    where:  { id: 'seed-kplan-caitlin-harris' },
    update: {},
    create: {
      id: 'seed-kplan-caitlin-harris', schoolId: school.id, studentId: caitlinHarris.id,
      ilpId: caitlinIlp.id,
      sendInformation: 'Caitlin has Attention Deficit Hyperactivity Disorder (ADHD, combined presentation). Diagnosed by community paediatrician November 2024. Not currently on medication. Attention difficulties are most pronounced in extended written or reading tasks. She is socially confident, creative, and highly engaged when tasks are varied and time-limited. Parents are fully engaged and have provided useful home strategies.',
      teacherActions: [
        'Use a visible countdown timer — chunk tasks into 10–12 minute focused blocks',
        'Provide a printed task checklist so Caitlin can track her progress',
        'Allow brief movement breaks between stages (e.g. hand out resources)',
        'Give no more than 2 steps of instruction at a time — check understanding before giving more',
        'Seat near the teacher, away from high-distraction peers',
      ],
      studentCommitments: [
        'Use the task checklist to focus on one stage at a time',
        'Use the fidget tool quietly during whole-class explanations',
        'Ask the teacher if feeling overwhelmed rather than going off-task',
      ],
      status: 'APPROVED', approvedBy: created['r.morris'].id, approvedAt: new Date('2026-01-20'),
    },
  })

  // 4. ILP targets for Caitlin
  await prisma.ilpTarget.createMany({
    skipDuplicates: true,
    data: [
      {
        id: 'seed-ilpt-caitlin-h-1', ilpId: caitlinIlp.id,
        target: 'Remain on-task for three consecutive 10-minute focused blocks per lesson using a visible timer',
        strategy: 'Countdown timer (physical or digital) visible on desk. Tasks pre-chunked into 10-minute blocks with checklist. Teacher acknowledges completion of each block.',
        successMeasure: 'Teacher observation log records 3+ on-task blocks in at least 3 out of 5 lessons over 2 consecutive weeks.',
        targetDate: new Date('2026-06-20'), status: 'active',
      },
      {
        id: 'seed-ilpt-caitlin-h-2', ilpId: caitlinIlp.id,
        target: 'Complete at least 3 out of 5 homework tasks per half-term and submit on time',
        strategy: 'Homework broken into short daily chunks on a completion timetable. Parents send a weekly check-in message to form tutor. Partial submissions accepted.',
        successMeasure: '3+ homework tasks submitted per half-term to any standard.',
        targetDate: new Date('2026-06-20'), status: 'active',
      },
      {
        id: 'seed-ilpt-caitlin-h-3', ilpId: caitlinIlp.id,
        target: 'Use a calming strategy (deep breathing or exit card) when feeling frustrated before behaviour escalates',
        strategy: 'Exit card provided. Breathing strategy modelled in PSHE. Caitlin uses "thumb signal" to alert teacher to rising frustration.',
        successMeasure: 'No more than 1 significant emotional dysregulation incident per half-term (recorded in pastoral log) by end of Summer term.',
        targetDate: new Date('2026-06-20'), status: 'active',
      },
    ],
  })

  // 5. Enroll Caitlin in History 8/Hi1
  await prisma.enrolment.upsert({
    where:  { classId_userId: { classId: 'demo-class-8-Hi1', userId: caitlinHarris.id } },
    update: {},
    create: { classId: 'demo-class-8-Hi1', userId: caitlinHarris.id },
  })

  // 6. History baseline and prediction for Caitlin
  await prisma.studentBaseline.upsert({
    where:  { studentId_subject: { studentId: caitlinHarris.id, subject: 'History' } },
    update: { baselineScore: 61, source: 'KS2' },
    create: { studentId: caitlinHarris.id, subject: 'History', baselineScore: 61, source: 'KS2', schoolId: school.id, recordedBy: created['r.morris'].id },
  })
  await prisma.teacherPrediction.upsert({
    where: { studentId_teacherId_subject_termLabel: { studentId: caitlinHarris.id, teacherId: mLewis.id, subject: 'History', termLabel: RAG_TERM } },
    update: { predictedScore: 65, adjustment: 0 },
    create: { studentId: caitlinHarris.id, teacherId: mLewis.id, schoolId: school.id, subject: 'History', termLabel: RAG_TERM, predictedScore: 65, adjustment: 0, notes: 'Capable student; ADHD affects consistency. Predicted Grade 5 with support. On target when engaged.' },
  })

  // 7. Caitlin's History submissions (same homeworks as Rehan)
  const caitlinNormanSub = await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hwNorman.id, studentId: caitlinHarris.id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: hwNorman.id, studentId: caitlinHarris.id,
      content: 'William gave land to his barons and knights who had to provide soldiers. This was called the feudal system. The Domesday Book listed all the land. French became the posh language and English was for peasants. Beef and pork are French words because Normans ate the animals that peasants raised.',
      status: SubmissionStatus.RETURNED,
      submittedAt: daysAgo(25), markedAt: daysAgo(23),
      teacherScore: 5, finalScore: 5, grade: '5',
      feedback: 'Caitlin, some really good points here — the language observation about French/English words is excellent and shows original thinking. Your first paragraph identifies the feudal system but doesn\'t develop the explanation — WHY was the feudal system significant for England? Use the PEEL frame to structure your explanation sentence. The task checklist I gave you has the PEEL structure on the back.',
      integrityReviewed: true,
    },
  })

  const caitlinWwiSub = await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hwWWI.id, studentId: caitlinHarris.id } },
    update: {},
    create: {
      schoolId: school.id, homeworkId: hwWWI.id, studentId: caitlinHarris.id,
      content: 'Germany was mainly to blame because of the blank cheque and the Schlieffen Plan. These show Germany wanted war. Also the alliance system made it worse.',
      status: SubmissionStatus.RETURNED,
      submittedAt: daysAgo(11), markedAt: daysAgo(9),
      teacherScore: 3, finalScore: 3, grade: '3',
      feedback: 'Caitlin, I can see you know the key facts (blank cheque, Schlieffen Plan) but the response is very brief — only 3 sentences when the task asked for two paragraphs. I know this was submitted late and you told me you ran out of time. For next time, break the task into two separate sessions using the checklist: 15 minutes on paragraph 1, then a break, then 15 minutes on paragraph 2. I believe you can produce a 5–6 response if you use the chunking strategy.',
      integrityReviewed: true,
    },
  })

  // 8. ILP Evidence for Caitlin (1 CONCERN, 1 PROGRESS)
  await prisma.ilpEvidenceEntry.upsert({
    where:  { submissionId_ilpTargetId: { submissionId: caitlinWwiSub.id, ilpTargetId: 'seed-ilpt-caitlin-h-2' } },
    update: {},
    create: {
      schoolId: school.id, studentId: caitlinHarris.id,
      ilpTargetId: 'seed-ilpt-caitlin-h-2', submissionId: caitlinWwiSub.id,
      homeworkTitle: hwWWI.title, subject: 'History', score: 3, maxScore: 9,
      evidenceType: 'CONCERN',
      aiSummary: 'Submission is significantly below the expected standard for the assessed piece — 3 sentences against a 2-paragraph requirement. Student acknowledged running out of time. This represents a CONCERN against Target 2 (homework completion). The task required extended written response which aligns with known ADHD-related difficulty with sustained effort. Chunking strategy was not applied. Teacher follow-up recommended.',
      teacherNote: 'Caitlin said she "started late and ran out of steam." This is a consistent pattern. Discussed the break-and-chunk approach again. Will check in at the start of the next homework deadline.',
      createdBy: mLewis.id,
    },
  })
  await prisma.ilpEvidenceEntry.upsert({
    where:  { submissionId_ilpTargetId: { submissionId: caitlinNormanSub.id, ilpTargetId: 'seed-ilpt-caitlin-h-2' } },
    update: {},
    create: {
      schoolId: school.id, studentId: caitlinHarris.id,
      ilpTargetId: 'seed-ilpt-caitlin-h-2', submissionId: caitlinNormanSub.id,
      homeworkTitle: hwNorman.title, subject: 'History', score: 5, maxScore: 9,
      evidenceType: 'PROGRESS',
      aiSummary: 'A complete 2-paragraph response submitted on time — this is itself PROGRESS against Target 2. Content includes specific evidence (feudal system, Domesday Book, French/English vocabulary) and an original analytical observation. The language point about "beef/pork vs cow/pig" shows genuine historical thinking that goes beyond surface description. PROGRESS: homework submitted on time with sustained effort evident.',
      createdBy: mLewis.id,
    },
  })

  // 9. EHCP for Caitlin Harris (ADHD with emotional regulation needs)
  await prisma.ehcpPlan.upsert({
    where:  { id: 'seed-ehcp-caitlin-harris' },
    update: {},
    create: {
      id: 'seed-ehcp-caitlin-harris', schoolId: school.id,
      studentId: caitlinHarris.id, createdBy: created['r.morris'].id,
      localAuthority: 'Oakfield Metropolitan Borough Council',
      planDate: new Date('2025-09-01'), reviewDate: new Date('2026-06-20'),
      coordinatorName: 'Ms J. Freeman (SEND Coordinator, Oakfield LA)',
      status: 'active', approvedBySenco: true,
      outcomes: {
        create: [
          {
            section: 'B',
            outcomeText: 'Caitlin has Attention Deficit Hyperactivity Disorder (ADHD, combined presentation), diagnosed by a community paediatrician in November 2024. She is not currently on medication; parents have declined medication pending a trial period of non-pharmacological support. Assessments show significant difficulty sustaining attention for more than 10–15 minutes without breaks, and impulsive behavioural responses under frustration. Working memory and processing speed are at the 35th and 40th percentiles respectively (CATs, September 2025). Academically, Caitlin is capable of strong work in short, focused bursts — her verbal contributions in class are frequently above the standard of her written output, suggesting the written modality is particularly affected.',
            successCriteria: 'Teacher and SENCO observation log shows sustained on-task behaviour improving from baseline 1–2 blocks (10 mins each) to 3+ blocks per lesson by July 2026.',
            targetDate: new Date('2026-06-20'),
            provisionRequired: 'Fortnightly SENCO observation visits to History and English. Behaviour observation log maintained. Review at each half-term.',
            status: 'active', evidenceCount: 2,
          },
          {
            section: 'C',
            outcomeText: 'Caitlin will use two self-regulation strategies (exit card, deep breathing) when experiencing rising frustration before behaviour escalates to disruption.',
            successCriteria: 'Pastoral log records no more than 1 significant emotional dysregulation incident per half-term by July 2026.',
            targetDate: new Date('2026-06-20'),
            provisionRequired: 'Exit card system in place in all classrooms. PSHE-delivered emotional regulation module (Spring term). Weekly pastoral check-in with form tutor.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'All teachers to use a visible countdown timer and chunked task structure (10–12 minute blocks) for all lessons involving Caitlin.',
            successCriteria: 'All subject teachers confirm timer and chunked tasks in use at each half-term review meeting.',
            targetDate: new Date('2026-06-20'),
            provisionRequired: 'Physical countdown timers provided by SENCO for each classroom. All teachers briefed on chunking strategy at INSET. Task checklists produced for each subject.',
            status: 'active', evidenceCount: 0,
          },
          {
            section: 'F',
            outcomeText: 'Homework to be broken into short daily sessions on a completion timetable shared between school and parents via the Omnis parent portal.',
            successCriteria: 'Caitlin submits at least 3 out of 5 homework tasks per half-term. Submission rate measured each half-term.',
            targetDate: new Date('2026-06-20'),
            provisionRequired: 'Homework completion timetable produced by form tutor. Uploaded to parent portal. Weekly parent check-in message from form tutor.',
            status: 'active', evidenceCount: 2,
          },
        ],
      },
    },
  })

  console.log('  ✓ Caitlin Harris: ADHD profile, ILP, K Plan, History chain (2 submissions, 2 ILP evidence entries), EHCP')

  // ── Fatima Al-Amin: 2 ILP evidence entries from existing submissions ──────────
  const fatimaUser = await prisma.user.findUniqueOrThrow({ where: { email: 'f.alamin@students.omnisdemo.school' } })

  const fatimaAicSub = await prisma.submission.findFirst({
    where: { studentId: fatimaUser.id, homework: { id: 'demo-hw-aic-1' } },
    select: { id: true },
  })
  const fatimaBirlingSub = await prisma.submission.findFirst({
    where: { studentId: fatimaUser.id, homework: { id: 'demo-hw-9e-birling' } },
    select: { id: true },
  })

  if (fatimaAicSub) {
    await prisma.ilpEvidenceEntry.upsert({
      where:  { submissionId_ilpTargetId: { submissionId: fatimaAicSub.id, ilpTargetId: 'seed-ilpt-fatima-3' } },
      update: {},
      create: {
        schoolId: school.id, studentId: fatimaUser.id,
        ilpTargetId: 'seed-ilpt-fatima-3', submissionId: fatimaAicSub.id,
        homeworkTitle: 'An Inspector Calls — Context Research', subject: 'English',
        score: 4, maxScore: 9,
        evidenceType: 'NEUTRAL',
        aiSummary: 'Fatima demonstrates understanding of the core message but analytical development is limited. She identifies the 1912/1945 time gap (showing basic contextual awareness) but the explanation of why that gap matters is not yet developed. NEUTRAL against Target 3 (structured analytical writing) — foundational ideas are present but scaffolded support is still required for development.',
        createdBy: created['j.patel'].id,
      },
    })
  }
  if (fatimaBirlingSub) {
    await prisma.ilpEvidenceEntry.upsert({
      where:  { submissionId_ilpTargetId: { submissionId: fatimaBirlingSub.id, ilpTargetId: 'seed-ilpt-fatima-3' } },
      update: {},
      create: {
        schoolId: school.id, studentId: fatimaUser.id,
        ilpTargetId: 'seed-ilpt-fatima-3', submissionId: fatimaBirlingSub.id,
        homeworkTitle: 'Character Analysis — How does Priestley present Mr Birling?', subject: 'English',
        score: 10, maxScore: 20,
        evidenceType: 'PROGRESS',
        aiSummary: 'Clearer analytical structure emerging — Fatima identifies "capitalist attitudes" and links to Priestley\'s didactic intent, showing conceptual development beyond simple plot summary. Sentence-starter scaffold is evidently in use. PROGRESS against Target 3: independently structured a paragraph with a point, evidence reference, and developing explanation for the first time.',
        createdBy: created['j.patel'].id,
      },
    })
  }

  console.log('  ✓ Fatima Al-Amin: 2 ILP evidence entries (NEUTRAL + PROGRESS), baseline updated to 48%, prediction updated to 55%')
  console.log('  ✓ Section F complete: Rehan Ali (Dyslexia), Caitlin Harris (ADHD), Fatima Al-Amin (SLCN)')

  // ── Section G — Sophia Ahmed: Dyslexia SEND profile ──────────────────────────
  // Sophia is in 9M/Ma2 and 9E/En1. Visible in both Maths and English class
  // rosters. Marked Dyslexic but previously had no ILP, K Plan, or SendStatus.

  const sophiaAhmed = await prisma.user.findUnique({
    where: { email: 's.ahmed@students.omnisdemo.school' },
  })

  if (sophiaAhmed) {
    // 1. SendStatus — SEN Support, Dyslexia
    await prisma.sendStatus.upsert({
      where:  { studentId: sophiaAhmed.id },
      update: { activeStatus: 'SEN_SUPPORT', needArea: 'Specific Learning Difficulty (Dyslexia)' },
      create: {
        studentId:    sophiaAhmed.id,
        activeStatus: 'SEN_SUPPORT',
        activeSource: 'SENCO',
        needArea:     'Specific Learning Difficulty (Dyslexia)',
      },
    })

    // 2. ILP + K Plan
    const sophiaIlp = await seedIlpAndKPlan({
      ilpId:   'seed-ilp-sophia-ahmed',
      kplanId: 'seed-kplan-sophia-ahmed',
      studentId: sophiaAhmed.id,
      sendCategory: 'SEN_SUPPORT',
      strengths: [
        'Strong verbal comprehension — contributes confidently to class discussions in both English and Maths',
        'Good retention when information is presented orally or with visual support',
        'Motivated and responds positively to encouragement and structured scaffolding',
        'Capable of high-quality work when extended writing demand is reduced or scaffolded',
      ].join(' '),
      areasOfNeed: [
        'Reading fluency — decoding multi-syllabic and subject-specific words under time pressure',
        'Written output is slower than peers — ideas outpace ability to transcribe under exam conditions',
        'Spelling of technical vocabulary in English (e.g. Shakespeare, characterisation) and Maths (e.g. denominator, perpendicular)',
        'Working memory under timed conditions — difficulty holding multiple steps whilst writing',
      ].join(' '),
      strategies: [
        'Provide writing frames and sentence starters for all extended tasks',
        'Allow use of a coloured overlay or tinted paper for all reading activities',
        'Pre-teach key subject vocabulary before the lesson using word cards',
        'Allow 25% extra time on all timed assessments',
        'Provide glossary sheets for subject-specific vocabulary in English and Maths',
        'Break multi-step tasks into numbered sub-steps on a separate prompt card',
        'Accept bullet-point planning as an alternative to full prose drafting in class',
        'Seat Sophia where she can clearly see the board and has minimal distractions',
      ],
      successCriteria: 'Independently produce a structured two-paragraph analytical response using a writing frame by end of Summer term. Achieve 25% extra time provision for all Year 9 formal assessments.',
      reviewDate: new Date('2026-07-04'),
      sendInfo: 'Sophia Ahmed (Year 9) has Specific Learning Difficulties (Dyslexia) affecting phonological processing, reading fluency and written output speed. Her verbal comprehension and reasoning are strong — she is an active participant in class discussion. The primary barrier is the translation of ideas into written form under time pressure. She benefits from structured scaffolding, pre-teaching of vocabulary, and extended time. Parents are aware and supportive. No co-occurring diagnosis of ADHD or ASD.',
      teacherActions: [
        'Provide writing frames and sentence starters before every extended task',
        'Allow coloured overlay and larger-print copies of all reading resources (min 14pt Arial)',
        'Pre-teach key vocabulary using the class vocab card — share digitally before the lesson where possible',
        'Allow 25% extra time on any timed written task or assessment',
        'Break multi-step instructions into a numbered list on a prompt card',
        'Never penalise for spelling of subject-specific vocabulary in formative work',
      ],
      studentCommitments: [
        'Use the writing frame before starting any extended answer',
        'Ask the teacher for a vocabulary card if an unfamiliar word appears',
        'Use her coloured overlay in every lesson',
        'Speak to the teacher if extra time is not being applied to a task',
      ],
      targets: [
        {
          id: 'seed-ilpt-sophia-1',
          target: 'Use a writing frame independently to structure a two-paragraph analytical response in English',
          strategy: 'Teacher provides a PEE writing frame before every extended task. Sophia practices using it in class and for homework. Teacher models the frame at the start of each writing lesson.',
          successMeasure: 'Sophia uses the frame without prompting on 3 consecutive English writing tasks and produces structured responses of at least 80 words.',
          targetDate: new Date('2026-07-04'),
        },
        {
          id: 'seed-ilpt-sophia-2',
          target: 'Access 25% extra time provision on all formal Year 9 assessments in English and Maths',
          strategy: 'SENCO to submit access arrangements form to assessment co-ordinator. Subject teachers to apply extended time in all timed class assessments. Review compliance at mid-term.',
          successMeasure: 'Extra time applied to all 4 formal assessments in Spring and Summer terms with no missed provision.',
          targetDate: new Date('2026-06-20'),
        },
        {
          id: 'seed-ilpt-sophia-3',
          target: 'Expand subject-specific vocabulary in English — correctly spell and use 20 key AQA Literature terms',
          strategy: 'Word cards provided each half-term. Sophia tests herself using digital flashcards at home. Teacher includes 3-minute vocabulary starter in every lesson with the target words.',
          successMeasure: 'Sophia correctly uses and spells 15/20 target vocabulary words in a formal written response by end of term.',
          targetDate: new Date('2026-07-04'),
        },
      ],
    })

    // 3. StudentLearningProfile — classroom strategies visible in Learning Passport
    const existingProfile = await (prisma as any).studentLearningProfile.findUnique({
      where: { studentId: sophiaAhmed.id },
    })
    if (!existingProfile) {
      await (prisma as any).studentLearningProfile.create({
        data: {
          studentId:    sophiaAhmed.id,
          schoolId:     school.id,
          strengthAreas: [
            'Verbal reasoning and oral contributions',
            'Retention of content presented through discussion or audio',
            'Persistence and motivation with structured tasks',
          ],
          developmentAreas: [
            'Reading fluency under time pressure',
            'Extended written output — particularly in exam conditions',
            'Spelling of subject-specific vocabulary',
          ],
          classroomStrategies: [
            'Provide coloured overlay or tinted paper for all reading tasks',
            'Offer writing frames and sentence starters for extended tasks',
            'Pre-teach key vocabulary using word cards before the lesson',
            'Give instructions in numbered steps on a prompt card',
            'Allow 25% extra time on timed written tasks',
            'Seat near the front with minimal distractions',
          ],
          passportStatus:   'DRAFT',
          approvedByTeacher: false,
          lastUpdated:      new Date(),
        },
      })
    }

    console.log(`  ✓ Sophia Ahmed: SendStatus (SEN_SUPPORT/Dyslexia), ILP (3 targets), K Plan, StudentLearningProfile created`)
  } else {
    console.log('  ⚠ Sophia Ahmed not found — skipping SEND profile (run db:seed first)')
  }

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
