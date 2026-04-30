import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding TA notes demo data...')

  // Find demo school via existing teacher
  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER', email: { contains: 'omnisdemo' } },
  })

  if (!teacher) {
    console.log('Demo school not found — run npm run db:seed first')
    return
  }

  const schoolId = teacher.schoolId

  // Find or create a TEACHING_ASSISTANT user
  let ta = await prisma.user.findFirst({
    where: { schoolId, role: 'TEACHING_ASSISTANT' },
  })

  if (!ta) {
    const hash = await bcrypt.hash('Demo1234!', 12)
    ta = await prisma.user.create({
      data: {
        schoolId,
        email:     'j.taylor@omnisdemo.school',
        passwordHash: hash,
        firstName: 'Jordan',
        lastName:  'Taylor',
        role:      'TEACHING_ASSISTANT',
      },
    })
    console.log('Created TA user: j.taylor@omnisdemo.school')
  } else {
    console.log(`Found existing TA: ${ta.firstName} ${ta.lastName}`)
  }

  // Find demo students
  const students = await prisma.user.findMany({
    where: { schoolId, role: 'STUDENT' },
    take: 3,
    orderBy: { lastName: 'asc' },
  })

  if (students.length === 0) {
    console.log('No students found — run npm run db:seed first')
    return
  }

  // Find a class the students are enrolled in (if any) for classId
  const enrolment = await prisma.enrolment.findFirst({
    where: { userId: students[0].id },
    select: { classId: true },
  })
  const classId = enrolment?.classId ?? null

  // Avoid duplicate seeds
  const existing = await prisma.taNote.count({ where: { schoolId, authorId: ta.id } })
  if (existing > 0) {
    console.log(`TA notes already seeded (${existing} found). Skipping.`)
    return
  }

  // Create 3 demo TA notes
  await prisma.taNote.create({
    data: {
      studentId: students[0].id,
      schoolId,
      authorId:  ta.id,
      content:   'Struggled with the reading task today — needed all questions read aloud. Recommend printed large-font version next lesson.',
      isUrgent:  true,
      classId,
    },
  })

  await prisma.taNote.create({
    data: {
      studentId: students[1 % students.length].id,
      schoolId,
      authorId:  ta.id,
      content:   'Good session — completed the worksheet independently and helped a peer with Q4. Positive progress with number bonds.',
      isUrgent:  false,
      classId,
    },
  })

  await prisma.taNote.create({
    data: {
      studentId: students[2 % students.length].id,
      schoolId,
      authorId:  ta.id,
      content:   'Became distressed during group work. Sat with them 1:1 for last 15 minutes. May need a quieter seating arrangement.',
      isUrgent:  false,
      classId,
    },
  })

  console.log('Created 3 demo TA notes.')
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
