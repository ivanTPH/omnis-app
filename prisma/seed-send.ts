/**
 * prisma/seed-send.ts
 *
 * Seeds Phase 5 SEND monitoring data for the demo school (omnisdemo.school):
 *   - 6 SendConcerns
 *   - 2 IndividualLearningPlans with 3 targets each
 *   - 4 EarlyWarningFlags
 *   - 6 SendReviewLogs
 *   - 8 SendNotifications
 *
 * Idempotent: safe to run multiple times (uses skipDuplicates).
 * Run with: npm run send:seed
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Phase 5 SEND Seed — Omnis Demo School')
  console.log('═══════════════════════════════════════════\n')

  // ── Look up demo school and users ──────────────────────────────────────────
  const school = await prisma.school.findFirst({
    where: { name: { contains: 'Demo' } },
  })
  if (!school) {
    console.error('Demo school not found. Run npm run db:seed first.')
    process.exit(1)
  }
  console.log(`Found school: ${school.name} (${school.id})`)

  const senco = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'SENCO' },
  })
  const teacher = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'TEACHER' },
  })
  const hoy = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'HEAD_OF_YEAR' },
  })

  // Get 4 students
  const students = await prisma.user.findMany({
    where: { schoolId: school.id, role: 'STUDENT' },
    take: 4,
    orderBy: { lastName: 'asc' },
  })

  if (!senco || !teacher || students.length < 2) {
    console.error('Required demo users not found. Run npm run db:seed first.')
    process.exit(1)
  }

  const [s1, s2, s3, s4] = students
  console.log(`SENCO: ${senco.firstName} ${senco.lastName}`)
  console.log(`Teacher: ${teacher.firstName} ${teacher.lastName}`)
  console.log(`Students: ${students.map(s => `${s.firstName} ${s.lastName}`).join(', ')}`)

  // ── 1. SendConcerns ────────────────────────────────────────────────────────
  console.log('\n1. Creating SendConcerns...')

  const concerns = await Promise.all([
    prisma.sendConcern.create({
      data: {
        schoolId: school.id,
        studentId: s1.id,
        raisedBy: teacher.id,
        source: 'teacher',
        category: 'literacy',
        description: 'Aiden is struggling significantly with reading comprehension. He frequently misreads questions and is unable to infer meaning from complex texts. His written work is below the expected standard for Year 9.',
        evidenceNotes: 'Last 3 homework submissions scored below 40%. Class reading assessment: 45% (expected 70%+).',
        status: 'under_review',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.sendConcern.create({
      data: {
        schoolId: school.id,
        studentId: s1.id,
        raisedBy: hoy?.id ?? teacher.id,
        source: 'teacher',
        category: 'social_emotional',
        description: 'Aiden appears increasingly withdrawn during class activities. He has stopped participating in group work and was observed becoming very distressed during a timed assessment last week.',
        status: 'open',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.sendConcern.create({
      data: {
        schoolId: school.id,
        studentId: s2.id,
        raisedBy: teacher.id,
        source: 'teacher',
        category: 'numeracy',
        description: 'Maya is consistently unable to complete tasks involving numerical reasoning. She takes significantly longer than peers and frequently asks for reassurance on basic calculations.',
        status: 'open',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.sendConcern.create({
      data: {
        schoolId: school.id,
        studentId: s2.id,
        raisedBy: teacher.id,
        source: 'teacher',
        category: 'attendance',
        description: 'Maya has missed 8 of the last 20 lessons. When present, she appears fatigued and struggles to concentrate. Parent contact has not been responsive.',
        status: 'escalated',
        reviewedBy: senco.id,
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        reviewNotes: 'Escalated to SLT and EWO referral initiated. Parent meeting scheduled.',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    }),
    s3 ? prisma.sendConcern.create({
      data: {
        schoolId: school.id,
        studentId: s3.id,
        raisedBy: teacher.id,
        source: 'teacher',
        category: 'communication',
        description: 'Student demonstrates significant difficulties with verbal communication. Frequently misunderstands spoken instructions and struggles to express ideas clearly in class discussions.',
        status: 'monitoring',
        reviewedBy: senco.id,
        reviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        reviewNotes: 'Referred to SALT. School-based support strategies in place. Monitoring for 6 weeks.',
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      },
    }) : Promise.resolve(null),
    s4 ? prisma.sendConcern.create({
      data: {
        schoolId: school.id,
        studentId: s4.id,
        raisedBy: teacher.id,
        source: 'teacher',
        category: 'behaviour',
        description: 'Student has been disruptive in 5 of the last 8 lessons. Difficulty remaining on task and frequently distracts other students. Possible attention/concentration difficulties.',
        status: 'closed',
        reviewedBy: senco.id,
        reviewedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        reviewNotes: 'Reviewed — agreed behaviour management strategies with class teacher. No further SEND action at this time. Review in half-term.',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      },
    }) : Promise.resolve(null),
  ])

  const validConcerns = concerns.filter(Boolean)
  console.log(`  Created ${validConcerns.length} concerns`)

  // ── 2. IndividualLearningPlans ─────────────────────────────────────────────
  console.log('\n2. Creating IndividualLearningPlans...')

  const reviewDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 1 week
  const reviewDate2 = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000) // 5 weeks

  const ilp1 = await prisma.individualLearningPlan.create({
    data: {
      schoolId: school.id,
      studentId: s1.id,
      createdBy: senco.id,
      sendCategory: 'Specific Learning Difficulty (SpLD) — Dyslexia',
      currentStrengths: 'Strong verbal reasoning and classroom participation. Enthusiastic about creative topics. Good peer relationships. Shows persistence when supported. Demonstrates understanding when content is presented verbally.',
      areasOfNeed: 'Reading accuracy and comprehension significantly below age-expected levels. Written expression is laboured with frequent spelling errors. Processing speed in reading tasks is slow. Anxiety around written assessments.',
      strategies: [
        'Provide written materials in dyslexia-friendly font (Arial/Comic Sans, 12pt minimum)',
        'Allow extra time (25%) for all written work and assessments',
        'Provide printed copies of board notes and slides in advance',
        'Use coloured overlays or paper — Aiden has identified yellow as helpful',
        'Break multi-step instructions into numbered single steps',
        'Pair written tasks with verbal explanation of expectations',
      ],
      successCriteria: 'Reading age to improve by at least 6 months over the next 12 weeks. Written homework completion rate to reach 80%+. Student to report reduced anxiety around written tasks (self-assessed rating of 3+ out of 5).',
      reviewDate: reviewDate1,
      status: 'active',
      parentConsent: true,
      targets: {
        create: [
          {
            target: 'Improve reading accuracy to 85% on standardised assessment (currently 68%)',
            strategy: 'Daily 15-minute reading sessions using decodable texts at instructional level. Reading partner in English lessons. Weekly 1:1 with teaching assistant.',
            successMeasure: 'Standardised reading assessment score ≥85% at 6-week review',
            targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
            status: 'in_progress',
            progressNotes: 'Good engagement with TA sessions. Accuracy improving on structured texts.',
          },
          {
            target: 'Complete all homework tasks to at least 60% quality within the set timeframe',
            strategy: 'Homework diary with simplified written instructions. Parent briefed on strategies. Homework club access Tuesdays and Thursdays.',
            successMeasure: 'Homework submitted on time for 8 of 10 consecutive tasks; teacher quality rating ≥60%',
            targetDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
            status: 'in_progress',
          },
          {
            target: 'Reduce assessment anxiety — student self-rates anxiety ≤2/5 before written tasks',
            strategy: 'Pre-assessment relaxation routine taught by SENCO. Quiet start to assessments with 5-minute reading time. Reassurance check-in with form tutor before major assessments.',
            successMeasure: 'Self-reported anxiety rating ≤2 on 5-point scale for 3 consecutive assessments',
            targetDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
            status: 'not_started',
          },
        ],
      },
    },
  })

  const ilp2 = s2 ? await prisma.individualLearningPlan.create({
    data: {
      schoolId: school.id,
      studentId: s2.id,
      createdBy: senco.id,
      sendCategory: 'Social, Emotional and Mental Health (SEMH)',
      currentStrengths: 'Highly creative and imaginative. Strong verbal communication skills in 1:1 settings. Shows empathy towards peers. Good attendance history prior to this term. Responds well to trusted adults.',
      areasOfNeed: 'Significant anxiety presenting as physical complaints (headaches, stomach aches) before school. Difficulty managing transitions and changes to routine. Emotional regulation in stressful situations. Attendance has declined significantly this term.',
      strategies: [
        'Provide advance notice of any changes to routine (minimum 24 hours)',
        'Safe space identified — can use Learning Support room without permission during anxiety episodes',
        'Weekly check-in with pastoral lead (10 minutes, Monday morning)',
        'Flexible start to high-pressure lessons — arrival a few minutes early to settle',
        'Emotion check-in card available on desk during lessons',
        'No cold-calling; student to indicate readiness with a thumbs-up signal',
      ],
      successCriteria: 'Attendance to recover to 90%+ within 6 weeks. Student to complete at least 80% of lessons without needing to use the safe space exit. Anxiety self-rating to reduce from 4/5 to 2/5 average over monitoring period.',
      reviewDate: reviewDate2,
      status: 'active',
      parentConsent: false,
      targets: {
        create: [
          {
            target: 'Attend school for ≥90% of sessions over a rolling 4-week period',
            strategy: 'Daily attendance call if absent. Phased re-integration after any absence >2 days. Reduced timetable option available if needed. EWO involvement as planned.',
            successMeasure: '≥90% attendance measured over any rolling 4-week period within the review cycle',
            targetDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
            status: 'in_progress',
            progressNotes: 'Attendance improved from 60% to 72% over the past 2 weeks. Phased start agreed.',
          },
          {
            target: 'Complete 80%+ of lesson time in the classroom without needing to use the exit strategy',
            strategy: 'Agreed signal system with all teachers. Regular low-key check-ins during lessons. Scheduled breaks built into longer sessions.',
            successMeasure: 'Exit card used ≤2 times per week on average over a 3-week period',
            targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
            status: 'not_started',
          },
          {
            target: 'Develop and use 3 personal regulation strategies independently',
            strategy: 'SENCO to run 4-session emotional regulation programme (individually). Strategies agreed and put on a personal coping card.',
            successMeasure: 'Student can name and demonstrate 3 regulation strategies; reports using them independently on at least 5 occasions',
            targetDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
            status: 'not_started',
          },
        ],
      },
    },
  }) : null

  console.log(`  Created ${[ilp1, ilp2].filter(Boolean).length} ILPs with targets`)

  // ── 3. EarlyWarningFlags ───────────────────────────────────────────────────
  console.log('\n3. Creating EarlyWarningFlags...')

  const flagExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.earlyWarningFlag.createMany({
    skipDuplicates: false,
    data: [
      {
        schoolId: school.id,
        studentId: s1.id,
        flagType: 'completion_drop',
        severity: 'high',
        description: 'Homework completion rate has dropped from 87% to 33% over the past 4 weeks — a fall of 54 percentage points. This pattern is consistent with increasing disengagement or an unmet barrier to learning.',
        dataPoints: {
          previousRate: 0.87,
          currentRate: 0.33,
          drop: 0.54,
          windowWeeks: 4,
          submissionsExpected: 6,
          submissionsReceived: 2,
        },
        isActioned: false,
        expiresAt: flagExpiry,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        studentId: s1.id,
        flagType: 'multiple_concerns',
        severity: 'medium',
        description: 'Student has 2 open/under_review SEND concerns across literacy and social_emotional categories. Multiple concurrent concerns from different areas may indicate a broader, unmet support need.',
        dataPoints: {
          openConcerns: 2,
          categories: ['literacy', 'social_emotional'],
        },
        isActioned: false,
        expiresAt: flagExpiry,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      s2 ? {
        schoolId: school.id,
        studentId: s2.id,
        flagType: 'score_decline',
        severity: 'high',
        description: 'Average homework scores have declined by 28 percentage points over the past 6 weeks (from 71% to 43%). This decline is significant and suggests a worsening barrier to academic engagement.',
        dataPoints: {
          previousAverage: 0.71,
          currentAverage: 0.43,
          decline: 0.28,
          assessmentsConsidered: 8,
          windowWeeks: 6,
        },
        isActioned: false,
        expiresAt: flagExpiry,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      } : null,
      s3 ? {
        schoolId: school.id,
        studentId: s3.id,
        flagType: 'pattern_absence',
        severity: 'medium',
        description: '3 consecutive homework submissions were not received. While individual missed submissions may occur for benign reasons, a run of 3+ consecutive misses is a pattern worth reviewing in the context of any known concerns.',
        dataPoints: {
          consecutiveMisses: 3,
          lastSubmitted: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
        },
        isActioned: true,
        actionedBy: senco.id,
        actionedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        actionNotes: 'Spoken with form tutor. Student has had family circumstances impacting home study. Teacher support in place. No SEND action needed at this stage.',
        expiresAt: flagExpiry,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      } : null,
    ].filter(Boolean) as any,
  })

  console.log('  Created EarlyWarningFlags')

  // ── 4. SendReviewLogs ──────────────────────────────────────────────────────
  console.log('\n4. Creating SendReviewLogs...')

  await prisma.sendReviewLog.createMany({
    data: [
      {
        schoolId: school.id,
        studentId: s1.id,
        action: 'concern_raised',
        actorId: teacher.id,
        metadata: { category: 'literacy', source: 'teacher' },
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        studentId: s1.id,
        action: 'concern_reviewed',
        actorId: senco.id,
        metadata: { status: 'under_review', note: 'Initial review — gathering further evidence' },
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        studentId: s1.id,
        action: 'ilp_created',
        actorId: senco.id,
        metadata: { sendCategory: 'Specific Learning Difficulty (SpLD) — Dyslexia' },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        studentId: s2.id,
        action: 'concern_raised',
        actorId: teacher.id,
        metadata: { category: 'attendance', source: 'teacher' },
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        studentId: s2.id,
        action: 'concern_reviewed',
        actorId: senco.id,
        metadata: { status: 'escalated', note: 'EWO referral and parent meeting arranged' },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        studentId: s2.id,
        action: 'ilp_created',
        actorId: senco.id,
        metadata: { sendCategory: 'Social, Emotional and Mental Health (SEMH)' },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  console.log('  Created 6 SendReviewLogs')

  // ── 5. SendNotifications ───────────────────────────────────────────────────
  console.log('\n5. Creating SendNotifications...')

  await prisma.sendNotification.createMany({
    data: [
      // To SENCO: new concerns
      {
        schoolId: school.id,
        recipientId: senco.id,
        concernId: validConcerns[0]?.id,
        type: 'new_concern',
        title: 'New SEND concern raised',
        body: `${teacher.firstName} ${teacher.lastName} raised a literacy concern about ${s1.firstName} ${s1.lastName}.`,
        isRead: true,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        recipientId: senco.id,
        concernId: validConcerns[2]?.id,
        type: 'new_concern',
        title: 'New SEND concern raised',
        body: `${teacher.firstName} ${teacher.lastName} raised a numeracy concern about ${s2.firstName} ${s2.lastName}.`,
        isRead: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        recipientId: senco.id,
        type: 'early_warning',
        title: 'Early warning: homework completion drop',
        body: `${s1.firstName} ${s1.lastName}'s homework completion has dropped from 87% to 33%. Review recommended.`,
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        recipientId: senco.id,
        type: 'early_warning',
        title: 'Early warning: score decline',
        body: `${s2.firstName} ${s2.lastName}'s average scores have declined by 28 percentage points over 6 weeks.`,
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      // To teacher: ILP created
      {
        schoolId: school.id,
        recipientId: teacher.id,
        type: 'ilp_created',
        title: `ILP created: ${s1.firstName} ${s1.lastName}`,
        body: `A new Individual Learning Plan has been created for ${s1.firstName} ${s1.lastName} (SpLD — Dyslexia). Please review SEND strategies in your lesson planning.`,
        isRead: false,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        schoolId: school.id,
        recipientId: teacher.id,
        type: 'ilp_created',
        title: `ILP created: ${s2.firstName} ${s2.lastName}`,
        body: `A new Individual Learning Plan has been created for ${s2.firstName} ${s2.lastName} (SEMH). Please review SEND strategies in your lesson planning.`,
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      // To HOY: escalation
      ...(hoy ? [{
        schoolId: school.id,
        recipientId: hoy.id,
        concernId: validConcerns[3]?.id,
        type: 'concern_escalated',
        title: `SEND concern escalated: ${s2.firstName} ${s2.lastName}`,
        body: `SENCO has escalated an attendance concern about ${s2.firstName} ${s2.lastName}. EWO referral initiated.`,
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }] : []),
      // ILP review due reminder
      {
        schoolId: school.id,
        recipientId: senco.id,
        type: 'review_due',
        title: `ILP review due: ${s1.firstName} ${s1.lastName}`,
        body: `The ILP for ${s1.firstName} ${s1.lastName} is due for review within 7 days. Please schedule a review meeting.`,
        isRead: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  console.log('  Created 8 SendNotifications')

  console.log('\n✓ Phase 5 SEND seed complete.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
