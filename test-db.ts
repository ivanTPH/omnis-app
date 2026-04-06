import { prisma } from './lib/prisma'

async function main() {
  try {
    const cls = await prisma.schoolClass.findFirst({ select: { id: true, name: true } })
    console.log('schoolClass OK:', cls?.id, cls?.name)
    
    try {
      const baselines = await prisma.studentBaseline.findFirst()
      console.log('studentBaseline OK:', baselines ? 'has data' : 'empty table')
    } catch(e: any) { console.error('studentBaseline FAIL:', e.message?.split('\n')[0]) }
    
    try {
      const preds = await prisma.teacherPrediction.findFirst()
      console.log('teacherPrediction OK:', preds ? 'has data' : 'empty table')
    } catch(e: any) { console.error('teacherPrediction FAIL:', e.message?.split('\n')[0]) }
    
    try {
      const lp = await prisma.learnerPassport.findFirst()
      console.log('learnerPassport OK:', lp ? 'has data' : 'empty table')
    } catch(e: any) { console.error('learnerPassport FAIL:', e.message?.split('\n')[0]) }
    
    try {
      const user = await prisma.user.findFirst({ select: { id: true, supportSnapshot: true, attendancePercentage: true } })
      console.log('User new fields OK:', user?.id)
    } catch(e: any) { console.error('User new fields FAIL:', e.message?.split('\n')[0]) }
    
    try {
      const wsr = await prisma.wondeSenRecord.findFirst()
      console.log('wondeSenRecord OK:', wsr ? 'has data' : 'empty table')
    } catch(e: any) { console.error('wondeSenRecord FAIL:', e.message?.split('\n')[0]) }
    
  } catch(e: any) {
    console.error('OUTER ERROR:', e.message?.split('\n')[0])
  }
  await prisma.$disconnect()
}

main()
