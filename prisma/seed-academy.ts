/**
 * prisma/seed-academy.ts
 *
 * Seeds academy/MAT demo data:
 *   - SchoolGroup "Northern Academies Trust"
 *   - ACADEMY_ADMIN user  academy@omnis.edu / Demo1234!
 *   - 4 synthetic schools with realistic student + staff + class counts
 *   - Links the main demo school (Omnis Demo School) into the trust
 *
 * Idempotent — safe to re-run.
 * Run with: npm run academy:seed
 */

import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

// ─── Synthetic name lists ─────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Amara','Ben','Chloe','Daniel','Ellie','Finn','Grace','Harry','Isla','Jasper',
  'Kira','Leo','Maya','Noah','Olivia','Phoebe','Quinn','Rafi','Sophia','Theo',
  'Uma','Victor','Willow','Xander','Yasmine','Zoe','Aiden','Beth','Connor','Daisy',
  'Ethan','Freya','George','Hannah','Ivan','Jade','Kyle','Layla','Marcus','Nina',
  'Oscar','Priya','Ryan','Sadie','Tariq','Ursula','Valentina','Wesley','Xiomara','Yusuf',
]
const LAST_NAMES = [
  'Ahmed','Baker','Chen','Davies','Evans','Foster','Green','Hughes','Ibrahim','Jones',
  'Khan','Lewis','Miller','Nguyen','O\'Brien','Patel','Quinn','Roberts','Singh','Thomas',
  'Usman','Vickers','Williams','Xavier','Young','Zhang','Ali','Brown','Campbell','Dixon',
  'Ellis','Ford','Garcia','Hall','Iqbal','Jackson','King','Lambert','Morris','Nelson',
  'Owen','Price','Rahman','Scott','Taylor','Uddin','Vasquez','Walker','Xu','Yates',
]

const SUBJECTS = ['English','Mathematics','Science','History','Geography','French','Art','PE','Computing','Music']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function syntheticName(idx: number): { firstName: string; lastName: string } {
  return {
    firstName: FIRST_NAMES[idx % FIRST_NAMES.length],
    lastName:  LAST_NAMES[Math.floor(idx / FIRST_NAMES.length) % LAST_NAMES.length],
  }
}

