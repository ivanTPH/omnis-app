import { prisma } from './lib/prisma'
import { currentTermLabel, termLabelToDates } from './lib/termUtils'

async function main() {
  const cls = await prisma.schoolClass.findFirst({
    where: { name: '9E/En1' },
    select: { id: true, name: true, subject: true, schoolId: true }
  })
  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER', email: 'j.patel@omnisdemo.school' },
    select: { id: true, email: true }
  })
  console.log('Teacher:', teacher?.email, 'Class:', cls?.name, 'ID:', cls?.id)
  
  if (!cls || !teacher) { console.log('Not found'); return }
  
  const term = currentTermLabel()
  console.log('Term:', term)
  
  const enrolments = await prisma.enrolment.findMany({
    where: { classId: cls.id },
    select: { userId: true },
    distinct: ['userId'],
  })
  const studentIds = enrolments.map(e => e.userId)
  console.log('Students enrolled:', studentIds.length)
  
  try {
    const baselines = await prisma.studentBaseline.findMany({
      where: { studentId: { in: studentIds }, subject: cls.subject },
    })
    console.log('Baselines OK:', baselines.length)
  } catch(e: any) { console.error('BASELINE FAIL:', e.message?.split('\n')[0]) }
  
  try {
    const preds = await prisma.teacherPrediction.findMany({
      where: { studentId: { in: studentIds }, teacherId: teacher.id, subject: cls.subject, termLabel: term },
    })
    console.log('TeacherPrediction OK:', preds.length)
  } catch(e: any) { console.error('PREDICTION FAIL:', e.message?.split('\n')[0]) }
  
  try {
    const passports = await prisma.learnerPassport.findMany({
      where: { studentId: { in: studentIds }, schoolId: cls.schoolId },
    })
    console.log('LearnerPassport OK:', passports.length)
  } catch(e: any) { console.error('LEARNER PASSPORT FAIL:', e.message?.split('\n')[0]) }
  
  try {
    const plans = await prisma.ehcpPlan.findMany({
      where: { studentId: { in: studentIds }, schoolId: cls.schoolId },
      select: { studentId: true, sections: true },
    })
    console.log('EhcpPlan OK:', plans.length)
  } catch(e: any) { console.error('EHCP FAIL:', e.message?.split('\n')[0]) }
  
  await prisma.$disconnect()
}

main().catch(e => console.error('CRASH:', e.message?.split('\n')[0]))
