/**
 * Mark all pending demo submissions with realistic year-group-based scores.
 * Also add 3 new homework records + submissions for 8E/En1.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function maxFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object') return 9
  const keys = Object.keys(bands as Record<string, string>)
  const nums = keys.flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n)))
  return nums.length > 0 ? Math.max(...nums) : 9
}

/** Realistic score: year-group bell curve around grade 5 */
function realisticScore(max: number, yearGroup: number | null, seed: number): number {
  const mid = max * 0.55          // approx Grade 5-6
  const spread = max * 0.22
  const jitter = (Math.sin(seed * 7.3 + 1.1) * 0.5 + 0.5) * spread - spread / 2
  const ygBoost = yearGroup != null ? (yearGroup - 9) * max * 0.02 : 0
  return Math.max(Math.round(max * 0.15), Math.min(max, Math.round(mid + jitter + ygBoost)))
}

async function run() {
  // ── Part 1: Mark 73 pending demo submissions ────────────────────────────────
  const pending = await prisma.submission.findMany({
    where: {
      status:     'SUBMITTED',
      finalScore: null,
      homework:   { classId: { startsWith: 'demo-class' } },
    },
    select: {
      id:       true,
      student:  { select: { yearGroup: true } },
      homework: { select: { gradingBands: true } },
    },
  })

  console.log(`Marking ${pending.length} pending submissions…`)
  let marked = 0
  for (const [i, sub] of pending.entries()) {
    const max   = maxFromBands(sub.homework.gradingBands)
    const score = realisticScore(max, sub.student.yearGroup, i)
    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        finalScore: score,
        teacherScore: score,
        status:    'RETURNED',
        markedAt:  new Date(Date.now() - (pending.length - i) * 3_600_000), // staggered
      },
    })
    marked++
  }
  console.log(`Marked ${marked} submissions.`)

  // ── Part 2: 8E/En1 — add 3 more homework + all-student submissions ──────────
  const classId  = 'demo-class-8E-En1'
  const schoolId = 'cmm9jjy050000u1c7fxlvq4q8'

  const students = await prisma.enrolment.findMany({
    where:  { classId },
    select: { userId: true, user: { select: { yearGroup: true } } },
    distinct: ['userId'],
  })
  console.log(`\n8E/En1 students: ${students.length}`)

  const newHomeworks = [
    {
      title:       'An Inspector Calls — Characters & Responsibility',
      description: 'Analyse how Priestley presents the theme of responsibility through different characters.',
      gradingBands: { '1-3': 'Limited analysis; minimal reference to text.', '4-6': 'Some analysis with textual evidence; developing terminology.', '7-9': 'Sustained analysis; confident use of subject terminology; context integrated.' },
    },
    {
      title:       'Poetry Comparison — War & Conflict',
      description: 'Compare how two poets present the effects of conflict.',
      gradingBands: { '1-3': 'Surface comparison; limited textual support.', '4-6': 'Develops comparison with some evidence; some terminology.', '7-9': 'Perceptive comparison; well-chosen evidence; confident analysis.' },
    },
    {
      title:       'Descriptive Writing — Setting',
      description: 'Write a descriptive piece about a specific setting using varied techniques.',
      gradingBands: { '1-3': 'Basic description; limited vocabulary range.', '4-6': 'Some varied vocabulary and structural features used effectively.', '7-9': 'Sophisticated vocabulary; range of techniques; controlled structure.' },
    },
  ]

  const now = new Date()
  for (const [hi, hw] of newHomeworks.entries()) {
    const dueAt = new Date(now.getTime() - (3 - hi) * 14 * 24 * 3_600_000) // fortnightly back from now
    const setAt = new Date(dueAt.getTime() - 7 * 24 * 3_600_000)

    const created = await prisma.homework.create({
      data: {
        schoolId,
        classId,
        title:        hw.title,
        instructions: hw.description,
        type:         'SHORT_ANSWER',
        status:       'PUBLISHED',
        gradingBands: hw.gradingBands,
        createdBy:    'cmm9jjy7a0002u1c7knh3vupz', // Jay Patel
        dueAt,
      },
    })

    // Add submissions for each student
    const englishResponses = [
      // 'An Inspector Calls' varied responses
      [
        'Priestley uses Sheila to show that responsibility can be learned. At the start she is selfish and uses her power to get Eva Smith sacked but by the end she accepts her guilt saying "I know I had her turned out." This shows she has changed unlike her parents who refuse to accept blame.',
        'Mr Birling represents those who refuse to take responsibility. He says "I can\'t accept any responsibility" even after hearing about Eva\'s death. Priestley presents him as a warning — a capitalist who puts profit above people. The contrast with Sheila shows that younger generations can change.',
        'The Inspector himself is a symbol of collective responsibility. His final speech warns that "millions and millions" like Eva will demand accountability. Priestley uses him to challenge the audience to examine their own responsibility in society.',
        'Eric shows how guilt and responsibility intersect. He stole money and contributed to Eva\'s ruin but unlike his father he feels genuine remorse. Priestley uses him to suggest that acknowledging responsibility is the first step to change.',
        'Mrs Birling is the character most resistant to responsibility. She uses her position on the charity committee to dismiss Eva and feels "no obligation" to help. Priestley presents her as morally blind — her refusal to accept blame makes her the most culpable character.',
        'Gerald Croft represents a complex relationship with responsibility. He did provide Eva with shelter and comfort for a time but ultimately abandoned her. Priestley shows that good intentions are not enough without genuine commitment.',
        'The theme of responsibility links to Priestley\'s socialist message. Every character who refuses accountability represents the self-serving attitudes that Priestley believed caused social inequality. Only those who accept guilt offer hope for a better society.',
        'Sheila and Eric represent hope while Birling and Mrs Birling represent stagnation. Priestley structures the play so that the younger generation understand their responsibility but the older generation cannot change. This reflects his belief that social progress requires confronting the past.',
        'Responsibility in the play is both personal and collective. The Inspector makes each character see how their individual actions contributed to Eva\'s death. Priestley\'s message is that we cannot separate private choices from public consequences.',
        'Priestley uses dramatic irony to expose Birling\'s refusal of responsibility. His speech about the Titanic being "unsinkable" makes the audience distrust his confident dismissal of responsibility, suggesting that those who deny it are always proved wrong.',
      ],
      // 'Poetry Comparison' varied responses
      [
        'Both Wilfred Owen in Dulce et Decorum Est and Siegfried Sassoon in Suicide in the Trenches present conflict as brutalising. Owen uses the metaphor "drowning" to show how soldiers are overwhelmed by violence while Sassoon\'s simple ballad form contrasts bitterly with the horrific content.',
        'Owen and Tennyson differ in their presentation of conflict. "The Charge of the Light Brigade" glorifies the soldiers as noble despite their futile deaths whereas Owen strips away all glory showing men "guttering choking drowning." Both poets use repetition but to opposite effect.',
        'In comparing "Poppies" and "War Photographer" both poets show conflict\'s effects on those left behind. Weir uses the extended metaphor of poppies to represent grief and hope while Duffy focuses on the photographer\'s detachment as a way of managing trauma.',
        'Both poets use imagery of light and darkness to convey the effects of conflict. Heaney in "Storm on the Island" uses the storm as a metaphor for external threat while Owen in "Exposure" describes the killing cold as the real enemy — more dangerous than combat itself.',
        'Owen and Sassoon both use bitter irony to critique those who send men to war. Owen addresses "my friend" sarcastically suggesting those who promote war with lies like "dulce et decorum est" are the true enemy. Sassoon\'s final stanza directly condemns those who "cheer" the dead.',
        'The sonnet form in "Mametz Wood" by Owen Sheers contrasts with the brutal content — bones "jutting" from fields long after the battle. This structural choice reflects how war\'s damage persists beneath the surface of peacetime, never fully healed.',
        'Both "Belfast Confetti" and "Poppies" present conflict through domestic imagery. Ciaran Carson uses punctuation marks as weapons suggesting violence has invaded everyday life while Weir uses the domestic act of sewing to show how war disrupts family and belonging.',
        'The use of first-person narration differs significantly between the two poems. Owen\'s "I" creates urgency and witness whereas Duffy\'s photographer observes suffering from behind a lens — both are present but one is immersed and one is distanced.',
        '"The Manhunt" and "Remains" both explore post-conflict trauma. Laura Paterson shows a wife carefully mapping her husband\'s wounds while Armitage\'s soldier is haunted by a dead man. Both suggest that emotional scars outlast physical ones.',
        'Structure reinforces meaning in both poems. Owen\'s sonnet breaks its form in the sestet to show chaos breaking through while Sassoon\'s neat ballad stanzas are deliberately ironic — order imposed on devastating content to highlight the gap between propaganda and truth.',
      ],
      // 'Descriptive Writing' varied responses
      [
        'The abandoned railway station stood at the edge of town like a forgotten sentence. Weeds had colonised the platform, threading between the cracked tiles with patient determination. A pigeon observed me from the rusted ironwork, unimpressed, as I stepped through the silence.',
        'Dawn broke over the estuary in shades of copper and grey. The mudflats reflected the sky like hammered tin, and a solitary heron stood motionless at the water\'s edge, patient as a monastery. The air tasted of salt and cold and distance.',
        'The market in high summer was an assault on every sense. Stalls of spice and fruit competed for attention beneath canopies that flapped in the warm breeze. Children darted between the legs of browsers while traders called out in languages that blended into a single joyful noise.',
        'The forest at dusk shifts register. What was bright and traversable at noon becomes secretive and deep. Shadows pool between the roots of oaks that have stood longer than memory. A twig snaps — something moves, unhurried, in the peripheral dark.',
        'The old library smelled of decades: varnish and dry paper and the particular mustiness of books left unread for years. Narrow windows admitted bars of light that fell across the shelves like prison bars, illuminating the dust that drifted, dreamlike, in the silence.',
        'The cliff path wound between gorse and sea-thrift, bright with yellow and pink against the grey-green sea below. The wind had a voice here — not the anonymous wind of the town but something speaking, shapeless and old, from beyond the horizon.',
        'In the kitchen of my grandmother\'s house everything was too warm and too bright. The radio murmured in a corner, the kettle hissed, and on the table a bowl of oranges glowed like small suns. It was a room built for staying in.',
        'The ice rink after closing was a different world. The Zamboni had polished the surface to a mirror, and in the industrial quiet the overhead lights hummed their single note. Standing at the barrier I felt small and provisional, the space vast and indifferent.',
        'Autumn had arrived in the park overnight. The plane trees had shed half their leaves in one extravagant gesture, carpeting the path in bronze and ochre. Children kicked through the drifts with furious pleasure while their parents stood watching, smiling at something they couldn\'t name.',
        'The coast road ran straight for miles before surrendering to a bend that curved around the headland. On a clear day you could see the lighthouse at the point, white and precise against the blue, blinking its patient message across the water.',
      ],
    ]
    for (const [si, enrolment] of students.entries()) {
      const max   = 9
      const score = realisticScore(max, enrolment.user.yearGroup, si + hi * 10)
      const markedAt = new Date(dueAt.getTime() + (si + 1) * 3_600_000)
      const responseBank = englishResponses[hi] ?? englishResponses[0]
      const content = responseBank[si % responseBank.length]

      await prisma.submission.create({
        data: {
          schoolId,
          homeworkId:  created.id,
          studentId:   enrolment.userId,
          content,
          status:      'RETURNED',
          submittedAt: dueAt,
          markedAt,
          finalScore:  score,
          teacherScore: score,
          feedback:    `Grade ${score}/9 — ${score >= 7 ? 'Excellent work. Strong use of evidence and clear analytical voice.' : score >= 5 ? 'Good effort; develop your analysis further with more textual evidence.' : 'Needs development — focus on embedding quotations and explaining their effect.'}`,
        },
      })
    }
    console.log(`Created homework: "${hw.title}" with ${students.length} submissions`)
  }

  // Also add submissions for the existing 8E/En1 homework
  const existingHw = await prisma.homework.findFirst({
    where: { classId, title: { contains: 'Reading Fiction' } },
    select: { id: true },
  })
  if (existingHw) {
    for (const [si, enrolment] of students.entries()) {
      const existing = await prisma.submission.findFirst({
        where: { homeworkId: existingHw.id, studentId: enrolment.userId },
      })
      if (!existing) {
        const score = realisticScore(9, enrolment.user.yearGroup, si + 100)
        const dueAt = new Date(now.getTime() - 6 * 7 * 24 * 3_600_000)
        const readingResponses = [
          'The author uses short sentences to build tension. When the protagonist enters the house the description slows down and every detail feels significant. The reader is positioned to feel the same unease as the character.',
          'I think the author is trying to show that appearance and reality are different. The pleasant setting contrasts with the dark events which creates dramatic irony — we know something the characters don\'t.',
          'The use of first-person narration makes the story more personal. We only know what the narrator knows so the surprises feel more real. The limited perspective is a key technique in this story.',
          'The author uses pathetic fallacy effectively. The storm at the beginning mirrors the emotional conflict the character is feeling. This is a classic technique but it works well here.',
          'Characterisation is developed through dialogue rather than description. We learn about the protagonist through what they say and how other characters react to them rather than being told directly.',
          'The pacing changes significantly in the second half. The opening is slow and atmospheric building a sense of place but once the conflict starts the sentences get shorter and the action moves faster.',
          'Symbolism plays a key role. The broken clock represents how time has stopped for the main character — they are stuck in the past and cannot move forward until they face their grief.',
          'The ending is deliberately ambiguous. The author does not tell us what happens next which forces the reader to decide for themselves. This is more powerful than a definitive conclusion.',
        ]
        await prisma.submission.create({
          data: {
            schoolId,
            homeworkId:  existingHw.id,
            studentId:   enrolment.userId,
            content:     readingResponses[si % readingResponses.length],
            status:      'RETURNED',
            submittedAt: dueAt,
            markedAt:    new Date(dueAt.getTime() + 3_600_000),
            finalScore:  score,
            teacherScore: score,
            feedback:    `Grade ${score}/9 — ${score >= 7 ? 'Perceptive analysis with strong textual focus.' : score >= 5 ? 'Developing well — push your analysis deeper.' : 'Keep working on embedding evidence into your points.'}`,
          },
        })
      }
    }
    console.log(`Ensured submissions for existing Reading Fiction homework`)
  }

  const totalSubs = await prisma.submission.count({ where: { homework: { classId } } })
  console.log(`\n8E/En1 total submissions: ${totalSubs}`)
}

run().finally(() => prisma.$disconnect())
