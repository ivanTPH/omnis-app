import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const school = await prisma.school.findFirst({ where: { name: { contains: 'Demo' } } })
  if (!school) { console.error('No demo school'); process.exit(1) }

  const students = await prisma.user.findMany({
    where: { schoolId: school.id, role: 'STUDENT' },
    include: {
      sendStatus:      true,
      studentIlps:     { include: { targets: true } },
      learnerPassports: true,
      learningProfile: true,
      ehcpPlans:       true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  const evidenceCounts = await (prisma as any).ilpEvidenceEntry.groupBy({
    by: ['studentId'], _count: { id: true },
  })
  const concernCounts = await (prisma as any).sendConcern.groupBy({
    by: ['studentId'], _count: { id: true },
  })
  const evMap = Object.fromEntries(evidenceCounts.map((e: any) => [e.studentId, e._count.id]))
  const coMap = Object.fromEntries(concernCounts.map((c: any) => [c.studentId, c._count.id]))

  console.log('\n' + '='.repeat(110))
  console.log('SEND DATA AUDIT — LIVE DB')
  console.log('='.repeat(110))
  console.log(
    'Name'.padEnd(22) +
    'Status'.padEnd(14) +
    'Need Area'.padEnd(36) +
    'ILP'.padEnd(5) +
    'Tgt'.padEnd(5) +
    'KPlan'.padEnd(7) +
    'LProf'.padEnd(7) +
    'EHCP'.padEnd(6) +
    'Evid'.padEnd(6) +
    'Conc'
  )
  console.log('-'.repeat(110))

  const gaps: { type: string; student: string; email: string }[] = []

  for (const s of students) {
    const name  = `${s.firstName} ${s.lastName}`.padEnd(22)
    const ss    = (s.sendStatus?.activeStatus ?? 'NONE').padEnd(14)
    const na    = (s.sendStatus?.needArea ?? '').substring(0, 34).padEnd(36)
    const ilp   = s.studentIlps.length > 0 ? 'YES' : '-'
    const tgts  = s.studentIlps.length > 0 ? String(s.studentIlps.reduce((n: number, i: any) => n + i.targets.length, 0)) : '-'
    const kp    = s.learnerPassports.length > 0 ? 'YES' : '-'
    const lp    = s.learningProfile ? 'YES' : '-'
    const ehcp  = s.ehcpPlans.length > 0 ? 'YES' : '-'
    const evid  = String(evMap[s.id] ?? 0)
    const conc  = String(coMap[s.id] ?? 0)

    console.log(
      name + ss + na +
      ilp.padEnd(5) + tgts.padEnd(5) + kp.padEnd(7) + lp.padEnd(7) +
      ehcp.padEnd(6) + evid.padEnd(6) + conc
    )

    const hasSend = s.sendStatus && s.sendStatus.activeStatus !== 'NONE'
    if (hasSend && s.studentIlps.length === 0)      gaps.push({ type: 'MISSING ILP',   student: `${s.firstName} ${s.lastName}`, email: s.email })
    if (hasSend && s.learnerPassports.length === 0)  gaps.push({ type: 'MISSING KPlan', student: `${s.firstName} ${s.lastName}`, email: s.email })
    if (hasSend && !s.learningProfile)               gaps.push({ type: 'MISSING LProf', student: `${s.firstName} ${s.lastName}`, email: s.email })
    // Only flag ILP-without-KPlan when the student actually has an active SEND status
    if (hasSend && s.studentIlps.length > 0 && s.learnerPassports.length === 0)
      gaps.push({ type: 'ILP no KPlan', student: `${s.firstName} ${s.lastName}`, email: s.email })
  }

  console.log('\nGAPS:')
  if (gaps.length === 0) { console.log('  None — all SEND students have ILP + K Plan + LearningProfile') }
  else { gaps.forEach(g => console.log(`  ⚠ ${g.type.padEnd(16)} ${g.student} (${g.email})`)) }
  console.log(`\nTotal students: ${students.length}`)
  console.log('SEND students:', students.filter(s => s.sendStatus?.activeStatus !== 'NONE' && s.sendStatus).length)
}

main().catch(console.error).finally(() => prisma.$disconnect())
