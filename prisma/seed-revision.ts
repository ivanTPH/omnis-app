import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL ?? ''
const connUrl = dbUrl.includes('?') ? dbUrl + '&connection_limit=1' : dbUrl + '?connection_limit=1'
const prisma = new PrismaClient({ datasources: { db: { url: connUrl } } })

async function main() {
  console.log('Seeding revision programs…')

  // Find an English teacher and their class
  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER', email: { contains: 'patel' } },
    select: { id: true, schoolId: true },
  })
  if (!teacher) { console.log('No teacher found — skipping'); return }

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { schoolId: teacher.schoolId, subject: { contains: 'English' } },
    include: {
      enrolments: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        take: 5,
      },
    },
  })
  if (!schoolClass) { console.log('No English class found — skipping'); return }

  const students = schoolClass.enrolments.map(e => e.user).slice(0, 5)
  if (students.length === 0) { console.log('No students — skipping'); return }

  const now = new Date()

  // ── 1. Formal assignment ───────────────────────────────────────────────────
  const program1 = await (prisma as any).revisionProgram.create({
    data: {
      schoolId:     teacher.schoolId,
      classId:      schoolClass.id,
      createdBy:    teacher.id,
      title:        'An Inspector Calls — Mid-Term Revision',
      subject:      schoolClass.subject,
      yearGroup:    schoolClass.yearGroup,
      periodStart:  new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000),
      periodEnd:    now,
      topics:       ['Context & Social Class', 'Character Analysis', 'Inspector\'s Role'],
      mode:         'formal_assignment',
      deadline:     new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      durationWeeks: 1,
      status:       'sent',
    },
  })

  const aic_structuredContent = {
    type: 'retrieval_practice',
    lessonTitle: "An Inspector Calls — Context & Social Class",
    objectives: [
      "Recall key contextual details about Edwardian Britain and social class hierarchy",
      "Explain how Priestley uses characters to criticise capitalist attitudes",
      "Analyse the Inspector's role as a moral and dramatic device",
    ],
    questions: [
      {
        id: '1',
        question: "State two ways in which Edwardian Britain in 1912 was divided by social class.",
        bloomsLevel: 'remember',
        objectiveIndex: 0,
        marks: 1,
        markScheme: "Award 1 mark for any two of: the wealthy upper/middle classes controlled business and politics; the working class had no vote and few rights; poverty was widespread; women had no suffrage.",
        guidance: "Think back to the context lesson — what divided people in 1912?",
        writingFrame: "Two ways Britain was divided by social class were… First… Second…",
        guidancePrompts: ["When was the play set and what was happening in Britain?", "Think about wealth, voting rights, and workers' conditions."],
        modelAnswerBullets: ["Any accurate factual point about Edwardian class division earns the mark (e.g. no votes for women/working class, wealth gap, no welfare state)."],
      },
      {
        id: '2',
        question: "Explain how Birling's attitude towards his workers reflects Priestley's criticism of capitalism.",
        bloomsLevel: 'understand',
        objectiveIndex: 1,
        marks: 2,
        markScheme: "Award 1 mark for a relevant point about Birling's attitude. Award 1 further mark for explaining how this criticises capitalism or the ruling class.",
        guidance: "What does Birling say and do regarding workers? What does Priestley want us to think about this?",
        writingFrame: "Birling's attitude towards his workers is… This reflects a criticism of capitalism because…",
        guidancePrompts: ["Recall how Birling reacted to Eva Smith's pay request.", "Use the word 'criticises' or 'condemns' in your answer."],
        modelAnswerBullets: ["A point about Birling's dismissive/selfish attitude toward workers (1 mark)", "An explanation of how this reveals Priestley's critique of capitalist self-interest (1 mark)"],
      },
      {
        id: '3',
        question: "Apply your knowledge of Eva Smith's story to explain how she represents the situation of working-class women in 1912.",
        bloomsLevel: 'apply',
        objectiveIndex: 0,
        marks: 2,
        markScheme: "Award 1 mark per developed point, up to 2 marks. Credit connections between Eva's experience and the historical context of working-class women.",
        guidance: "Think about Eva's powerlessness at each stage of her story.",
        writingFrame: "Eva Smith represents working-class women because… For example, when… This connects to the reality that in 1912…",
        guidancePrompts: ["What happened to Eva at each point — at Birling's, Milward's, and Gerald's?", "What rights did working-class women actually have in 1912?"],
        modelAnswerBullets: ["A connection between Eva's treatment and the lack of rights for working-class women (1 mark)", "A developed second point with textual or contextual reference (1 mark)"],
      },
      {
        id: '4',
        question: "Analyse the significance of the Inspector's final speech. What message does Priestley convey through it? Refer to specific details.",
        bloomsLevel: 'analyse',
        objectiveIndex: 2,
        marks: 3,
        markScheme: "Award 1 mark for a relevant point about the speech's message. Award 1 mark for a specific reference or quotation. Award 1 mark for an analytical comment on how Priestley conveys this message.",
        guidance: "Use the structure: Point → Evidence → Analysis ('This shows that…').",
        writingFrame: "The Inspector's final speech is significant because… The phrase '…' suggests… This shows Priestley is warning the audience that…",
        guidancePrompts: ["What does the Inspector warn will happen if people don't change?", "Which specific words or phrases are most powerful?", "What was Priestley's purpose in writing this play in 1945?"],
        modelAnswerBullets: ["A clear point about the speech's warning/message (1 mark)", "A specific textual reference (1 mark)", "Analytical comment on how Priestley communicates his socialist message (1 mark)"],
      },
      {
        id: '5',
        question: "To what extent is the Inspector a realistic character? Justify your answer with reference to the play.",
        bloomsLevel: 'evaluate',
        objectiveIndex: 2,
        marks: 2,
        markScheme: "Award 1 mark for a clear judgement (e.g. 'The Inspector is not wholly realistic — he functions as a dramatic device'). Award 1 further mark for a justified reason supported by reference to the text.",
        guidance: "Give your view clearly, then back it up with evidence from the play.",
        writingFrame: "I believe the Inspector is [realistic / not realistic / partly realistic] because… For example… This suggests Priestley intended him to be…",
        guidancePrompts: ["Is he a real police inspector? What clues does Priestley give?", "What role does he serve in the drama beyond investigating?"],
        modelAnswerBullets: ["A clear evaluative judgement on whether the Inspector is realistic (1 mark)", "A supported reason using textual reference (1 mark)"],
      },
    ],
  }

  const statuses = ['not_started', 'submitted', 'marked', 'not_started', 'submitted']
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const status = statuses[i] ?? 'not_started'
    await (prisma as any).revisionTask.create({
      data: {
        programId:    program1.id,
        studentId:    s.id,
        schoolId:     teacher.schoolId,
        focusTopics:  ['Context & Social Class', 'Inspector\'s Role'],
        taskType:     'retrieval_practice',
        structuredContent: aic_structuredContent,
        instructions: `Answer all 5 questions about 'An Inspector Calls'. Questions increase in difficulty from recall to evaluation. Total: 10 marks. Use evidence from the text and your knowledge of context.`,
        modelAnswer:  'See individual question mark schemes. Key themes: social responsibility, class inequality, Priestley\'s socialist message, dramatic purpose of the Inspector.',
        weakTopics:   ['Context & Social Class'],
        strongTopics: ['Character Analysis'],
        sendAdaptations: [],
        ilpTargetIds: [],
        estimatedMins: 30,
        status,
        submittedAt:  status === 'submitted' || status === 'marked' ? new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) : null,
        teacherScore: status === 'marked' ? 6 : null,
        finalScore:   status === 'marked' ? 6 : null,
        feedback:     status === 'marked' ? 'Good understanding of context. Develop your analysis of the Inspector\'s role further — consider the dramatic impact.' : null,
        markedAt:     status === 'marked' ? new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) : null,
      },
    })
  }
  console.log(`✓ Formal assignment created with ${students.length} tasks`)

  // ── 2. Study guide ─────────────────────────────────────────────────────────
  const program2 = await (prisma as any).revisionProgram.create({
    data: {
      schoolId:     teacher.schoolId,
      classId:      schoolClass.id,
      createdBy:    teacher.id,
      title:        'Descriptive Writing — Revision Guide',
      subject:      schoolClass.subject,
      yearGroup:    schoolClass.yearGroup,
      periodStart:  new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      periodEnd:    now,
      topics:       ['Descriptive Techniques', 'Structural Features', 'Vocabulary & Tone'],
      mode:         'study_guide',
      deadline:     null,
      durationWeeks: 1,
      status:       'sent',
    },
  })

  const desc_structuredContent = {
    type: 'short_answer',
    lessonTitle: "Descriptive Writing — Techniques & Vocabulary",
    objectives: [
      "Use a range of descriptive techniques including imagery, personification and pathetic fallacy",
      "Vary sentence structure for effect, using short sentences, triplets and complex structures",
      "Select vocabulary for precise effect, considering connotation and tone",
    ],
    questions: [
      {
        id: '1',
        question: "Name three descriptive techniques and give a brief example of each.",
        bloomsLevel: 'remember',
        objectiveIndex: 0,
        marks: 1,
        markScheme: "Award 1 mark for correctly naming and exemplifying any three techniques (e.g. simile, metaphor, personification, pathetic fallacy, alliteration, onomatopoeia).",
        guidance: "Think about the techniques you have practised in lessons.",
        writingFrame: "Three techniques are… First: [name] — example: '…' | Second: [name] — example: '…' | Third: [name] — example: '…'",
        guidancePrompts: ["What techniques did you practise in the descriptive writing lesson?", "Think about language techniques AND structural features."],
        modelAnswerBullets: ["Any three correctly named and exemplified techniques earn the mark."],
      },
      {
        id: '2',
        question: "Explain how a writer can use pathetic fallacy to establish mood. Write a sentence that uses this technique.",
        bloomsLevel: 'understand',
        objectiveIndex: 0,
        marks: 2,
        markScheme: "Award 1 mark for a correct explanation of pathetic fallacy (weather/setting reflects character emotion). Award 1 mark for a correctly executed example sentence.",
        guidance: "Define the technique, then show it in action.",
        writingFrame: "Pathetic fallacy is when… For example: '[weather/setting detail] mirroring [emotion]…'",
        guidancePrompts: ["How does the weather or setting reflect a character's feelings?", "Write your own example — don't just describe a technique, use it."],
        modelAnswerBullets: ["Correct definition: pathetic fallacy = weather/environment reflects mood/emotion (1 mark)", "A sentence that correctly uses pathetic fallacy (1 mark)"],
      },
      {
        id: '3',
        question: "Rewrite this sentence using two different techniques to make it more vivid and engaging: 'The old house was dark and quiet.'",
        bloomsLevel: 'apply',
        objectiveIndex: 2,
        marks: 2,
        markScheme: "Award 1 mark per clearly identifiable technique used effectively, up to 2 marks.",
        guidance: "Use your toolkit — try a metaphor or personification alongside another technique.",
        writingFrame: "The old house [metaphor]… [second technique, e.g. personification or sensory detail]…",
        guidancePrompts: ["Swap 'dark' for a metaphor.", "Add a sensory detail — what would you hear, smell, or feel?"],
        modelAnswerBullets: ["Technique 1 clearly and effectively applied (1 mark)", "Technique 2 clearly and effectively applied (1 mark)"],
      },
      {
        id: '4',
        question: "Analyse how varied sentence structures can create tension in descriptive writing. Give an example of each structure you discuss.",
        bloomsLevel: 'analyse',
        objectiveIndex: 1,
        marks: 3,
        markScheme: "Award 1 mark for identifying a relevant structure. Award 1 mark for an example. Award 1 mark for an analytical explanation of its effect.",
        guidance: "Think about short sentences for pace, long sentences for atmosphere, and triplets for emphasis.",
        writingFrame: "A [structure] can create tension because… For example: '…' This makes the reader feel…",
        guidancePrompts: ["What does a very short sentence do to the reader?", "How does a long, flowing sentence create a different effect?", "Explain the effect, not just the technique."],
        modelAnswerBullets: ["A relevant structure identified (1 mark)", "An example of that structure in context (1 mark)", "An analytical explanation of its effect on tension or pace (1 mark)"],
      },
      {
        id: '5',
        question: "To what extent is vocabulary choice more important than technique use in effective descriptive writing? Justify your answer.",
        bloomsLevel: 'evaluate',
        objectiveIndex: 2,
        marks: 2,
        markScheme: "Award 1 mark for a clear and reasoned judgement. Award 1 further mark for a justified argument supported by example or reference.",
        guidance: "Take a clear position and back it up with a reason.",
        writingFrame: "I believe [vocabulary choice / technique use / both equally] is more important because… For example… This shows that…",
        guidancePrompts: ["Could a technique fail if the vocabulary is weak?", "Could powerful vocabulary work without a named technique?"],
        modelAnswerBullets: ["A clear judgement/position stated (1 mark)", "A justified reason with supporting example (1 mark)"],
      },
    ],
  }

  const sgStatuses = ['not_started', 'not_started', 'submitted', 'submitted', 'not_started']
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    const status = sgStatuses[i] ?? 'not_started'
    await (prisma as any).revisionTask.create({
      data: {
        programId:    program2.id,
        studentId:    s.id,
        schoolId:     teacher.schoolId,
        focusTopics:  ['Descriptive Techniques', 'Vocabulary & Tone'],
        taskType:     'short_answer',
        structuredContent: desc_structuredContent,
        instructions: `Work through all 5 descriptive writing tasks at your own pace. Questions move from recall to evaluation — 10 marks total. Focus on using a variety of techniques and precise vocabulary. No deadline — take your time and aim for quality.`,
        modelAnswer:  'See individual question mark schemes. Key skills: descriptive techniques, sentence variety for effect, vocabulary precision.',
        weakTopics:   ['Descriptive Techniques'],
        strongTopics: ['Structural Features'],
        sendAdaptations: [],
        ilpTargetIds: [],
        estimatedMins: 30,
        status,
        completedAt:  status === 'submitted' ? new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) : null,
        selfConfidence: status === 'submitted' ? 3 : null,
      },
    })
  }
  console.log(`✓ Study guide created with ${students.length} tasks`)

  console.log('\nRevision seed complete ✓')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
