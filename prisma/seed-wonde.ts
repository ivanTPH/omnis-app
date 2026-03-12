/*
 * WONDE PHOTO SYNC NOTE:
 * The Wonde API returns student photos at:
 *   student.photo.thumb  (small, ~100px)
 *   student.photo.medium (medium, ~200px)
 *   student.photo.full   (full size)
 *
 * During Phase 1C Part B (live Wonde integration), sync photoUrl
 * from student.photo.medium to WondeStudent.photoUrl and
 * User.avatarUrl for each student.
 *
 * Photos are personal data — ensure:
 * - Stored URLs are school-scoped (never cross-tenant)
 * - Included in GDPR data subject access requests
 * - Deleted when student leaves school (off-rolling)
 * - Not used in platform-level analytics
 */

/**
 * prisma/seed-wonde.ts
 *
 * Generates a complete synthetic school "Oakfield Academy" with Wonde MIS data:
 *   - 30 staff (WondeEmployee + User)
 *   - 120 students across Y7-Y10 (WondeStudent + User, ~15% SEND)
 *   - ~175 parent contacts (WondeContact)
 *   - 8 form groups (WondeGroup)
 *   - 32 classes — 8 subjects × 4 year groups (WondeClass + SchoolClass + ClassTeacher)
 *   - 480 class-student links (WondeClassStudent + Enrolment)
 *   - 40 periods — 8 per day Mon–Fri (WondePeriod)
 *   - 96 timetable entries — 3 per class (WondeTimetableEntry)
 *   - 240 KS2 SAT assessment results (WondeAssessmentResult)
 *   - 1 WondeSyncLog
 *
 * Idempotent: safe to run multiple times.
 * Run with: npm run wonde:seed
 */

import { PrismaClient, Role, SendStatusValue } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

// ── Deterministic RNG (LCG) ───────────────────────────────────────────────────
let _s = 0x1a2b3c4d
const rng  = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296 }
const ri   = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1))
const pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]
const shuffle = <T>(a: T[]): T[] => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

// ── Name pools ────────────────────────────────────────────────────────────────
const MALE_FIRST   = ['Oliver','Harry','George','Charlie','Noah','Jack','Ethan','Logan','Muhammad','Thomas','Lewis','Mason','Liam','William','Freddie','Archie','Oscar','Dylan','Jacob','Joshua','Isaac','Lucas','Theo','Reuben','Samuel','Leo','Max','Joseph','Nathan','Tyler','Cameron','Aaron','Owen','Callum','Kieran','Elijah','Tobias','Finley','Sebastian','Patrick']
const FEMALE_FIRST = ['Amelia','Olivia','Ava','Isla','Grace','Sophia','Emily','Lily','Isabella','Mia','Florence','Charlotte','Poppy','Freya','Daisy','Chloe','Ruby','Sophie','Imogen','Jessica','Ella','Scarlett','Lucy','Hannah','Evie','Phoebe','Zoe','Abigail','Millie','Erin','Alice','Layla','Amber','Jasmine','Eleanor','Holly','Molly','Caitlin','Leah','Niamh']
const LAST_NAMES   = ['Smith','Jones','Williams','Taylor','Brown','Davies','Evans','Wilson','Thomas','Roberts','Johnson','Lewis','Walker','Robinson','Wood','Thompson','White','Watson','Jackson','Wright','Harris','Martin','Cooper','Allen','Morris','Shaw','Clarke','Scott','Baker','Mitchell','Phillips','King','Turner','Carter','Hill','Moore','Anderson','Murphy','Edwards','Reid','Bell','Rose','Green','Bird','Walsh','Dean','Murray','Cox','Webb','Price','Hughes','Ward','Brooks','Russell','Patterson','Butler','Barnes','Griffiths','Ahmed','Khan','Patel','Singh','Ali','Okafor']
const PARENT_RELS  = ['Mother','Father','Guardian','Grandmother','Grandfather','Aunt','Uncle']

