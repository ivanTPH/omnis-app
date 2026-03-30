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
  datasources: { db: { url: process.env.DATABASE_URL } },
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

  // ── 6. Phase 6 EHCP Plans ─────────────────────────────────────────────────
  console.log('\n6. Creating EhcpPlans...')

  const futureReview1 = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)  // ~3 weeks
  const futureReview2 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)  // ~2 months

  const ehcp1 = await prisma.ehcpPlan.create({
    data: {
      schoolId: school.id,
      studentId: s1.id,
      createdBy: senco.id,
      localAuthority: 'Oakfield Metropolitan Borough Council',
      planDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      reviewDate: futureReview1,
      coordinatorName: 'Ms J. Freeman',
      status: 'active',
      outcomes: {
        create: [
          {
            section: 'B',
            outcomeText: 'Aiden will read age-appropriate texts with ≥90% accuracy using phonics and contextual strategies.',
            successCriteria: 'Standardised reading test score at or above chronological age band at annual review.',
            targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
            provisionRequired: 'Reading Recovery programme, 3× per week with trained TA. Coloured overlays. Dyslexia-friendly resources.',
            status: 'active',
            evidenceCount: 0,
          },
          {
            section: 'B',
            outcomeText: 'Aiden will write extended responses of 200+ words with appropriate structure and punctuation.',
            successCriteria: 'Three consecutive homework tasks rated Good or higher by subject teacher using shared rubric.',
            targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            provisionRequired: 'Writing frames provided. Laptop access for extended tasks.',
            status: 'active',
            evidenceCount: 0,
          },
          {
            section: 'C',
            outcomeText: 'Aiden will self-report anxiety levels ≤2/5 before written assessments.',
            successCriteria: 'Anxiety self-rating card used before assessments; average ≤2 for three consecutive assessments.',
            targetDate: new Date(Date.now() + 84 * 24 * 60 * 60 * 1000),
            provisionRequired: 'Pastoral check-in before major assessments. Separate quiet room access.',
            status: 'active',
            evidenceCount: 0,
          },
          {
            section: 'D',
            outcomeText: 'Aiden will independently use 2 self-regulation strategies when experiencing anxiety.',
            successCriteria: 'Student can name and demonstrate strategies; evidence from pastoral log of independent use on ≥5 occasions.',
            targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            status: 'active',
            evidenceCount: 0,
          },
        ],
      },
    },
  })

  const ehcp2 = s2 ? await prisma.ehcpPlan.create({
    data: {
      schoolId: school.id,
      studentId: s2.id,
      createdBy: senco.id,
      localAuthority: 'Oakfield Metropolitan Borough Council',
      planDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      reviewDate: futureReview2,
      coordinatorName: 'Ms J. Freeman',
      status: 'active',
      outcomes: {
        create: [
          {
            section: 'A',
            outcomeText: 'Maya will attend school for ≥90% of sessions over any rolling 4-week period.',
            successCriteria: '≥90% attendance measured at 6-week review using school attendance data.',
            targetDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
            provisionRequired: 'Daily attendance call if absent. EWO involvement. Phased return protocol.',
            status: 'active',
            evidenceCount: 0,
          },
          {
            section: 'C',
            outcomeText: 'Maya will remain in the classroom for ≥80% of lesson time without needing the exit strategy.',
            successCriteria: 'Exit card used ≤2 times per week average over 3 consecutive weeks.',
            targetDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
            provisionRequired: 'Agreed signal system. Designated safe space. Pastoral check-ins.',
            status: 'active',
            evidenceCount: 0,
          },
          {
            section: 'C',
            outcomeText: 'Maya will independently use 3 personal regulation strategies when managing emotional distress.',
            successCriteria: 'Student can name and use strategies from personal coping card; pastoral log evidence.',
            targetDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
            provisionRequired: 'SENCO 4-session emotional regulation programme. Coping card produced.',
            status: 'not_started',
            evidenceCount: 0,
          },
          {
            section: 'H1',
            outcomeText: 'Maya will complete SEMH-appropriate homework tasks to a quality rating of ≥60%.',
            successCriteria: '8 of 10 consecutive homework tasks submitted; teacher quality rating ≥60%.',
            targetDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000),
            provisionRequired: 'Adapted homework (shorter tasks, flexible deadlines). Homework club access.',
            status: 'active',
            evidenceCount: 0,
          },
        ],
      },
    },
  }) : null

  const ehcpCount = [ehcp1, ehcp2].filter(Boolean).length
  console.log(`  Created ${ehcpCount} EHCP plans with outcomes`)

  // ── 7. StudentLearningProfiles ─────────────────────────────────────────────
  console.log('\n7. Creating StudentLearningProfiles...')

  // Only create for students 1 and 2 (the ones with ILPs/EHCPs)
  await prisma.studentLearningProfile.upsert({
    where: { studentId: s1.id },
    update: {},
    create: {
      studentId: s1.id,
      schoolId: school.id,
      typePerformance: {
        quiz: { avgScore: 58, count: 4, avgTimeMin: 22 },
        short_answer: { avgScore: 42, count: 6, avgTimeMin: 18 },
        multiple_choice: { avgScore: 71, count: 3, avgTimeMin: 12 },
        free_text: { avgScore: 35, count: 5, avgTimeMin: 30 },
      },
      bloomsPerformance: {
        remember: 74,
        understand: 55,
        apply: 38,
        analyse: 30,
      },
      subjectPerformance: {
        English: { avg: 44, trend: 'declining' },
        Drama: { avg: 82, trend: 'stable' },
      },
      preferredTypes: ['multiple_choice', 'quiz'],
      strengthAreas: ['verbal reasoning', 'creative tasks', 'peer collaboration'],
      developmentAreas: ['extended writing', 'reading comprehension', 'timed assessments'],
      avgCompletionRate: 0.55,
      profileSummary: 'Aiden shows strength in oral and creative tasks but faces significant barriers with written work due to SpLD. Performs best on structured, short-response formats. Extended writing tasks require additional scaffolding and time. Evidence suggests anxiety around assessments further depresses performance on text-heavy tasks.',
      profileUpdatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  })

  if (s2) {
    await prisma.studentLearningProfile.upsert({
      where: { studentId: s2.id },
      update: {},
      create: {
        studentId: s2.id,
        schoolId: school.id,
        typePerformance: {
          quiz: { avgScore: 65, count: 3, avgTimeMin: 20 },
          short_answer: { avgScore: 61, count: 4, avgTimeMin: 25 },
          free_text: { avgScore: 72, count: 2, avgTimeMin: 35 },
        },
        bloomsPerformance: {
          remember: 68,
          understand: 63,
          apply: 55,
        },
        subjectPerformance: {
          English: { avg: 64, trend: 'declining' },
          Art: { avg: 89, trend: 'stable' },
        },
        preferredTypes: ['free_text', 'creative_writing'],
        strengthAreas: ['creative expression', 'verbal communication', 'empathy'],
        developmentAreas: ['attendance consistency', 'timed tasks', 'emotional regulation in assessments'],
        avgCompletionRate: 0.72,
        profileSummary: 'Maya performs well when present and engaged, with particular strength in creative and expressive tasks. SEMH difficulties significantly impact attendance and in-school performance. Creative homework formats show the highest completion and quality. Needs flexible deadlines and low-pressure formats.',
        profileUpdatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    })
  }

  console.log('  Created StudentLearningProfiles')

  // ── 8. IlpHomeworkLinks ────────────────────────────────────────────────────
  console.log('\n8. Creating IlpHomeworkLinks...')

  // Get ILP targets for s1
  const ilp1Targets = await prisma.ilpTarget.findMany({
    where: { ilp: { studentId: s1.id } },
    take: 2,
  })

  // Get any published homework
  const homework = await prisma.homework.findMany({
    where: { schoolId: school.id, status: 'PUBLISHED' },
    take: 4,
  })

  if (ilp1Targets.length > 0 && homework.length > 0) {
    await prisma.ilpHomeworkLink.createMany({
      skipDuplicates: true,
      data: [
        {
          homeworkId: homework[0].id,
          ilpTargetId: ilp1Targets[0].id,
          linkedBy: teacher.id,
          evidenceNote: 'This homework directly targets reading comprehension skill development.',
        },
        ...(ilp1Targets[1] && homework[1] ? [{
          homeworkId: homework[1].id,
          ilpTargetId: ilp1Targets[1].id,
          linkedBy: teacher.id,
          evidenceNote: 'Written homework to evidence progress towards homework completion target.',
        }] : []),
      ],
    })
    console.log('  Created IlpHomeworkLinks')
  } else {
    console.log('  Skipped IlpHomeworkLinks (no matching homework/targets)')
  }

  console.log('\n✓ Phase 5 + Phase 6 SEND seed complete.\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
