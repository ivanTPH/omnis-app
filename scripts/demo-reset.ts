/**
 * demo-reset.ts
 * Wipes all demo school data and user accounts, preserving:
 *   • The School record
 *   • SCHOOL_ADMIN and PLATFORM_ADMIN user accounts
 *   • Wonde tables (WondeSchool, WondeStudent, etc.)
 *   • OakSubject / OakUnit / OakLesson content
 *   • SendScoreCache / SendQualityScore (global Oak caches)
 *
 * Run with:  npm run demo:reset
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const PRESERVED_EMAILS = ['admin@omnisdemo.school', 'platform@omnis.edu']

// ── Confirmation prompt ────────────────────────────────────────────────────────

async function confirm(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    console.log('\n⚠️  WARNING: This will delete ALL demo data for the demo school.')
    console.log('   SEND records, ILPs, homeworks, lessons, submissions — all gone.')
    console.log('   School record, admin accounts, Wonde tables, and Oak content are preserved.\n')
    rl.question('Type CONFIRM to proceed: ', answer => {
      rl.close()
      resolve(answer.trim() === 'CONFIRM')
    })
  })
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Find demo school via known admin ──────────────────────────────────
  const adminUser = await prisma.user.findUnique({
    where:  { email: 'admin@omnisdemo.school' },
    select: { schoolId: true },
  })
  if (!adminUser?.schoolId) {
    console.error('Could not find demo school — admin@omnisdemo.school not found.')
    process.exit(1)
  }
  const schoolId = adminUser.schoolId
  const school   = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
  console.log(`\nFound demo school: ${school?.name ?? schoolId}`)

  // ── 2. Confirm ────────────────────────────────────────────────────────────
  const ok = await confirm()
  if (!ok) { console.log('Aborted.'); process.exit(0) }

  console.log('\nResetting demo data…')

  // ── 3. Collect all non-admin user IDs ─────────────────────────────────────
  const preserved = await prisma.user.findMany({
    where:  { email: { in: PRESERVED_EMAILS } },
    select: { id: true },
  })
  const preservedIds = preserved.map(u => u.id)

  const allUsers = await prisma.user.findMany({
    where:  { schoolId, id: { notIn: preservedIds } },
    select: { id: true },
  })
  const allUserIds = allUsers.map(u => u.id)
  console.log(`  Found ${allUserIds.length} non-admin user accounts to remove`)

  // ── 4. Revision program ─────────────────────────────────────────────────
  await prisma.revisionProgress.deleteMany({ where: { schoolId } })
  await prisma.revisionTask.deleteMany({ where: { schoolId } })
  await prisma.revisionAnalyticsCache.deleteMany({ where: { schoolId } })
  await prisma.revisionProgram.deleteMany({ where: { schoolId } })
  console.log('  ✓ Revision programs')

  // ── 5. Student revision (no schoolId — filter by studentId) ───────────────
  if (allUserIds.length > 0) {
    await prisma.revisionConfidence.deleteMany({ where: { studentId: { in: allUserIds } } })
    await prisma.revisionSession.deleteMany({ where: { studentId: { in: allUserIds } } })
    await prisma.revisionExam.deleteMany({ where: { studentId: { in: allUserIds } } })
  }
  console.log('  ✓ Student revision sessions')

  // ── 6. Cover ─────────────────────────────────────────────────────────────
  await prisma.coverAssignment.deleteMany({ where: { schoolId } })
  await prisma.staffAbsence.deleteMany({ where: { schoolId } })
  console.log('  ✓ Cover assignments')

  // ── 7. Messaging ─────────────────────────────────────────────────────────
  await prisma.msgMessage.deleteMany({ where: { thread: { schoolId } } })
  await prisma.msgParticipant.deleteMany({ where: { thread: { schoolId } } })
  await prisma.msgThread.deleteMany({ where: { schoolId } })
  console.log('  ✓ Messages')

  // ── 8. Notifications ─────────────────────────────────────────────────────
  await prisma.notification.deleteMany({ where: { schoolId } })
  await prisma.sendNotification.deleteMany({ where: { schoolId } })
  console.log('  ✓ Notifications')

  // ── 9. ILP evidence + EHCP evidence ──────────────────────────────────────
  await prisma.ilpEvidenceEntry.deleteMany({ where: { schoolId } })
  // HomeworkEhcpEvidence has no schoolId — filter via submission
  await prisma.homeworkEhcpEvidence.deleteMany({ where: { submission: { schoolId } } })
  // IlpHomeworkLink has no schoolId — filter via homework
  await prisma.ilpHomeworkLink.deleteMany({ where: { homework: { schoolId } } })
  console.log('  ✓ ILP/EHCP evidence')

  // ── 10. EHCP ─────────────────────────────────────────────────────────────
  await prisma.ehcpOutcome.deleteMany({ where: { ehcp: { schoolId } } })
  await prisma.ehcpPlan.deleteMany({ where: { schoolId } })
  console.log('  ✓ EHCP plans')

  // ── 11. APDR + ILP ───────────────────────────────────────────────────────
  await prisma.assessPlanDoReview.deleteMany({ where: { schoolId } })
  await prisma.ilpAuditEntry.deleteMany({ where: { ilp: { schoolId } } })
  await prisma.ilpTarget.deleteMany({ where: { ilp: { schoolId } } })
  await prisma.individualLearningPlan.deleteMany({ where: { schoolId } })
  await prisma.learnerPassport.deleteMany({ where: { schoolId } })
  console.log('  ✓ ILPs + K Plans + APDR')

  // ── 12. SEND (SendStatus has no schoolId) ────────────────────────────────
  await prisma.earlyWarningFlag.deleteMany({ where: { schoolId } })
  await prisma.sendConcern.deleteMany({ where: { schoolId } })
  if (allUserIds.length > 0) {
    await prisma.sendStatus.deleteMany({ where: { studentId: { in: allUserIds } } })
  }
  console.log('  ✓ SEND records')

  // ── 13. GDPR ─────────────────────────────────────────────────────────────
  await prisma.dataSubjectRequest.deleteMany({ where: { schoolId } })
  // ConsentRecord has no schoolId — delete via purposeId
  const purposes = await prisma.consentPurpose.findMany({ where: { schoolId }, select: { id: true } })
  if (purposes.length > 0) {
    const purposeIds = purposes.map(p => p.id)
    await prisma.consentRecord.deleteMany({ where: { purposeId: { in: purposeIds } } })
  }
  await prisma.consentPurpose.deleteMany({ where: { schoolId } })
  console.log('  ✓ GDPR consent')

  // ── 14. Submissions + integrity ─────────────────────────────────────────
  // IntegrityReviewLog has no schoolId — delete via signal → attempt → submission → schoolId
  // (complex chain — use raw delete by schoolId via submissions)
  const subIds = await prisma.submission.findMany({ where: { schoolId }, select: { id: true } })
  if (subIds.length > 0) {
    const sIds = subIds.map(s => s.id)
    const attempts = await prisma.submissionAttempt.findMany({ where: { submissionId: { in: sIds } }, select: { id: true } })
    if (attempts.length > 0) {
      const aIds = attempts.map(a => a.id)
      await prisma.submissionAttemptAnswer.deleteMany({ where: { attemptId: { in: aIds } } })
      const signals = await prisma.submissionIntegritySignal.findMany({ where: { attemptId: { in: aIds } }, select: { id: true } })
      if (signals.length > 0) {
        const sigIds = signals.map(s => s.id)
        await prisma.integrityReviewLog.deleteMany({ where: { signalId: { in: sigIds } } })
        await prisma.submissionIntegritySignal.deleteMany({ where: { id: { in: sigIds } } })
      }
      await prisma.submissionAttempt.deleteMany({ where: { id: { in: aIds } } })
    }
  }
  await prisma.integrityPatternCase.deleteMany({ where: { schoolId } })
  await prisma.submission.deleteMany({ where: { schoolId } })
  console.log('  ✓ Submissions')

  // ── 15. Homework ─────────────────────────────────────────────────────────
  await prisma.homeworkQuestion.deleteMany({ where: { homework: { schoolId } } })
  await prisma.homework.deleteMany({ where: { schoolId } })
  console.log('  ✓ Homework')

  // ── 16. Lessons + resources ──────────────────────────────────────────────
  await prisma.resourceReview.deleteMany({ where: { resource: { schoolId } } })
  await prisma.resource.deleteMany({ where: { schoolId } })
  await prisma.lesson.deleteMany({ where: { schoolId } })
  console.log('  ✓ Lessons + resources')

  // ── 17. Analytics ─────────────────────────────────────────────────────────
  await prisma.classPerformanceAggregate.deleteMany({ where: { schoolId } })
  await prisma.subjectMedianAggregate.deleteMany({ where: { schoolId } })
  console.log('  ✓ Analytics aggregates')

  // ── 18. Adaptive learning ─────────────────────────────────────────────────
  await prisma.learningSequence.deleteMany({ where: { schoolId } })
  await prisma.subjectAdaptationProfile.deleteMany({ where: { schoolId } })
  await prisma.studentLearningProfile.deleteMany({ where: { schoolId } })
  console.log('  ✓ Adaptive learning profiles')

  // ── 19. Baselines + predictions ──────────────────────────────────────────
  await prisma.teacherPrediction.deleteMany({ where: { schoolId } })
  await prisma.studentBaseline.deleteMany({ where: { schoolId } })
  console.log('  ✓ Baselines + predictions')

  // ── 20. Plans ─────────────────────────────────────────────────────────────
  await prisma.planTarget.deleteMany({ where: { plan: { schoolId } } })
  await prisma.plan.deleteMany({ where: { schoolId } })
  console.log('  ✓ Plans')

  // ── 21. Audit ─────────────────────────────────────────────────────────────
  await prisma.auditLog.deleteMany({ where: { schoolId } })
  console.log('  ✓ Audit log')

  // ── 22. Classes ───────────────────────────────────────────────────────────
  await prisma.enrolment.deleteMany({ where: { class: { schoolId } } })
  await prisma.classTeacher.deleteMany({ where: { class: { schoolId } } })
  await prisma.schoolClass.deleteMany({ where: { schoolId } })
  console.log('  ✓ Classes + enrolments')

  // ── 23. Parent-child links (no schoolId — filter by child/parent user) ───
  if (allUserIds.length > 0) {
    await prisma.parentChildLink.deleteMany({
      where: { OR: [{ childId: { in: allUserIds } }, { parentId: { in: allUserIds } }] },
    })
  }
  console.log('  ✓ Parent-child links')

  // ── 24. User settings + accessibility ────────────────────────────────────
  if (allUserIds.length > 0) {
    await prisma.userAccessibilitySettings.deleteMany({ where: { userId: { in: allUserIds } } })
    await prisma.userSettings.deleteMany({ where: { userId: { in: allUserIds } } })
  }
  console.log('  ✓ User settings')

  // ── 25. Users ─────────────────────────────────────────────────────────────
  const deletedUsers = await prisma.user.deleteMany({
    where: { schoolId, id: { notIn: preservedIds } },
  })
  console.log(`  ✓ Users (${deletedUsers.count} deleted, admins preserved)`)

  // ── 26. Term dates + feature flags ───────────────────────────────────────
  await prisma.termDate.deleteMany({ where: { schoolId } })
  await prisma.schoolFeatureFlag.deleteMany({ where: { schoolId } })
  console.log('  ✓ Term dates + feature flags')

  console.log('\n✅ Demo data reset complete.')
  console.log('   Run  npm run demo:seed  to restore the full demo environment.\n')
}

main()
  .catch(err => {
    console.error('Reset failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