// ── Staff definitions (30 total) ──────────────────────────────────────────────
// Indices 0–3: SLT + SENCO, 4–7: Subject Heads, 8–29: Class Teachers
const STAFF: { fn: string; ln: string; title: string; role: Role; isTeacher: boolean; subjects: string[] }[] = [
  // SLT (3)
  { fn: 'James',       ln: 'Harrison',  title: 'Mr',  role: Role.SLT,          isTeacher: false, subjects: []             },
  { fn: 'Sarah',       ln: 'Clarke',    title: 'Ms',  role: Role.SLT,          isTeacher: false, subjects: []             },
  { fn: 'Michael',     ln: 'Thompson',  title: 'Mr',  role: Role.SLT,          isTeacher: false, subjects: []             },
  // SENCO (1)
  { fn: 'Emma',        ln: 'Wilson',    title: 'Ms',  role: Role.SENCO,        isTeacher: false, subjects: []             },
  // Subject Heads (4)
  { fn: 'Helen',       ln: 'Davies',    title: 'Ms',  role: Role.HEAD_OF_DEPT, isTeacher: true,  subjects: ['English']    },
  { fn: 'Robert',      ln: 'Johnson',   title: 'Mr',  role: Role.HEAD_OF_DEPT, isTeacher: true,  subjects: ['Maths']      },
  { fn: 'Patricia',    ln: 'Lee',       title: 'Dr',  role: Role.HEAD_OF_DEPT, isTeacher: true,  subjects: ['Science']    },
  { fn: 'Andrew',      ln: 'Baker',     title: 'Mr',  role: Role.HEAD_OF_DEPT, isTeacher: true,  subjects: ['History']    },
  // English class teachers (4)
  { fn: 'Mark',        ln: 'Evans',     title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['English']    },
  { fn: 'Lucy',        ln: 'Williams',  title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['English']    },
  { fn: 'Daniel',      ln: 'Martin',    title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['English']    },
  { fn: 'Rachel',      ln: 'Green',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['English']    },
  // Maths class teachers (4)
  { fn: 'Paul',        ln: 'Roberts',   title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Maths']      },
  { fn: 'Karen',       ln: 'Hughes',    title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Maths']      },
  { fn: 'Steven',      ln: 'Turner',    title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Maths']      },
  { fn: 'Amanda',      ln: 'Clark',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Maths']      },
  // Science class teachers (4)
  { fn: 'James',       ln: 'Mitchell',  title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Science']    },
  { fn: 'Natalie',     ln: 'Brown',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Science']    },
  { fn: 'Christopher', ln: 'Hall',      title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Science']    },
  { fn: 'Rebecca',     ln: 'Moore',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Science']    },
  // History class teachers (3)
  { fn: 'Thomas',      ln: 'Harris',    title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['History']    },
  { fn: 'Jennifer',    ln: 'White',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['History']    },
  { fn: 'Benjamin',    ln: 'Scott',     title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['History']    },
  // Geography (2)
  { fn: 'Kevin',       ln: 'Wood',      title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Geography']  },
  { fn: 'Sandra',      ln: 'Hill',      title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Geography']  },
  // Art (2)
  { fn: 'Diane',       ln: 'Young',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Art']        },
  { fn: 'Peter',       ln: 'Taylor',    title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Art']        },
  // PE (2)
  { fn: 'Matthew',     ln: 'Cooper',    title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['PE']         },
  { fn: 'Lisa',        ln: 'Adams',     title: 'Ms',  role: Role.TEACHER,      isTeacher: true,  subjects: ['PE']         },
  // Computing (1)
  { fn: 'Ryan',        ln: 'Phillips',  title: 'Mr',  role: Role.TEACHER,      isTeacher: true,  subjects: ['Computing']  },
] // 30 total ✓

// ── Subject definitions ────────────────────────────────────────────────────────
// period: the class period slot used in timetable (1–7)
const SUBJECTS = [
  { name: 'English',   code: 'En', dept: 'English',    period: 1 },
  { name: 'Maths',     code: 'Ma', dept: 'Maths',      period: 2 },
  { name: 'Science',   code: 'Sc', dept: 'Science',    period: 3 },
  { name: 'History',   code: 'Hi', dept: 'Humanities', period: 4 },
  { name: 'Geography', code: 'Ge', dept: 'Humanities', period: 5 },
  { name: 'Art',       code: 'Ar', dept: 'Arts',       period: 6 },
  { name: 'PE',        code: 'PE', dept: 'PE',         period: 7 },
  { name: 'Computing', code: 'Co', dept: 'Computing',  period: 7 },
] as const

// STAFF index per subject per year group [Y7, Y8, Y9, Y10]
const SUBJECT_TEACHERS: Record<string, [number, number, number, number]> = {
  English:   [4,  8,  9,  10],  // Helen Davies (HOD), Mark Evans, Lucy Williams, Daniel Martin
  Maths:     [5,  12, 13, 14],  // Robert Johnson (HOD), Paul Roberts, Karen Hughes, Steven Turner
  Science:   [6,  16, 17, 18],  // Patricia Lee (HOD), James Mitchell, Natalie Brown, Christopher Hall
  History:   [7,  20, 21, 22],  // Andrew Baker (HOD), Thomas Harris, Jennifer White, Benjamin Scott
  Geography: [23, 24, 23, 24],  // Kevin Wood, Sandra Hill (each covers 2 year groups)
  Art:       [25, 26, 25, 26],  // Diane Young, Peter Taylor
  PE:        [27, 28, 27, 28],  // Matthew Cooper, Lisa Adams
  Computing: [29, 29, 29, 29],  // Ryan Phillips (all 4 year groups)
}

// Days each year group meets per week (1=Mon … 5=Fri), 3 days per class
const YEAR_DAYS: Record<number, [number, number, number]> = {
  7:  [1, 3, 5],
  8:  [1, 2, 4],
  9:  [2, 3, 5],
  10: [1, 4, 5],
}

// Period definitions: 8 per day (P0=registration, P1–P7=teaching)
const PERIOD_DEFS = [
  { num: 0, name: 'Registration', start: '08:00', end: '08:30' },
  { num: 1, name: 'Period 1',     start: '08:30', end: '09:30' },
  { num: 2, name: 'Period 2',     start: '09:30', end: '10:30' },
  { num: 3, name: 'Period 3',     start: '10:40', end: '11:40' },
  { num: 4, name: 'Period 4',     start: '11:40', end: '12:40' },
  { num: 5, name: 'Period 5',     start: '13:20', end: '14:20' },
  { num: 6, name: 'Period 6',     start: '14:20', end: '15:20' },
  { num: 7, name: 'Period 7',     start: '15:20', end: '16:20' },
]

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const SEND_NEED_AREAS = ['dyslexia', 'ADHD', 'autism', 'EAL']
// 5+5+4+4 = 18 SEND students ≈ 15% of 120
const SEND_PER_YEAR: Record<number, number> = { 7: 5, 8: 5, 9: 4, 10: 4 }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Oakfield Academy — Wonde Synthetic Seed')
  console.log('═══════════════════════════════════════════\n')

  const now = new Date()
  const pw  = await bcrypt.hash('Demo1234!', 10)

  // ── 1. School ────────────────────────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where:  { wondeId: 'WONDE-OAKFIELD' },
    update: {},
    create: {
      name:         'Oakfield Academy',
      wondeId:      'WONDE-OAKFIELD',
      aiOptIn:      true,
      dayStartHour: 8,
      dayEndHour:   16,
      extStartHour: 7,
      extEndHour:   19,
    },
  })
  console.log(`✓ School: ${school.name}`)

  // ── 2. WondeSchool ───────────────────────────────────────────────────────────
  await prisma.wondeSchool.upsert({
    where:  { id: 'A1329183376' },
    update: {},
    create: {
      id:                  'A1329183376',
      schoolId:            school.id,
      wondeToken:          'wonde_synthetic_token_oakfield',
      mis:                 'SIMS',
      phaseOfEducation:    'secondary',
      urn:                 100999,
      laCode:              '201',
      establishmentNumber: '4321',
      syncedAt:            now,
    },
  })
  console.log('✓ WondeSchool')

  // ── 3. Staff: WondeEmployee + User ───────────────────────────────────────────
  const staffWondeId = (i: number) => `WEMP-${String(i + 1).padStart(3, '0')}`
  const staffUserIds: Record<string, string> = {}

  for (let i = 0; i < STAFF.length; i++) {
    const s     = STAFF[i]
    const wid   = staffWondeId(i)
    const email = `${s.fn.toLowerCase()}.${s.ln.toLowerCase()}@oakfield.edu`

    await prisma.wondeEmployee.upsert({
      where:  { id: wid },
      update: {},
      create: {
        id:        wid,
        schoolId:  school.id,
        misId:     `MIS-EMP-${i + 1}`,
        firstName: s.fn,
        lastName:  s.ln,
        email,
        title:     s.title,
        isTeacher: s.isTeacher,
        subjects:  s.subjects,
        syncedAt:  now,
      },
    })

    const user = await prisma.user.upsert({
      where:  { email },
      update: {},
      create: {
        schoolId:     school.id,
        email,
        passwordHash: pw,
        role:         s.role,
        firstName:    s.fn,
        lastName:     s.ln,
        department:   s.subjects[0] ?? undefined,
      },
    })
    staffUserIds[wid] = user.id
  }
  console.log(`✓ ${STAFF.length} staff (WondeEmployee + User)`)

  // ── 4. Form groups (WondeGroup) ──────────────────────────────────────────────
  for (const year of [7, 8, 9, 10]) {
    for (const letter of ['A', 'B']) {
      const gid = `WGRP-${year}${letter}`
      await prisma.wondeGroup.upsert({
        where:  { id: gid },
        update: {},
        create: {
          id:          gid,
          schoolId:    school.id,
          name:        `${year}${letter}`,
          description: `Year ${year} Form Group ${letter}`,
          type:        'form',
          syncedAt:    now,
        },
      })
    }
  }
  console.log('✓ 8 form groups (WondeGroup)')

  // ── 5. Classes: WondeClass + SchoolClass + ClassTeacher ──────────────────────
  const classWondeIds: Record<string, string> = {}  // "7-English" → wondeId
  const classAppIds:   Record<string, string> = {}  // "7-English" → SchoolClass.id

  for (const year of [7, 8, 9, 10]) {
    const yearIdx = [7, 8, 9, 10].indexOf(year)
    for (const sub of SUBJECTS) {
      const wondeClassId  = `WCLS-${year}-${sub.code}`
      const className     = `${year}${sub.code}1`
      const teacherIdx    = SUBJECT_TEACHERS[sub.name][yearIdx]
      const teacherWondeId = staffWondeId(teacherIdx)

      await prisma.wondeClass.upsert({
        where:  { id: wondeClassId },
        update: {},
        create: {
          id:        wondeClassId,
          schoolId:  school.id,
          misId:     `MIS-CLS-${year}-${sub.code}`,
          name:      className,
          subject:   sub.name,
          yearGroup: year,
          employeeId: teacherWondeId,
          groupId:   `WGRP-${year}A`,
          syncedAt:  now,
        },
      })

      const appClassId = `oakfield-${wondeClassId}`
      await prisma.schoolClass.upsert({
        where:  { id: appClassId },
        update: {},
        create: {
          id:         appClassId,
          schoolId:   school.id,
          name:       className,
          subject:    sub.name,
          yearGroup:  year,
          department: sub.dept,
        },
      })

      const teacherUserId = staffUserIds[teacherWondeId]
      if (teacherUserId) {
        await prisma.classTeacher.upsert({
          where:  { classId_userId: { classId: appClassId, userId: teacherUserId } },
          update: {},
          create: { classId: appClassId, userId: teacherUserId },
        })
      }

      classWondeIds[`${year}-${sub.name}`] = wondeClassId
      classAppIds[`${year}-${sub.name}`]   = appClassId
    }
  }
  console.log('✓ 32 classes (WondeClass + SchoolClass + ClassTeacher)')

  // ── 6. Students: WondeStudent + User + SEND ──────────────────────────────────
  type StudentRef = { wondeId: string; userId: string; firstName: string; lastName: string }
  const studentsByYear: Record<number, StudentRef[]> = { 7: [], 8: [], 9: [], 10: [] }
  let totalStudents = 0
  let totalSend     = 0

  for (const year of [7, 8, 9, 10]) {
    let sendCount = 0
    const sendTarget = SEND_PER_YEAR[year]

    for (let i = 0; i < 30; i++) {
      const isMale    = i < 15
      const firstName = pick(isMale ? MALE_FIRST : FEMALE_FIRST)
      const lastName  = pick(LAST_NAMES)
      const wid       = `WSTUD-${year}-${String(i + 1).padStart(2, '0')}`
      const email     = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${year}${String(i + 1).padStart(2, '0')}@students.oakfield.edu`

      // Approximate DOB: Year 7 students are 11–12 in 2026, born 2013–2014
      const dobYear = 2026 - year - 11 + ri(0, 1)
      const dob     = new Date(dobYear, ri(0, 11), ri(1, 28))

      await prisma.wondeStudent.upsert({
        where:  { id: wid },
        update: {},
        create: {
          id:        wid,
          schoolId:  school.id,
          misId:     `MIS-STU-${totalStudents + 1}`,
          upn:       `A${String(totalStudents + 100000000000).slice(1)}`,
          firstName,
          lastName,
          dob,
          yearGroup: year,
          formGroup: `${year}${i < 15 ? 'A' : 'B'}`,
          syncedAt:  now,
          photoUrl:  `https://api.dicebear.com/7.x/initials/svg?seed=${firstName}${lastName}&backgroundColor=3b82f6`,
        },
      })

      const user = await prisma.user.upsert({
        where:  { email },
        update: {},
        create: {
          schoolId:     school.id,
          email,
          passwordHash: pw,
          role:         Role.STUDENT,
          firstName,
          lastName,
          yearGroup:    year,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${firstName}${lastName}&backgroundColor=3b82f6`,
        },
      })

      studentsByYear[year].push({ wondeId: wid, userId: user.id, firstName, lastName })

      // SEND: assign to evenly-spaced students within the year group
      const sendSpacing = Math.floor(30 / sendTarget)
      if (sendCount < sendTarget && i % sendSpacing === 0) {
        const needArea  = SEND_NEED_AREAS[sendCount % SEND_NEED_AREAS.length]
        const status    = sendCount < 2 ? SendStatusValue.EHCP : SendStatusValue.SEN_SUPPORT
        await prisma.sendStatus.upsert({
          where:  { studentId: user.id },
          update: {},
          create: {
            studentId:    user.id,
            activeStatus: status,
            needArea,
          },
        })
        sendCount++
        totalSend++
      }

      totalStudents++
    }
  }
  console.log(`✓ ${totalStudents} students (WondeStudent + User, ${totalSend} with SEND)`)

  // ── 7. Parent contacts: 1–2 per student ──────────────────────────────────────
  let contactCount = 0
  for (const year of [7, 8, 9, 10]) {
    for (const stud of studentsByYear[year]) {
      const numContacts = rng() > 0.3 ? 2 : 1
      for (let c = 0; c < numContacts; c++) {
        const cid       = `WCON-${stud.wondeId}-${c + 1}`
        const isMother  = c === 0 ? rng() > 0.5 : rng() > 0.7
        const parentFn  = pick(isMother ? FEMALE_FIRST : MALE_FIRST)
        const parentLn  = rng() > 0.25 ? stud.lastName : pick(LAST_NAMES)
        const rel       = c === 0 ? (isMother ? 'Mother' : 'Father') : pick(PARENT_RELS)
        await prisma.wondeContact.upsert({
          where:  { id: cid },
          update: {},
          create: {
            id:                    cid,
            schoolId:              school.id,
            studentId:             stud.wondeId,
            firstName:             parentFn,
            lastName:              parentLn,
            email:                 `${parentFn.toLowerCase()}.${parentLn.toLowerCase()}${ri(1, 99)}@email.co.uk`,
            phone:                 `07${ri(700, 999)}${ri(100000, 999999)}`,
            relationship:          rel,
            parentalResponsibility: c === 0 || rng() > 0.4,
            syncedAt:              now,
          },
        })
        contactCount++
      }
    }
  }
  console.log(`✓ ${contactCount} parent contacts (WondeContact)`)

  // ── 8. Class-student links: WondeClassStudent + Enrolment ────────────────────
  let csCount = 0
  for (const year of [7, 8, 9, 10]) {
    const yearStudents = studentsByYear[year]
    for (const sub of SUBJECTS) {
      const wondeClassId = classWondeIds[`${year}-${sub.name}`]
      const appClassId   = classAppIds[`${year}-${sub.name}`]
      // Deterministically pick 15 of 30 students for each class
      const assigned = shuffle(yearStudents).slice(0, 15)
      for (const stud of assigned) {
        await prisma.wondeClassStudent.upsert({
          where:  { classId_studentId: { classId: wondeClassId, studentId: stud.wondeId } },
          update: {},
          create: { classId: wondeClassId, studentId: stud.wondeId },
        })
        await prisma.enrolment.upsert({
          where:  { classId_userId: { classId: appClassId, userId: stud.userId } },
          update: {},
          create: { classId: appClassId, userId: stud.userId },
        })
        csCount++
      }
    }
  }
  console.log(`✓ ${csCount} class-student links (WondeClassStudent + Enrolment)`)

  // ── 9. Periods: 8 per day × 5 days = 40 WondePeriod ─────────────────────────
  let periodCount = 0
  for (let day = 1; day <= 5; day++) {
    for (const pd of PERIOD_DEFS) {
      await prisma.wondePeriod.upsert({
        where:  { id: `WPER-D${day}-P${pd.num}` },
        update: {},
        create: {
          id:        `WPER-D${day}-P${pd.num}`,
          schoolId:  school.id,
          name:      `${pd.name} (${DAY_NAMES[day - 1]})`,
          startTime: pd.start,
          endTime:   pd.end,
          dayOfWeek: day,
        },
      })
      periodCount++
    }
  }
  console.log(`✓ ${periodCount} periods (WondePeriod)`)

  // ── 10. Timetable: 3 days per class = 96 WondeTimetableEntry ─────────────────
  let ttCount = 0
  for (const year of [7, 8, 9, 10]) {
    const yearIdx = [7, 8, 9, 10].indexOf(year)
    const days    = YEAR_DAYS[year]
    for (const sub of SUBJECTS) {
      const wondeClassId   = classWondeIds[`${year}-${sub.name}`]
      const teacherIdx     = SUBJECT_TEACHERS[sub.name][yearIdx]
      const teacherWondeId = staffWondeId(teacherIdx)
      for (const day of days) {
        const ttId = `WTTE-${wondeClassId}-D${day}`
        await prisma.wondeTimetableEntry.upsert({
          where:  { id: ttId },
          update: {},
          create: {
            id:         ttId,
            schoolId:   school.id,
            classId:    wondeClassId,
            employeeId: teacherWondeId,
            periodId:   `WPER-D${day}-P${sub.period}`,
            roomName:   `Room ${ri(1, 30)}`,
          },
        })
        ttCount++
      }
    }
  }
  console.log(`✓ ${ttCount} timetable entries (WondeTimetableEntry)`)

  // ── 11. KS2 SAT assessment results (2 per student = 240 total) ────────────────
  let assCount = 0
  for (const year of [7, 8, 9, 10]) {
    const satsYear = 2026 - (year - 6) // Y7 → 2025, Y10 → 2022
    for (const stud of studentsByYear[year]) {
      for (const subject of ['English', 'Maths'] as const) {
        const score = ri(80, 120)
        const aId   = `WASS-${stud.wondeId}-${subject.toLowerCase()}`
        await prisma.wondeAssessmentResult.upsert({
          where:  { id: aId },
          update: {},
          create: {
            id:             aId,
            schoolId:       school.id,
            studentId:      stud.wondeId,
            subjectName:    subject,
            resultSetName:  `KS2 SATs ${satsYear}`,
            aspectName:     'Standardised Score',
            gradeValue:     String(score),
            result:         String(score),
            collectionDate: new Date(satsYear, 5, 15),
            syncedAt:       now,
          },
        })
        assCount++
      }
    }
  }
  console.log(`✓ ${assCount} KS2 assessment results (WondeAssessmentResult)`)

  // ── 12. WondeSyncLog ─────────────────────────────────────────────────────────
  const existingLog = await prisma.wondeSyncLog.findFirst({
    where: { schoolId: school.id, syncType: 'INITIAL_SEED' },
  })
  if (!existingLog) {
    await prisma.wondeSyncLog.create({
      data: {
        schoolId:         school.id,
        syncType:         'INITIAL_SEED',
        status:           'COMPLETED',
        recordsProcessed: STAFF.length + totalStudents + contactCount + 32 + periodCount + ttCount + assCount,
        errors:           [],
        completedAt:      now,
      },
    })
  }
  console.log('✓ WondeSyncLog')

  // ── 13. GDPR Consent Purposes ─────────────────────────────────────────────────
  const PURPOSES = [
    {
      id:          'CP-OAKFIELD-1',
      slug:        'send-data-sharing',
      title:       'SEND Data Sharing with External Agencies',
      description: 'Sharing your child\'s SEND assessment data with local authority educational psychologists, speech therapists, and other support agencies.',
      lawfulBasis: 'consent',
    },
    {
      id:          'CP-OAKFIELD-2',
      slug:        'photo-video-consent',
      title:       'Photography and Video Recording',
      description: 'Use of your child\'s image in school publications, website, social media, and promotional materials.',
      lawfulBasis: 'consent',
    },
    {
      id:          'CP-OAKFIELD-3',
      slug:        'data-analytics',
      title:       'Learning Analytics',
      description: 'Use of anonymised learning data to identify pupils at risk of underachievement and personalise support.',
      lawfulBasis: 'legitimate_interest',
    },
    {
      id:          'CP-OAKFIELD-4',
      slug:        'third-party-tools',
      title:       'Third-Party EdTech Tools',
      description: 'Sharing pupil data with approved third-party educational technology tools used in lessons (e.g. online quizzes, revision platforms).',
      lawfulBasis: 'consent',
    },
  ]

  for (const p of PURPOSES) {
    await prisma.consentPurpose.upsert({
      where:  { schoolId_slug: { schoolId: school.id, slug: p.slug } },
      update: {},
      create: { ...p, schoolId: school.id, isActive: true },
    })
  }
  console.log(`✓ ${PURPOSES.length} ConsentPurposes`)

  // ── 14. Sample ConsentRecords ─────────────────────────────────────────────────
  // Use Y7 + Y8 students (first 10 per year) as sample subjects.
  // Use the first parent-linked user as responder — fall back to admin user.
  const adminUser = await prisma.user.findFirst({ where: { schoolId: school.id, role: 'SCHOOL_ADMIN' } })
  const parentUser = await prisma.user.findFirst({ where: { schoolId: school.id, role: 'PARENT' } })
  const responderId = parentUser?.id ?? adminUser?.id ?? 'SYSTEM'

  const DECISIONS: ('granted' | 'withdrawn')[] = ['granted', 'granted', 'granted', 'withdrawn', 'granted']
  let crCount = 0

  const sampleStudents = [
    ...studentsByYear[7].slice(0, 5),
    ...studentsByYear[8].slice(0, 5),
    ...studentsByYear[9].slice(0, 5),
    ...(studentsByYear[10] ?? []).slice(0, 5),
  ]

  for (const stud of sampleStudents) {
    for (let pi = 0; pi < PURPOSES.length; pi++) {
      // Skip ~20% of entries to leave some "unknown" cells in the matrix
      if (rng() < 0.2) continue
      const decision = DECISIONS[Math.floor(rng() * DECISIONS.length)]
      const crId = `CR-${stud.wondeId}-${PURPOSES[pi].slug}`
      const existing = await prisma.consentRecord.findFirst({
        where: { purposeId: PURPOSES[pi].id, studentId: stud.wondeId, responderId },
      })
      if (!existing) {
        await prisma.consentRecord.create({
          data: {
            id:          crId,
            purposeId:   PURPOSES[pi].id,
            studentId:   stud.wondeId,
            responderId,
            decision,
            method:      'imported',
            recordedAt:  new Date(Date.now() - ri(0, 30) * 86400_000),
          },
        })
        crCount++
      }
    }
  }
  console.log(`✓ ${crCount} ConsentRecords`)

  // ── 15. Cover seed data — 2 absences for today ───────────────────────────────
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayDow = today.getDay() // 0=Sun … 6=Sat

  // WEMP-005 = Helen Davies (English HOD, Y7 English teacher)
  // WEMP-006 = Robert Johnson (Maths HOD, Y7 Maths teacher)
  const absenceStaff = [
    { staffId: 'WEMP-005', reason: 'illness', notes: 'Called in sick this morning', allUnassigned: true },
    { staffId: 'WEMP-006', reason: 'illness', notes: null, allUnassigned: false },
  ]

  // Find an admin user to report absences
  const adminReporter = await prisma.user.findFirst({
    where: { schoolId: school.id, role: { in: ['SCHOOL_ADMIN', 'SLT'] } },
  })
  const reportedBy = adminReporter?.id ?? 'SYSTEM'

  for (const abs of absenceStaff) {
    // Upsert absence (avoid duplicate on re-seed)
    const existingAbs = await prisma.staffAbsence.findFirst({
      where: { schoolId: school.id, staffId: abs.staffId, date: { gte: new Date(today.setHours(0,0,0,0)), lte: new Date(today.setHours(23,59,59,999)) } },
    })
    today.setHours(12, 0, 0, 0)

    let absence = existingAbs
    if (!absence) {
      absence = await prisma.staffAbsence.create({
        data: {
          schoolId:  school.id,
          staffId:   abs.staffId,
          date:      today,
          reason:    abs.reason,
          notes:     abs.notes,
          reportedBy,
        },
      })
    }

    // Find timetable entries for this employee on today's day of week
    // Skip weekends (no lessons on Sat/Sun)
    if (todayDow >= 1 && todayDow <= 5) {
      const entries = await prisma.wondeTimetableEntry.findMany({
        where: { schoolId: school.id, employeeId: abs.staffId, period: { dayOfWeek: todayDow } },
      })

      for (let i = 0; i < entries.length; i++) {
        const existing = await prisma.coverAssignment.findFirst({
          where: { absenceId: absence.id, timetableEntryId: entries[i].id },
        })
        if (!existing) {
          // For second teacher: mix of statuses
          let status = 'unassigned'
          if (!abs.allUnassigned) {
            if (i === 0) status = 'confirmed'
            else if (i === 1) status = 'assigned'
          }
          // For assigned/confirmed, pick a cover supervisor (WEMP-027 = Matthew Cooper, PE)
          const coveredBy = status !== 'unassigned' ? 'WEMP-027' : null
          await prisma.coverAssignment.create({
            data: {
              schoolId:        school.id,
              absenceId:       absence.id,
              timetableEntryId: entries[i].id,
              status,
              coveredBy,
            },
          })
        }
      }
    }
  }
  console.log('✓ Cover seed: 2 absences for today')

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════')
  console.log('  Seed complete — Oakfield Academy')
  console.log(`  Staff:       ${STAFF.length}`)
  console.log(`  Students:    ${totalStudents}  (${totalSend} SEND)`)
  console.log(`  Contacts:    ${contactCount}`)
  console.log(`  Classes:     32`)
  console.log(`  Class links: ${csCount}`)
  console.log(`  Periods:     ${periodCount}`)
  console.log(`  Timetable:   ${ttCount}`)
  console.log(`  Assessments: ${assCount}`)
  console.log(`  Consent:     ${PURPOSES.length} purposes, ${crCount} records`)
  console.log('═══════════════════════════════════════════\n')
}

main()
  .catch(err => { console.error('\nFATAL:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