async function seedSchool(opts: {
  id:          string
  name:        string
  urn:         string
  phase:       string
  region:      string
  onboardedAt: Date | null
  studentCount: number
  staffCount:   number
  classCount:   number
  groupId:      string
  passwordHash: string
}) {
  const school = await prisma.school.upsert({
    where:  { urn: opts.urn },
    update: { name: opts.name, phase: opts.phase, isActive: true, onboardedAt: opts.onboardedAt, schoolGroupId: opts.groupId },
    create: {
      id:           opts.id,
      name:         opts.name,
      urn:          opts.urn,
      phase:        opts.phase,
      region:       opts.region,
      isActive:     true,
      onboardedAt:  opts.onboardedAt,
      schoolGroupId: opts.groupId,
    },
  })

  // ── Staff ──
  const staffData: { email: string; firstName: string; lastName: string; role: Role }[] = []
  // 1 school admin
  staffData.push({
    email:     `admin@${opts.urn}.school`,
    firstName: 'School',
    lastName:  'Admin',
    role:      Role.SCHOOL_ADMIN,
  })
  // 1 SENCO
  staffData.push({
    email:     `senco@${opts.urn}.school`,
    firstName: 'Jane',
    lastName:  'Turner',
    role:      Role.SENCO,
  })
  // Remaining as teachers
  for (let i = 2; i < opts.staffCount; i++) {
    const n = syntheticName(i + 200)
    staffData.push({
      email:     `staff${i}@${opts.urn}.school`,
      firstName: n.firstName,
      lastName:  n.lastName,
      role:      Role.TEACHER,
    })
  }

  for (const s of staffData) {
    await prisma.user.upsert({
      where:  { email: s.email },
      update: {},
      create: { email: s.email, passwordHash: opts.passwordHash, role: s.role, firstName: s.firstName, lastName: s.lastName, schoolId: school.id, isActive: true, dpaAcceptedAt: new Date(), termsAcceptedAt: new Date() },
    })
  }

  // ── Classes ──
  const yearGroups = opts.phase === 'sixth_form' ? [12, 13] : [7, 8, 9, 10, 11, 12, 13]
  const classesToCreate = []
  for (let i = 0; i < opts.classCount; i++) {
    const yr = yearGroups[i % yearGroups.length]
    const subj = SUBJECTS[i % SUBJECTS.length]
    const set  = String.fromCharCode(65 + Math.floor(i / yearGroups.length) % 4) // A-D
    classesToCreate.push({
      id:         `${opts.id}-CLS-${i}`,
      name:       `${yr}${subj.slice(0, 2).toUpperCase()}/${set}`,
      subject:    subj,
      yearGroup:  yr,
      schoolId:   school.id,
      department: subj,
    })
  }
  for (const c of classesToCreate) {
    await prisma.schoolClass.upsert({
      where:  { id: c.id },
      update: {},
      create: c,
    })
  }

  // ── Students ──
  // Use createMany with skipDuplicates for speed
  const studentRows = []
  for (let i = 0; i < opts.studentCount; i++) {
    const n  = syntheticName(i)
    const yr = yearGroups[i % yearGroups.length]
    // ~70% have activated their account
    const activatedAt = i % 10 < 7 ? new Date(Date.now() - Math.random() * 60 * 86400_000) : null
    studentRows.push({
      email:        `student${i}@${opts.urn}.school`,
      passwordHash: opts.passwordHash,
      role:         Role.STUDENT as Role,
      firstName:    n.firstName,
      lastName:     n.lastName,
      schoolId:     school.id,
      yearGroup:    yr,
      isActive:     true,
      activatedAt,
    })
  }
  await prisma.user.createMany({ data: studentRows, skipDuplicates: true })

  console.log(`  ✓ ${opts.name}: ${opts.studentCount} students, ${opts.staffCount} staff, ${opts.classCount} classes`)
  return school
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Academy Seed — Northern Academies Trust')
  console.log('═══════════════════════════════════════════\n')

  const passwordHash = await bcrypt.hash('Demo1234!', 10)

  // ── 1. SchoolGroup ─────────────────────────────────────────────────────────
  const group = await prisma.schoolGroup.upsert({
    where:  { id: 'GROUP-NORTHERN-TRUST' },
    update: { name: 'Northern Academies Trust' },
    create: { id: 'GROUP-NORTHERN-TRUST', name: 'Northern Academies Trust' },
  })
  console.log(`✓ SchoolGroup: ${group.name}`)

  // ── 2. Academy admin user ──────────────────────────────────────────────────
  // Needs a school — use the platform school or create a trust HQ school
  const hq = await prisma.school.upsert({
    where:  { urn: 'TRUST-HQ' },
    update: { schoolGroupId: group.id },
    create: {
      id:           'SCHOOL-TRUST-HQ',
      name:         'Northern Academies Trust HQ',
      urn:          'TRUST-HQ',
      phase:        'trust',
      isActive:     true,
      schoolGroupId: group.id,
    },
  })

  const academyAdmin = await prisma.user.upsert({
    where:  { email: 'academy@omnis.edu' },
    update: {},
    create: {
      email:        'academy@omnis.edu',
      passwordHash,
      role:         Role.ACADEMY_ADMIN,
      firstName:    'Academy',
      lastName:     'Admin',
      schoolId:     hq.id,
      isActive:     true,
    },
  })
  console.log(`✓ Academy admin: ${academyAdmin.email}`)

  // ── 3. Link existing demo school to the trust ──────────────────────────────
  const demoSchool = await prisma.school.findFirst({ where: { wondeId: 'demo-school' } })
  if (demoSchool) {
    await prisma.school.update({ where: { id: demoSchool.id }, data: { schoolGroupId: group.id } })
    console.log(`✓ Linked existing demo school (${demoSchool.name}) to trust`)
  }

  // ── 4. Synthetic schools ───────────────────────────────────────────────────
  console.log('\nCreating synthetic schools...')

  await seedSchool({
    id:           'SCHOOL-RIVERSIDE-SEC',
    name:         'Riverside Secondary',
    urn:          'SYN-001',
    phase:        'secondary',
    region:       'North West',
    onboardedAt:  new Date('2025-09-01'),
    studentCount: 847,
    staffCount:   62,
    classCount:   45,
    groupId:      group.id,
    passwordHash,
  })

  await seedSchool({
    id:           'SCHOOL-PARKSIDE-HIGH',
    name:         'Parkside High School',
    urn:          'SYN-002',
    phase:        'secondary',
    region:       'North West',
    onboardedAt:  new Date('2025-11-12'),
    studentCount: 612,
    staffCount:   48,
    classCount:   38,
    groupId:      group.id,
    passwordHash,
  })

  await seedSchool({
    id:           'SCHOOL-ST-MARYS',
    name:         "St. Mary's Academy",
    urn:          'SYN-003',
    phase:        'secondary',
    region:       'Yorkshire',
    onboardedAt:  new Date('2026-01-08'),
    studentCount: 1120,
    staffCount:   84,
    classCount:   56,
    groupId:      group.id,
    passwordHash,
  })

  await seedSchool({
    id:           'SCHOOL-HILLSIDE-COLL',
    name:         'Hillside Sixth Form College',
    urn:          'SYN-004',
    phase:        'sixth_form',
    region:       'Yorkshire',
    onboardedAt:  null,          // not yet onboarded — shows amber in academy table
    studentCount: 398,
    staffCount:   34,
    classCount:   28,
    groupId:      group.id,
    passwordHash,
  })

  console.log('\n═══════════════════════════════════════════')
  console.log('  Academy seed complete')
  console.log('  Academy Admin: academy@omnis.edu / Demo1234!')
  console.log('  Platform Admin: platform@omnis.edu / Demo1234!')
  console.log('═══════════════════════════════════════════\n')
}

main()
  .catch(err => { console.error('\nFATAL:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
