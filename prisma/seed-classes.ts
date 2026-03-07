/**
 * Targeted seed: add Year 7 students to 7A/En1 and add homework submissions
 * for assignments that currently have 0 responses.
 *
 * Run with:  npm run db:seed-classes
 */
import { PrismaClient, SubmissionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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

// ── 24 additional Year 7 students ──────────────────────────────────────────────
const NEW_YEAR7_STUDENTS = [
  { firstName: 'Chloe',     lastName: 'Grant',     email: 'c.grant@students.omnisdemo.school'     },
  { firstName: 'Thomas',    lastName: 'Reed',      email: 't.reed@students.omnisdemo.school'      },
  { firstName: 'Mia',       lastName: 'Adams',     email: 'm.adams@students.omnisdemo.school'     },
  { firstName: 'Leo',       lastName: 'Barrett',   email: 'l.barrett@students.omnisdemo.school'   },
  { firstName: 'Amara',     lastName: 'Coleman',   email: 'a.coleman@students.omnisdemo.school'   },
  { firstName: 'Oliver',    lastName: 'Dean',      email: 'o.dean@students.omnisdemo.school'      },
  { firstName: 'Sophie',    lastName: 'Ellis',     email: 's.ellis@students.omnisdemo.school'     },
  { firstName: 'Mason',     lastName: 'Fisher',    email: 'm.fisher@students.omnisdemo.school'    },
  { firstName: 'Isabelle',  lastName: 'Gordon',    email: 'i.gordon@students.omnisdemo.school'    },
  { firstName: 'Harry',     lastName: 'Irving',    email: 'h.irving@students.omnisdemo.school'    },
  { firstName: 'Amelia',    lastName: 'Knight',    email: 'a.knight@students.omnisdemo.school'    },
  { firstName: 'Jack',      lastName: 'Lambert',   email: 'j.lambert@students.omnisdemo.school'   },
  { firstName: 'Niamh',     lastName: 'Murray',    email: 'n.murray@students.omnisdemo.school'    },
  { firstName: 'Patrick',   lastName: 'Newton',    email: 'p.newton@students.omnisdemo.school'    },
  { firstName: 'Ruby',      lastName: 'Powell',    email: 'r.powell@students.omnisdemo.school'    },
  { firstName: 'Sebastian', lastName: 'Quinn',     email: 's.quinn@students.omnisdemo.school'     },
  { firstName: 'Talia',     lastName: 'Simmons',   email: 't.simmons@students.omnisdemo.school'   },
  { firstName: 'Uma',       lastName: 'Shah',      email: 'u.shah@students.omnisdemo.school'      },
  { firstName: 'Elliot',    lastName: 'Turner',    email: 'e.turner@students.omnisdemo.school'    },
  { firstName: 'Willow',    lastName: 'Underwood', email: 'w.underwood@students.omnisdemo.school' },
  { firstName: 'Xavier',    lastName: 'Yates',     email: 'x.yates@students.omnisdemo.school'     },
  { firstName: 'Nia',       lastName: 'Roberts',   email: 'n.roberts@students.omnisdemo.school'   },
  { firstName: 'Dylan',     lastName: 'Carr',      email: 'd.carr@students.omnisdemo.school'      },
  { firstName: 'Layla',     lastName: 'Hudson',    email: 'l.hudson@students.omnisdemo.school'    },
]

const SUBMISSIONS_TEXT = [
  "I chose to write about the park near my house. It is a place I visit most weekends with my dog, Pepper. In autumn, the leaves turn golden and orange and crunch under your feet. The smell of bonfire smoke drifts across from nearby gardens. I tried to use my senses to describe it fully.",
  "My chosen place is my grandmother's kitchen. It always smells of cardamom and fried onions. The walls are covered in old photographs and the radio plays quietly in the background. I find it really comforting and wanted to capture that warmth in my writing.",
  "I described my bedroom at night. I focused on the silence broken only by passing cars and the glow of the streetlight through the curtains. I tried to use personification for the shadows and onomatopoeia for the sounds.",
  "The place I described is a swimming pool. I focused on the echo of voices, the chlorine smell, and the cool shock of the water. I used similes to compare the pool to a sheet of rippled glass before anyone gets in.",
  "I wrote about the school library because it is somewhere I spend a lot of time. I focused on the hush, the dusty smell of old books, and the way the afternoon light makes patterns on the carpet. I aimed for a peaceful, reflective tone.",
  "My descriptive piece is about a busy market. I described the colourful stalls, the noise of vendors calling out, and the mix of smells — spices, fresh bread, and cut flowers. I used a list of three to build the sensory detail.",
  "I described a beach in winter, which I think is more interesting than summer. The wind was biting and the sea was grey and restless. I used the pathetic fallacy to reflect a mood of loneliness and tried to vary my sentence lengths for effect.",
]

async function main() {
  console.log('\n🌱  Targeted class seed starting…\n')

  // ── School & teacher lookup ──────────────────────────────────────────────────
  const school = await prisma.school.findFirst({ where: { wondeId: 'demo-school' } })
  if (!school) throw new Error('Demo school not found — run npm run db:seed first.')

  const patel = await prisma.user.findUnique({ where: { email: 'j.patel@omnisdemo.school' } })
  if (!patel) throw new Error('j.patel not found — run npm run db:seed first.')

  // ── Class lookups ────────────────────────────────────────────────────────────
  const cls7A = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '7A/En1' } })
  const cls9E = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '9E/En1' } })
  const cls10E = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '10E/En2' } })
  const cls11E = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '11E/En1' } })

  if (!cls7A || !cls9E || !cls10E || !cls11E) {
    throw new Error('Expected English classes not found — run npm run db:seed first.')
  }

  // ── Add Year 7 students to 7A/En1 ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 10)
  const year7Students: { id: string }[] = []

  console.log('  Adding Year 7 students to 7A/En1…')
  for (const s of NEW_YEAR7_STUDENTS) {
    const user = await prisma.user.upsert({
      where:  { email: s.email },
      create: {
        schoolId:     school.id,
        email:        s.email,
        passwordHash,
        role:         'STUDENT',
        firstName:    s.firstName,
        lastName:     s.lastName,
        yearGroup:    7,
      },
      update: {},
    })
    // Enrol in 7A/En1
    await prisma.enrolment.upsert({
      where:  { classId_userId: { classId: cls7A.id, userId: user.id } },
      create: { classId: cls7A.id, userId: user.id },
      update: {},
    })
    year7Students.push(user)
    console.log(`    ✓  ${s.firstName} ${s.lastName}`)
  }

  // ── Homework lookup for 7A/En1 ───────────────────────────────────────────────
  const hw7AStd  = await prisma.homework.findFirst({ where: { classId: cls7A.id, title: { contains: 'Standard' } } })
  const hw7AScaf = await prisma.homework.findFirst({ where: { classId: cls7A.id, title: { contains: 'Scaffolded' } } })

  // ── Collect ALL 7A students (existing + new) ────────────────────────────────
  const all7AEnrolments = await prisma.enrolment.findMany({
    where:   { classId: cls7A.id },
    include: { user: true },
  })
  const all7AStudents = all7AEnrolments.map(e => e.user)

  // ── Add submissions for 7A/En1 Standard homework ────────────────────────────
  if (hw7AStd) {
    console.log(`\n  Adding submissions for "${hw7AStd.title}"…`)
    // ~90% submission rate
    const submitters = all7AStudents.filter((_, i) => i % 10 !== 0)
    for (const [idx, student] of submitters.entries()) {
      const isMarked = idx < submitters.length * 0.6
      await prisma.submission.upsert({
        where:  { homeworkId_studentId: { homeworkId: hw7AStd.id, studentId: student.id } },
        create: {
          schoolId:    school.id,
          homeworkId:  hw7AStd.id,
          studentId:   student.id,
          content:     SUBMISSIONS_TEXT[idx % SUBMISSIONS_TEXT.length],
          status:      isMarked ? SubmissionStatus.RETURNED : SubmissionStatus.SUBMITTED,
          submittedAt: daysAgo(Math.floor(Math.random() * 3)),
          markedAt:    isMarked ? daysAgo(1) : null,
          finalScore:  isMarked ? Math.round(60 + Math.random() * 35) : null,
          feedback:    isMarked
            ? 'Good use of sensory detail. Try to vary your sentence openers more.'
            : null,
        },
        update: {},
      })
    }
    console.log(`    ✓  ${submitters.length} submissions`)
  }

  // ── Add submissions for 7A/En1 Scaffolded homework (SEND-adapted) ───────────
  if (hw7AScaf) {
    console.log(`\n  Adding submissions for "${hw7AScaf.title}"…`)
    // Only a few students use the scaffolded version
    const sendStudents = all7AStudents.slice(0, 5)
    for (const student of sendStudents) {
      await prisma.submission.upsert({
        where:  { homeworkId_studentId: { homeworkId: hw7AScaf.id, studentId: student.id } },
        create: {
          schoolId:    school.id,
          homeworkId:  hw7AScaf.id,
          studentId:   student.id,
          content:     SUBMISSIONS_TEXT[Math.floor(Math.random() * SUBMISSIONS_TEXT.length)],
          status:      SubmissionStatus.SUBMITTED,
          submittedAt: daysAgo(1),
        },
        update: {},
      })
    }
    console.log(`    ✓  ${sendStudents.length} submissions`)
  }

  // ── Add submissions for 9E/En1 "Character Study" (0 at the moment) ──────────
  const hw9EChar = await prisma.homework.findFirst({
    where: { classId: cls9E.id, title: { contains: 'Character' } },
  })
  if (hw9EChar) {
    const all9EStudents = await prisma.enrolment.findMany({
      where:   { classId: cls9E.id },
      include: { user: true },
    })
    console.log(`\n  Adding submissions for "${hw9EChar.title}"…`)
    const submitters = all9EStudents.filter((_, i) => i % 8 !== 0).map(e => e.user)
    for (const [idx, student] of submitters.entries()) {
      const content = `Inspector Goole is presented as a mysterious and morally driven character. Priestley uses him as a vehicle for his socialist message. When he says "We are members of one body", he implies that society must take collective responsibility. The Inspector acts as a kind of omniscient judge, arriving with full knowledge of the Birlings' guilt.`
      await prisma.submission.upsert({
        where:  { homeworkId_studentId: { homeworkId: hw9EChar.id, studentId: student.id } },
        create: {
          schoolId:    school.id,
          homeworkId:  hw9EChar.id,
          studentId:   student.id,
          content,
          status:      idx < 4 ? SubmissionStatus.RETURNED : SubmissionStatus.SUBMITTED,
          submittedAt: daysAgo(2),
          markedAt:    idx < 4 ? daysAgo(1) : null,
          finalScore:  idx < 4 ? Math.round(55 + Math.random() * 40) : null,
          feedback:    idx < 4 ? 'Strong analysis of Priestley\'s intentions. Consider quoting more directly from the text.' : null,
        },
        update: {},
      })
    }
    console.log(`    ✓  ${submitters.length} submissions`)
  }

  // ── 11E/En1 — "Responsibility Theme" (0 submissions) ───────────────────────
  const hw11EResp = await prisma.homework.findFirst({
    where: { classId: cls11E.id, title: { contains: 'Responsibility' } },
  })
  if (hw11EResp) {
    const all11EStudents = await prisma.enrolment.findMany({
      where:   { classId: cls11E.id },
      include: { user: true },
    })
    console.log(`\n  Adding submissions for "${hw11EResp.title}"…`)
    const submitters = all11EStudents.filter((_, i) => i % 7 !== 0).map(e => e.user)
    for (const [idx, student] of submitters.entries()) {
      const content = `Priestley presents the theme of responsibility through the Birling family's collective guilt. Each character is shown to have contributed to Eva Smith's downfall, suggesting that society's problems are shared. The Inspector acts as Priestley's mouthpiece for socialist ideals — "each of you helped to kill her." The younger generation (Sheila and Eric) accept responsibility, while their parents refuse, symbolising the clash between old and new values.`
      await prisma.submission.upsert({
        where:  { homeworkId_studentId: { homeworkId: hw11EResp.id, studentId: student.id } },
        create: {
          schoolId:    school.id,
          homeworkId:  hw11EResp.id,
          studentId:   student.id,
          content,
          status:      SubmissionStatus.SUBMITTED,
          submittedAt: daysAgo(1),
        },
        update: {},
      })
    }
    console.log(`    ✓  ${submitters.length} submissions`)
  }

  // ── 10E/En2 — nothing to fix (10 submissions already) ──────────────────────

  console.log('\n✅  Class seed complete!\n')
  console.log('  7A/En1 now has', all7AStudents.length + NEW_YEAR7_STUDENTS.length, 'students')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
