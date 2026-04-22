/**
 * fix-send-consistency.ts
 *
 * Idempotent script that ensures every SEND student in the demo school has:
 *   1. An active ILP (skipped — topup seed already creates these)
 *   2. A K Plan (learnerPassport) linked to their ILP
 *   3. A StudentLearningProfile with appropriate strategies
 *
 * Safe to run multiple times — uses upsert / findOrCreate patterns.
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ── Need-area templates ──────────────────────────────────────────────────────

type Template = {
  sendInfo: (name: string, needArea: string) => string
  teacherActions: string[]
  studentCommitments: string[]
  strengthAreas: string[]
  developmentAreas: string[]
  classroomStrategies: string[]
}

const TEMPLATES: Record<string, Template> = {

  dyslexia: {
    sendInfo: (name, _) =>
      `${name} has Specific Learning Difficulties (Dyslexia) affecting phonological processing, reading fluency and written output speed. Verbal comprehension is strong and ${name} participates well in class discussion. The primary barrier is translating ideas into written form under time pressure. ${name} benefits from structured scaffolding, pre-teaching of vocabulary, coloured overlays, and extended time on written tasks.`,
    teacherActions: [
      'Provide writing frames and sentence starters before every extended task',
      'Allow use of a coloured overlay or tinted paper for all reading activities',
      'Pre-teach key vocabulary before the lesson using word or vocabulary cards',
      'Allow 25% extra time on all timed written assessments',
      'Use a minimum 14pt Arial font on printed handouts and resources',
      'Do not penalise for spelling of subject-specific vocabulary in formative work',
      'Break multi-step instructions into a numbered list on a prompt card',
    ],
    studentCommitments: [
      'Use the writing frame before starting any extended answer',
      'Ask for a vocabulary card if an unfamiliar word appears',
      'Use coloured overlay consistently in every lesson',
      'Inform the teacher if extended time has not been applied to an assessment',
    ],
    strengthAreas: [
      'Verbal reasoning and oral contributions',
      'Strong listening comprehension and retention from discussion',
      'Creative thinking when responding orally',
    ],
    developmentAreas: [
      'Reading fluency under time pressure',
      'Extended written output — especially in timed conditions',
      'Spelling of subject-specific vocabulary',
    ],
    classroomStrategies: [
      'Provide coloured overlay or tinted paper for all reading tasks',
      'Offer writing frames and sentence starters for extended tasks',
      'Pre-teach key vocabulary using word cards before the lesson',
      'Give multi-step instructions as a numbered prompt card',
      'Allow 25% extra time on timed written tasks',
      'Use minimum 14pt Arial font on all printed resources',
    ],
  },

  adhd: {
    sendInfo: (name, _) =>
      `${name} has Attention Deficit Hyperactivity Disorder (ADHD) affecting concentration, impulse control and task initiation. ${name} is capable of producing high-quality work when tasks are structured and motivation is maintained. ${name} benefits from clear routines, chunked tasks, regular check-ins, movement breaks where appropriate, and immediate positive feedback.`,
    teacherActions: [
      'Break tasks into small, clearly defined chunks with a completion checkpoint between each',
      'Provide a visual or written agenda at the start of every lesson so expectations are clear',
      'Check in quietly every 10–15 minutes to refocus and encourage',
      'Seat near the front of the class with minimal visual distractions',
      'Give advance warning before transitions (e.g. "In 2 minutes we will move on")',
      'Allow brief movement breaks for longer tasks where the classroom context permits',
      'Acknowledge effort and on-task behaviour explicitly before commenting on accuracy',
      'Provide a personal copy of instructions rather than expecting copying from the board',
    ],
    studentCommitments: [
      'Use the lesson agenda card to track progress through each task',
      'Signal to the teacher using the agreed quiet signal if feeling overwhelmed',
      'Keep a clear workspace with only the materials needed for the current task',
      'Ask for a check-in if struggling to start or refocus on a task',
    ],
    strengthAreas: [
      'Creative and divergent thinking — often produces original ideas',
      'High energy and enthusiasm when engaged with interesting content',
      'Good verbal contributions in structured discussion',
    ],
    developmentAreas: [
      'Sustaining focus on extended or repetitive tasks',
      'Managing impulse responses in class discussion',
      'Completing multi-step written tasks to the end without support',
    ],
    classroomStrategies: [
      'Provide a written lesson agenda at the start of each lesson',
      'Break tasks into timed chunks with checkpoints',
      'Seat near the front with minimal visual distractions',
      'Provide personal copies of all instructions',
      'Give advance warning before transitions',
      'Use quiet positive reinforcement for on-task behaviour',
    ],
  },

  asd: {
    sendInfo: (name, _) =>
      `${name} is autistic (ASD). ${name} benefits from predictable routines, clear and explicit instruction, and advance notice of any changes to lesson structure. ${name} may find unstructured social situations (e.g. group work, open-ended discussions) challenging and may need additional processing time. Sensory sensitivities should be considered when planning seating and classroom environment.`,
    teacherActions: [
      'Share lesson objectives and structure at the start of every lesson',
      'Give advance notice (minimum 24 hours) of any changes to routine or room',
      'Provide explicit and literal instructions — avoid idiom or ambiguous phrasing',
      'Allow additional processing time before expecting a response',
      'Offer a choice of working independently or in a structured pair for group tasks',
      'Be consistent — use the same routines for lesson start, transitions and end',
      'Be aware of potential sensory sensitivities (noise, lighting, seating)',
      'Avoid singling out in front of the class — use quiet, private feedback where possible',
    ],
    studentCommitments: [
      'Let the teacher know in advance (or via the SENCO) if a routine change is causing anxiety',
      'Use the agreed check-in signal if feeling overwhelmed during a lesson',
      'Attempt to communicate needs using the quiet request card if verbal communication is difficult',
    ],
    strengthAreas: [
      'Strong attention to detail and accuracy in structured tasks',
      'Deep knowledge and sustained interest in specialist topics',
      'Systematic and methodical approach to problem-solving',
    ],
    developmentAreas: [
      'Navigating less-structured social interactions (group work, open discussion)',
      'Flexibility when routines change unexpectedly',
      'Interpreting and responding to implied or figurative language',
    ],
    classroomStrategies: [
      'Share lesson structure and objectives at the start of every lesson',
      'Provide explicit, literal instructions — avoid ambiguous language',
      'Give advance notice of changes to routine or seating',
      'Allow additional processing time before expecting a verbal response',
      'Offer quiet individual working as an alternative to group tasks',
      'Use consistent lesson routines every session',
    ],
  },

  semh: {
    sendInfo: (name, _) =>
      `${name} has Social, Emotional and Mental Health (SEMH) needs that can affect engagement, emotional regulation, and homework completion. ${name} is capable of high-quality work when feeling safe and supported. A trauma-informed, consistent and calm approach is essential. Key strategies include pre-lesson check-ins, avoiding public correction, and breaking tasks into manageable steps.`,
    teacherActions: [
      'Carry out a brief quiet check-in before the lesson if there are known stressors',
      'Never put the student on the spot without prior notice — no cold-calling',
      'Avoid public correction or comparison; use private, calm feedback',
      'Break tasks into small, achievable steps with explicit praise at each stage',
      'Use a calm-down card or agreed quiet exit protocol if emotional dysregulation begins',
      'Acknowledge effort explicitly and consistently before commenting on accuracy',
      'Maintain consistent routines — uncertainty increases anxiety',
      'Liaise with SENCO promptly if concerning behaviour or emotional presentation is observed',
    ],
    studentCommitments: [
      'Use the calm-down card or agreed signal if feeling overwhelmed',
      'Speak to a trusted adult (teacher, SENCO, form tutor) if struggling emotionally',
      'Try to complete at least part of the task even when it feels difficult',
    ],
    strengthAreas: [
      'Empathy and emotional insight when in a regulated state',
      'Creative and expressive work when feeling safe and engaged',
      'Capable of strong verbal and written contributions with the right support',
    ],
    developmentAreas: [
      'Emotional regulation under stress or anxiety',
      'Consistent homework completion and follow-through',
      'Engaging with tasks during periods of emotional dysregulation',
    ],
    classroomStrategies: [
      'Brief quiet check-in at lesson start on difficult days',
      'Avoid cold-calling — give advance notice before asking for verbal contributions',
      'Use private, calm feedback rather than public correction',
      'Break tasks into small achievable steps with praise at each stage',
      'Have an agreed calm-down card or exit protocol available',
      'Maintain consistent routines every lesson',
    ],
  },

  visual: {
    sendInfo: (name, _) =>
      `${name} has a Visual Impairment or Physical difficulty that affects access to standard printed and board-based learning materials. ${name} should be seated in the optimal position to access visual information. All printed resources should be provided in an accessible format. The school's accessibility plan and any specialist advisory teacher recommendations should be followed at all times.`,
    teacherActions: [
      'Seat at the front of the class with a clear sightline to the board',
      'Provide all printed resources in minimum 18pt Arial font or as agreed with specialist teacher',
      'Share digital copies of all lesson resources in advance where possible',
      'Verbalise everything written on the board rather than pointing or gesturing alone',
      'Ensure adequate lighting at the student\'s workstation',
      'Allow additional time for any task requiring copying or reading printed materials',
      'Liaise with the SENCO and specialist advisory teacher regarding any equipment needs',
    ],
    studentCommitments: [
      'Use any recommended assistive technology or equipment consistently',
      'Inform the teacher if printed resources are not accessible or too small to read',
      'Request a digital copy of resources in advance when needed',
    ],
    strengthAreas: [
      'Strong verbal reasoning and auditory processing',
      'Good recall of content presented verbally',
      'Resilient and resourceful in navigating accessibility challenges',
    ],
    developmentAreas: [
      'Accessing board-based or printed information independently',
      'Completing tasks within standard timeframes when visual processing is required',
    ],
    classroomStrategies: [
      'Seat at the front with a clear sightline to the board',
      'Provide all resources in minimum 18pt Arial font',
      'Share digital copies of all materials in advance',
      'Verbalise all board content rather than gesturing',
      'Allow additional time for tasks involving reading or copying',
    ],
  },

  eal: {
    sendInfo: (name, _) =>
      `${name} has English as an Additional Language (EAL) and may require additional support accessing subject-specific vocabulary and following complex written instructions. ${name} is developing English proficiency and benefits from visual supports, bilingual glossaries, extended wait time for processing, and explicit vocabulary instruction. Oral comprehension may exceed written production at this stage.`,
    teacherActions: [
      'Provide a subject-specific vocabulary glossary at the start of each unit',
      'Use visual aids, diagrams and images to support understanding of key concepts',
      'Allow additional processing time before expecting a verbal or written response',
      'Pair key written instructions with visual support or a simple bilingual summary',
      'Use clear, simple sentence structures in instructions — avoid idiom',
      'Check for understanding by asking the student to rephrase rather than just asking "OK?"',
      'Seat near a supportive peer who can help with brief translation if needed',
    ],
    studentCommitments: [
      'Use the subject vocabulary glossary to look up unfamiliar words before asking for help',
      'Ask for clarification of instructions if not understood',
      'Attempt tasks in English even when unsure — mark will credit effort and content',
    ],
    strengthAreas: [
      'Multilingual skills — often able to explain concepts in first language accurately',
      'Strong work ethic and motivation to develop English proficiency',
      'Good mathematical reasoning independent of language',
    ],
    developmentAreas: [
      'Extended writing in English — particularly formal academic register',
      'Reading comprehension of complex or idiomatic texts',
      'Speed of written output in English',
    ],
    classroomStrategies: [
      'Provide subject vocabulary glossary at the start of each unit',
      'Use visual aids and diagrams alongside written instructions',
      'Allow additional processing time for verbal and written responses',
      'Use clear, simple sentence structures in all instructions',
      'Avoid idiomatic language or explain idioms explicitly',
      'Check understanding by asking the student to rephrase',
    ],
  },

  slcn: {
    sendInfo: (name, _) =>
      `${name} has Speech, Language and Communication Needs (SLCN) affecting expressive and/or receptive language. ${name} may struggle to process multi-part verbal instructions, articulate ideas verbally under time pressure, or organise spoken or written responses. Visual supports, shorter sentences, and extended wait time are essential. ${name} is working with the school's Speech and Language Therapist (SALT).`,
    teacherActions: [
      'Use short, simple sentences when giving instructions — break into one step at a time',
      'Allow extended wait time (at least 10 seconds) after asking a question before moving on',
      'Provide a visual or written copy of instructions alongside verbal delivery',
      'Pre-teach key vocabulary and sentence structures before the lesson',
      'Use gesture, visual aids, and diagrams to support spoken explanation',
      'Do not ask the student to read aloud in front of the class without prior consent',
      'Liaise with SALT regarding specific strategies recommended in the SALT programme',
    ],
    studentCommitments: [
      'Use the vocabulary card or word bank to support written responses',
      'Let the teacher know if instructions have not been understood',
      'Attend all scheduled SALT sessions and use strategies from the programme in lessons',
    ],
    strengthAreas: [
      'Strong effort and motivation even when communication is challenging',
      'Good visual memory and retention of images and diagrams',
      'Creative and visual approach to problem-solving',
    ],
    developmentAreas: [
      'Processing and acting on complex multi-step verbal instructions',
      'Expressing ideas verbally in complete, organised sentences',
      'Extended written output with clear structure',
    ],
    classroomStrategies: [
      'Use short, one-step instructions at a time',
      'Allow 10+ seconds wait time after questions before moving on',
      'Provide written or visual copies of all instructions',
      'Pre-teach key vocabulary and sentence frames before the lesson',
      'Use gesture and diagrams to support verbal explanation',
      'Do not ask to read aloud in front of the class without consent',
    ],
  },

  cognition: {
    sendInfo: (name, _) =>
      `${name} has Cognition and Learning needs that affect processing speed, working memory, and the ability to access the curriculum at the standard pace. ${name} benefits from highly structured tasks, explicit modelling of worked examples, reduced cognitive load in task design, and regular consolidation activities. Tasks should be broken into small steps with clear guidance at each stage.`,
    teacherActions: [
      'Provide a fully worked example before asking the student to attempt a task independently',
      'Break tasks into small numbered steps — present one step at a time',
      'Reduce the amount of content on each page — avoid cluttered worksheets',
      'Allow additional time on all assessed tasks',
      'Check for understanding frequently using low-stakes verbal checks',
      'Provide a graphic organiser or writing frame for any extended response',
      'Prioritise depth over breadth — it is better to master fewer concepts fully',
      'Recap key concepts from the previous lesson at the start of each new lesson',
    ],
    studentCommitments: [
      'Use the worked example provided before attempting the task independently',
      'Ask for help if a step is unclear rather than attempting to move on and getting stuck',
      'Complete the consolidation activity after each lesson to reinforce learning',
    ],
    strengthAreas: [
      'Persistence and resilience when given appropriate support',
      'Practical and hands-on learning — responds well to concrete materials',
      'Good interpersonal skills and positive relationships with staff and peers',
    ],
    developmentAreas: [
      'Processing and retaining multi-step information',
      'Extended written responses under time pressure',
      'Transferring learning from one context to another independently',
    ],
    classroomStrategies: [
      'Provide a fully worked example before each independent task',
      'Break tasks into small numbered steps',
      'Reduce content per page — avoid cluttered worksheets',
      'Allow additional time on all assessed tasks',
      'Use graphic organisers and writing frames for extended responses',
      'Recap previous lesson concepts at the start of each lesson',
    ],
  },

  ehcp: {
    sendInfo: (name, _) =>
      `${name} has an Education, Health and Care Plan (EHCP) for complex and significant learning needs requiring statutory multi-agency support. The full details of ${name}'s needs, outcomes and provision are set out in the EHCP document. All teachers should ensure they are familiar with Section F (educational provision) and Section E (outcomes) of the EHCP. Annual review is statutory and must be completed on time.`,
    teacherActions: [
      'Read and implement all provisions specified in Section F of the EHCP',
      'Contribute evidence of progress against EHCP outcomes to the Annual Review process',
      'Liaise with the SENCO promptly if any provision is not being implemented',
      'Ensure all classroom adaptations (e.g. extra time, resources, seating) are consistently applied',
      'Attend Annual Review meeting or provide a written report if unable to attend',
      'Record any significant observations about progress or concerns in the SEND monitoring system',
    ],
    studentCommitments: [
      'Engage with all support and provision identified in the EHCP',
      'Attend all EHCP review meetings alongside parents and the SENCO',
      'Use agreed assistive strategies and resources consistently in lessons',
      'Inform the SENCO or key worker of any changes in needs or circumstances',
    ],
    strengthAreas: [
      'Resilience and motivation to access learning despite significant challenges',
      'Positive engagement with support staff and specialists',
      'Individual strengths as identified in the EHCP (see Section B of EHCP document)',
    ],
    developmentAreas: [
      'Areas identified in Section B of the EHCP — please refer to the statutory document',
      'Progress against EHCP outcomes is tracked termly — see SENCO for latest review',
    ],
    classroomStrategies: [
      'Implement all provisions in Section F of the EHCP consistently',
      'Ensure extra time and access arrangements are applied to all assessments',
      'Liaise with SENCO if any provision cannot be applied',
      'Record significant observations about progress or concerns',
    ],
  },

}

function getTemplate(needArea: string): Template {
  const na = (needArea ?? '').toLowerCase()
  if (na.includes('dyslexia') || na.includes('spld') || na.includes('specific learning')) return TEMPLATES.dyslexia
  if (na.includes('adhd') || na.includes('attention deficit')) return TEMPLATES.adhd
  if (na.includes('asd') || na.includes('autism') || na.includes('autistic')) return TEMPLATES.asd
  if (na.includes('social, emotional') || na.includes('semh') || na.includes('mental health')) return TEMPLATES.semh
  if (na.includes('visual') || na.includes('physical')) return TEMPLATES.visual
  if (na.includes('eal') || na.includes('english as an additional')) return TEMPLATES.eal
  if (na.includes('speech') || na.includes('language') || na.includes('communication') || na.includes('slcn')) return TEMPLATES.slcn
  if (na.includes('cognition') || na.includes('learning')) return TEMPLATES.cognition
  if (na.includes('ehcp') || na.includes('complex')) return TEMPLATES.ehcp
  return TEMPLATES.cognition // sensible default
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const school = await prisma.school.findFirst({ where: { name: { contains: 'Demo' } } })
  if (!school) { console.error('Demo school not found'); process.exit(1) }

  const senco = await prisma.user.findFirst({ where: { schoolId: school.id, role: 'SENCO' } })
  if (!senco) { console.error('SENCO not found'); process.exit(1) }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Omnis — SEND Consistency Fix')
  console.log('═══════════════════════════════════════════════════════\n')

  // Fetch all SEND students with their current records
  const students = await prisma.user.findMany({
    where: { schoolId: school.id, role: 'STUDENT' },
    include: {
      sendStatus:      true,
      studentIlps:     { orderBy: { createdAt: 'desc' }, take: 1 },
      learnerPassports: true,
      learningProfile: true,
    },
  })

  const sendStudents = students.filter(s =>
    s.sendStatus && s.sendStatus.activeStatus !== 'NONE'
  )

  console.log(`Found ${sendStudents.length} SEND students to check`)

  let kplanCreated = 0
  let kplanSkipped = 0
  let lpCreated    = 0
  let lpSkipped    = 0
  let noIlp        = 0

  for (const s of sendStudents) {
    const name     = `${s.firstName} ${s.lastName}`
    const needArea = s.sendStatus!.needArea ?? ''
    const tpl      = getTemplate(needArea)
    const ilp      = s.studentIlps[0]

    // ── K Plan ──────────────────────────────────────────────────────────────
    if (s.learnerPassports.length === 0) {
      if (!ilp) {
        console.log(`  ⚠ No ILP for ${name} — skipping K Plan`)
        noIlp++
      } else {
        const kplanId = `kplan-auto-${s.id.slice(-8)}`
        await (prisma as any).learnerPassport.upsert({
          where:  { id: kplanId },
          update: {},
          create: {
            id:               kplanId,
            schoolId:         school.id,
            studentId:        s.id,
            ilpId:            ilp.id,
            sendInformation:  tpl.sendInfo(name, needArea),
            teacherActions:   tpl.teacherActions,
            studentCommitments: tpl.studentCommitments,
            status:           'APPROVED',
            approvedBy:       senco.id,
            approvedAt:       new Date('2026-01-15'),
          },
        })
        console.log(`  ✓ K Plan created — ${name} (${needArea.substring(0, 40)})`)
        kplanCreated++
      }
    } else {
      kplanSkipped++
    }

    // ── StudentLearningProfile ───────────────────────────────────────────────
    if (!s.learningProfile) {
      await (prisma as any).studentLearningProfile.upsert({
        where:  { studentId: s.id },
        update: {},
        create: {
          studentId:           s.id,
          schoolId:            school.id,
          strengthAreas:       tpl.strengthAreas,
          developmentAreas:    tpl.developmentAreas,
          classroomStrategies: tpl.classroomStrategies,
          passportStatus:      'DRAFT',
          approvedByTeacher:   false,
          lastUpdated:         new Date(),
        },
      })
      console.log(`  ✓ LearningProfile created — ${name}`)
      lpCreated++
    } else {
      lpSkipped++
    }
  }

  console.log('\n────────────────────────────────────────────────────────')
  console.log(`K Plans:          ${kplanCreated} created, ${kplanSkipped} already existed, ${noIlp} skipped (no ILP)`)
  console.log(`LearningProfiles: ${lpCreated} created, ${lpSkipped} already existed`)
  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
