/**
 * seed-apdr.ts
 *
 * Idempotent script that creates an active APDR cycle for every SEND student
 * in the demo school who does not already have one.
 *
 * Content is generated from the student's existing ILP data.
 * Run with: node -e "require('dotenv').config({path:'.env.local'}); const {execSync} = require('child_process'); execSync('npx tsx prisma/seed-apdr.ts', {stdio:'inherit', env:{...process.env}})"
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const school = await prisma.school.findFirst({ where: { name: { contains: 'Demo' } } })
  if (!school) { console.error('No demo school'); process.exit(1) }

  // Find the SENCO user to use as createdBy
  const senco = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'SENCO' },
    select: { id: true },
  })
  if (!senco) { console.error('No SENCO found'); process.exit(1) }

  // Get all SEND students with active status
  const sendStudents = await prisma.sendStatus.findMany({
    where: {
      student:    { schoolId: school.id },
      activeStatus: { not: 'NONE' },
    },
    select: { studentId: true },
  })

  const studentIds = sendStudents.map(s => s.studentId)
  console.log(`Found ${studentIds.length} SEND students`)

  // Find which students already have an active APDR
  const existingApdr = await prisma.assessPlanDoReview.findMany({
    where: { studentId: { in: studentIds }, status: 'ACTIVE' },
    select: { studentId: true },
  })
  const existingSet = new Set(existingApdr.map(a => a.studentId))
  console.log(`${existingSet.size} already have an active APDR`)

  // Get ILP data for students who need APDRs
  const needsApdr = studentIds.filter(id => !existingSet.has(id))
  console.log(`Creating APDRs for ${needsApdr.length} students...`)

  const ilps = await prisma.individualLearningPlan.findMany({
    where:   { studentId: { in: needsApdr }, status: 'ACTIVE' },
    select:  { studentId: true, currentStrengths: true, areasOfNeed: true, strategies: true, successCriteria: true },
  })
  const ilpMap = new Map(ilps.map(i => [i.studentId, i]))

  const users = await prisma.user.findMany({
    where:  { id: { in: needsApdr } },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = new Map(users.map(u => [u.id, u]))

  // Review date — 13 weeks from now (one term)
  const reviewDate = new Date(Date.now() + 13 * 7 * 24 * 60 * 60 * 1000)

  let created = 0
  for (const studentId of needsApdr) {
    const ilp  = ilpMap.get(studentId)
    const user = userMap.get(studentId)
    const name = user ? `${user.firstName} ${user.lastName}` : 'This student'

    const assessContent = ilp
      ? `Strengths: ${ilp.currentStrengths}. Areas of need: ${ilp.areasOfNeed}. Gathered from classroom observation, teacher feedback, SEND screening and learner voice.`
      : `Initial assessment to be completed by class teacher and SENCO. Schedule learner voice interview and review any existing screening data.`

    const planContent = ilp
      ? `Targeted strategies: ${ilp.strategies.join('; ')}. Success criteria: ${ilp.successCriteria}. Support to be co-ordinated by SENCO with input from all subject teachers.`
      : `Plan to be agreed at next SEND review meeting. Interim: class teacher to apply universal SEND adjustments and note any concerns.`

    await prisma.assessPlanDoReview.create({
      data: {
        schoolId:     school.id,
        studentId,
        cycleNumber:  1,
        assessContent,
        planContent,
        doContent:    '',
        reviewContent: '',
        status:       'ACTIVE',
        reviewDate,
        createdBy:    senco.id,
        approvedBySenco: false,
      },
    })
    created++
    console.log(`  Created APDR for ${name}`)
  }

  console.log(`\nDone. Created ${created} APDR cycles.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
