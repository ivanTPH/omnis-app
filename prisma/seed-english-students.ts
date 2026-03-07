/**
 * Seed: add realistic student rosters to 9E/En1, 10E/En2, 11E/En1
 * Run with: npm run db:seed-english
 */
import { PrismaClient, SubmissionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const dbUrl   = process.env.DATABASE_URL ?? ''
const connUrl = dbUrl.includes('?') ? dbUrl + '&connection_limit=1' : dbUrl + '?connection_limit=1'
const prisma  = new PrismaClient({ datasources: { db: { url: connUrl } } })

const NEW_YEAR9: { firstName: string; lastName: string; email: string }[] = [
  { firstName: 'Jasmine',   lastName: 'Clarke',    email: 'j.clarke9@students.omnisdemo.school'    },
  { firstName: 'Finn',      lastName: 'McCarthy',  email: 'f.mccarthy@students.omnisdemo.school'   },
  { firstName: 'Aisha',     lastName: 'Rahman',    email: 'a.rahman@students.omnisdemo.school'     },
  { firstName: 'Luke',      lastName: 'Patterson', email: 'l.patterson@students.omnisdemo.school'  },
  { firstName: 'Georgia',   lastName: 'Burns',     email: 'g.burns@students.omnisdemo.school'      },
  { firstName: 'Caleb',     lastName: 'Hassan',    email: 'c.hassan@students.omnisdemo.school'     },
  { firstName: 'Ellie',     lastName: 'Porter',    email: 'e.porter@students.omnisdemo.school'     },
  { firstName: 'Nathan',    lastName: 'Dahl',      email: 'n.dahl@students.omnisdemo.school'       },
  { firstName: 'Aaliya',    lastName: 'Begum',     email: 'a.begum@students.omnisdemo.school'      },
  { firstName: 'Finley',    lastName: 'Brooks',    email: 'f.brooks@students.omnisdemo.school'     },
  { firstName: 'Leila',     lastName: 'Kaur',      email: 'l.kaur@students.omnisdemo.school'       },
  { firstName: 'Connor',    lastName: 'Reeves',    email: 'c.reeves@students.omnisdemo.school'     },
  { firstName: 'Niamh',     lastName: 'Sullivan',  email: 'n.sullivan@students.omnisdemo.school'   },
  { firstName: 'Tobias',    lastName: 'Webb',      email: 't.webb@students.omnisdemo.school'       },
  { firstName: 'Jessica',   lastName: 'Yuen',      email: 'j.yuen@students.omnisdemo.school'       },
  { firstName: 'Marcus',    lastName: 'Okafor',    email: 'm.okafor@students.omnisdemo.school'     },
  { firstName: 'Scarlett',  lastName: 'Barnes',    email: 's.barnes@students.omnisdemo.school'     },
  { firstName: 'Riley',     lastName: 'Fletcher',  email: 'r.fletcher@students.omnisdemo.school'   },
  { firstName: 'Priya',     lastName: 'Nair',      email: 'p.nair@students.omnisdemo.school'       },
  { firstName: 'Jamie',     lastName: 'Thornton',  email: 'j.thornton@students.omnisdemo.school'   },
]

const NEW_YEAR10: { firstName: string; lastName: string; email: string }[] = [
  { firstName: 'Hannah',    lastName: 'Griffiths', email: 'h.griffiths@students.omnisdemo.school'  },
  { firstName: 'Ethan',     lastName: 'Moody',     email: 'e.moody@students.omnisdemo.school'      },
  { firstName: 'Scarlett',  lastName: 'Hassan',    email: 's.hassan@students.omnisdemo.school'     },
  { firstName: 'Samuel',    lastName: 'Price',     email: 's.price@students.omnisdemo.school'      },
  { firstName: 'Anya',      lastName: 'Patel',     email: 'a.patel10@students.omnisdemo.school'    },
  { firstName: 'Callum',    lastName: 'Ross',      email: 'c.ross@students.omnisdemo.school'       },
  { firstName: 'Fatima',    lastName: 'Al-Amin',   email: 'f.alamin@students.omnisdemo.school'     },
  { firstName: 'Leo',       lastName: 'Jensen',    email: 'l.jensen@students.omnisdemo.school'     },
  { firstName: 'Abigail',   lastName: 'Morton',    email: 'a.morton@students.omnisdemo.school'     },
  { firstName: 'Jordan',    lastName: 'Kamara',    email: 'j.kamara@students.omnisdemo.school'     },
  { firstName: 'Imogen',    lastName: 'Weir',      email: 'i.weir@students.omnisdemo.school'       },
  { firstName: 'Reuben',    lastName: 'Brooks',    email: 'r.brooks@students.omnisdemo.school'     },
  { firstName: 'Layla',     lastName: 'Fitzpatrick',email: 'l.fitzpatrick@students.omnisdemo.school'},
  { firstName: 'Sebastian', lastName: 'Long',      email: 's.long@students.omnisdemo.school'       },
  { firstName: 'Charlotte', lastName: 'Diaz',      email: 'c.diaz@students.omnisdemo.school'       },
  { firstName: 'Toby',      lastName: 'Nwankwo',   email: 't.nwankwo@students.omnisdemo.school'    },
  { firstName: 'Maisie',    lastName: 'Simmons',   email: 'm.simmons@students.omnisdemo.school'    },
  { firstName: 'Jaylen',    lastName: 'Burke',     email: 'j.burke@students.omnisdemo.school'      },
  { firstName: 'Francesca', lastName: 'Shah',      email: 'f.shah@students.omnisdemo.school'       },
  { firstName: 'George',    lastName: 'Lawson',    email: 'g.lawson@students.omnisdemo.school'     },
  { firstName: 'Darcey',    lastName: 'Murphy',    email: 'd.murphy@students.omnisdemo.school'     },
  { firstName: 'Isaac',     lastName: 'Kennedy',   email: 'i.kennedy@students.omnisdemo.school'    },
]

const NEW_YEAR11: { firstName: string; lastName: string; email: string }[] = [
  { firstName: 'Amelia',    lastName: 'Banks',     email: 'a.banks@students.omnisdemo.school'      },
  { firstName: 'Rhys',      lastName: 'Morgan',    email: 'r.morgan@students.omnisdemo.school'     },
  { firstName: 'Charlotte', lastName: 'Fletcher',  email: 'c.fletcher@students.omnisdemo.school'   },
  { firstName: 'Marcus',    lastName: 'Campbell',  email: 'm.campbell@students.omnisdemo.school'   },
  { firstName: 'Lily',      lastName: 'Singh',     email: 'l.singh@students.omnisdemo.school'      },
  { firstName: 'Finn',      lastName: "O'Brien",   email: 'f.obrien@students.omnisdemo.school'     },
  { firstName: 'Kezia',     lastName: 'Mensah',    email: 'k.mensah@students.omnisdemo.school'     },
  { firstName: 'Oscar',     lastName: 'Perkins',   email: 'o.perkins@students.omnisdemo.school'    },
  { firstName: 'Imogen',    lastName: 'Griffiths', email: 'i.griffiths@students.omnisdemo.school'  },
  { firstName: 'Zach',      lastName: 'Freeman',   email: 'z.freeman@students.omnisdemo.school'    },
  { firstName: 'Tia',       lastName: 'Baptiste',  email: 't.baptiste@students.omnisdemo.school'   },
  { firstName: 'Aaron',     lastName: 'Siddiqui',  email: 'a.siddiqui@students.omnisdemo.school'   },
  { firstName: 'Megan',     lastName: 'Walsh',     email: 'm.walsh11@students.omnisdemo.school'    },
  { firstName: 'Lewis',     lastName: 'Osei',      email: 'l.osei@students.omnisdemo.school'       },
  { firstName: 'Phoebe',    lastName: 'Armstrong', email: 'p.armstrong@students.omnisdemo.school'  },
  { firstName: 'Dominic',   lastName: 'Nwosu',     email: 'd.nwosu@students.omnisdemo.school'      },
  { firstName: 'Sasha',     lastName: 'Thornton',  email: 's.thornton@students.omnisdemo.school'   },
  { firstName: 'Callum',    lastName: 'Porter',    email: 'c.porter@students.omnisdemo.school'     },
  { firstName: 'Joanna',    lastName: 'Petrov',    email: 'j.petrov@students.omnisdemo.school'     },
  { firstName: 'Bradley',   lastName: 'Khan',      email: 'b.khan@students.omnisdemo.school'       },
  { firstName: 'Cassandra', lastName: 'Mills',     email: 'c.mills@students.omnisdemo.school'      },
  { firstName: 'Elijah',    lastName: 'Stone',     email: 'e.stone@students.omnisdemo.school'      },
]

async function seedClass(
  schoolId:     string,
  classId:      string,
  students:     { firstName: string; lastName: string; email: string }[],
  yearGroup:    number,
  passwordHash: string,
) {
  const users: { id: string }[] = []
  for (const s of students) {
    const user = await prisma.user.upsert({
      where:  { email: s.email },
      create: { schoolId, email: s.email, passwordHash, role: 'STUDENT', firstName: s.firstName, lastName: s.lastName, yearGroup },
      update: {},
    })
    await prisma.enrolment.upsert({
      where:  { classId_userId: { classId, userId: user.id } },
      create: { classId, userId: user.id },
      update: {},
    })
    users.push(user)
  }
  return users
}

async function addSubmissions(
  schoolId:    string,
  homeworkId:  string,
  students:    { id: string }[],
  rate:        number,
  markRate:    number,
  content:     string,
  scoreRange:  [number, number],
) {
  const submitters = students.filter((_, i) => i / students.length < rate)
  for (const [idx, s] of submitters.entries()) {
    const isMarked = idx / submitters.length < markRate
    const score    = Math.round(scoreRange[0] + Math.random() * (scoreRange[1] - scoreRange[0]))
    await prisma.submission.upsert({
      where:  { homeworkId_studentId: { homeworkId, studentId: s.id } },
      create: {
        schoolId,
        homeworkId,
        studentId:   s.id,
        content,
        status:      isMarked ? SubmissionStatus.RETURNED : SubmissionStatus.SUBMITTED,
        submittedAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        markedAt:    isMarked ? new Date(Date.now() - 86400000) : null,
        finalScore:  isMarked ? score : null,
        feedback:    isMarked ? 'Good engagement with the text. Work on using more specific quotations to support your analysis.' : null,
      },
      update: {},
    })
  }
  return submitters.length
}

async function main() {
  console.log('\nSeeding English class students...\n')

  const school = await prisma.school.findFirst({ where: { wondeId: 'demo-school' } })
  if (!school) throw new Error('Run npm run db:seed first')

  const passwordHash = await bcrypt.hash('Demo1234!', 10)

  const cls9E  = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '9E/En1'  } })
  const cls10E = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '10E/En2' } })
  const cls11E = await prisma.schoolClass.findFirst({ where: { schoolId: school.id, name: '11E/En1' } })

  if (!cls9E || !cls10E || !cls11E) {
    throw new Error('English classes not found. Run npm run db:seed first.')
  }

  // ── Year 9 ──────────────────────────────────────────────────────────────────
  console.log('  Adding Year 9 students to 9E/En1...')
  const new9E = await seedClass(school.id, cls9E.id, NEW_YEAR9, 9, passwordHash)
  console.log(`    ✓ ${new9E.length} students added`)

  // Add submissions for 9E/En1 homework
  const hw9E = await prisma.homework.findMany({
    where: { classId: cls9E.id, status: 'PUBLISHED' },
    orderBy: { dueAt: 'asc' },
  })
  for (const hw of hw9E) {
    const n = await addSubmissions(
      school.id, hw.id, new9E, 0.85, 0.6,
      "Inspector Goole is presented as a mysterious, omniscient figure. Priestley uses him to expose the Birlings' hypocrisy. The line \"We are members of one body\" reflects Priestley's socialist message — that responsibility is collective. His sudden departure at the end heightens the dramatic irony, leaving the audience questioning his identity and purpose.",
      [52, 88],
    )
    console.log(`    ✓ ${n} submissions for "${hw.title}"`)
  }

  // ── Year 10 ─────────────────────────────────────────────────────────────────
  console.log('\n  Adding Year 10 students to 10E/En2...')
  const new10E = await seedClass(school.id, cls10E.id, NEW_YEAR10, 10, passwordHash)
  console.log(`    ✓ ${new10E.length} students added`)

  const hw10E = await prisma.homework.findMany({
    where: { classId: cls10E.id, status: 'PUBLISHED' },
    orderBy: { dueAt: 'asc' },
  })
  for (const hw of hw10E) {
    const n = await addSubmissions(
      school.id, hw.id, new10E, 0.82, 0.55,
      "Shakespeare presents Macbeth's ambition as ultimately self-destructive. In the soliloquy \"I have no spur to prick the sides of my intent\", Macbeth acknowledges that only vaulting ambition drives him — a dangerous and unstable motivation. Lady Macbeth, however, presents ambition as calculated and rational, manipulating her husband's conscience through the famous \"unsex me here\" speech.",
      [55, 90],
    )
    console.log(`    ✓ ${n} submissions for "${hw.title}"`)
  }

  // ── Year 11 ─────────────────────────────────────────────────────────────────
  console.log('\n  Adding Year 11 students to 11E/En1...')
  const new11E = await seedClass(school.id, cls11E.id, NEW_YEAR11, 11, passwordHash)
  console.log(`    ✓ ${new11E.length} students added`)

  const hw11E = await prisma.homework.findMany({
    where: { classId: cls11E.id, status: 'PUBLISHED' },
    orderBy: { dueAt: 'asc' },
  })
  for (const hw of hw11E) {
    const n = await addSubmissions(
      school.id, hw.id, new11E, 0.88, 0.65,
      "The writer uses a range of structural and language techniques to convey their perspective. The deliberate shift in tense in the third paragraph creates a sense of immediacy, drawing the reader into the experience. The use of the second person, 'you', is particularly effective in positioning the reader as a participant rather than an observer, a technique that challenges assumptions and demands engagement.",
      [58, 92],
    )
    console.log(`    ✓ ${n} submissions for "${hw.title}"`)
  }

  // Final counts
  const count9E  = await prisma.enrolment.count({ where: { classId: cls9E.id } })
  const count10E = await prisma.enrolment.count({ where: { classId: cls10E.id } })
  const count11E = await prisma.enrolment.count({ where: { classId: cls11E.id } })

  console.log('\n✅  English class seed complete!')
  console.log(`  9E/En1:  ${count9E} students`)
  console.log(`  10E/En2: ${count10E} students`)
  console.log(`  11E/En1: ${count11E} students`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
