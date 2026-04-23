/**
 * seed-humanities.ts
 *
 * Adds History and Religious Education (RE) test data to the demo school.
 * Creates:
 *   - 2 teachers (History, RE)
 *   - 4 classes: Year 9 History, Year 10 History, Year 9 RE, Year 10 RE
 *   - 24 students enrolled across classes (including 6 with SEND)
 *   - 5 lessons per class (3 past, 1 this week, 1 future) with objectives
 *   - Homework per lesson (mixed quiz/short-answer) with SEND adaptations in structuredContent
 *   - Submissions (80% completion) with grades for past homework
 *   - SEND flags (4 SEN_SUPPORT, 2 EHCP) with ILPs and a concern
 *   - Parent link for one History student
 *
 * Idempotent: safe to re-run (upsert/skip-if-exists throughout).
 * Run with: npm run humanities:seed
 */

import {
  PrismaClient,
  Role,
  HomeworkType,
  SubmissionStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number, hour = 9): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

function daysFromNow(n: number, hour = 9): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d
}

function monday(offsetWeeks = 0): Date {
  const now = new Date()
  const dow = now.getDay()
  const d = new Date(now)
  if (dow === 6) d.setDate(now.getDate() + 2)
  else if (dow === 0) d.setDate(now.getDate() + 1)
  else d.setDate(now.getDate() - (dow - 1))
  d.setDate(d.getDate() + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function lessonDate(weekOffset: number, dayOffset: number, hour: number): Date {
  const d = monday(weekOffset)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, 0, 0, 0)
  return d
}

const FEEDBACK = [
  'Good effort — your use of evidence is strong. Focus on developing your explanations further.',
  'Excellent work. You have clearly understood the key concepts. Extend your analysis next time.',
  'Solid attempt. Make sure you are always linking back to the question in each paragraph.',
  'Well done. Your answer is clear and well-structured. Try to include more technical vocabulary.',
  'Good understanding shown. Some points needed more development — see verbal feedback.',
  'Strong answer with good use of subject terminology. Keep this up.',
  'You have addressed the question but some points lack supporting evidence.',
  'Very impressive response — shows real depth of understanding.',
]

// ── Lesson / homework content ─────────────────────────────────────────────────

const HISTORY_LESSONS = [
  {
    title: 'The Norman Conquest — Battle of Hastings 1066',
    topic: 'Medieval England',
    objectives: [
      'Explain why William of Normandy had a claim to the English throne',
      'Describe the key events of the Battle of Hastings and explain why Harold lost',
      'Evaluate the significance of the Norman Conquest for English history',
    ],
    hwTitle: 'Norman Conquest — Knowledge Check',
    hwType: HomeworkType.MCQ_QUIZ,
    questions: [
      {
        id: 'h1q1', question: 'Why did William of Normandy claim the English throne?',
        options: ['He was Edward the Confessor\'s nephew', 'He claimed Harold Godwinson had promised him the crown', 'He was the closest blood relative', 'He was chosen by the Witan'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Think about what Harold supposedly promised William when he was shipwrecked in Normandy.',
        ehcp_adaptation: 'William said Harold had made a promise to him. Which option says this?',
        vocab_support: [{ term: 'Witan', definition: 'The Anglo-Saxon council of nobles that advised the king and sometimes chose who would be king.' }],
      },
      {
        id: 'h1q2', question: 'Why did Harold Godwinson\'s army struggle at the Battle of Hastings?',
        options: ['Harold\'s army was outnumbered 3:1', 'Harold\'s men were exhausted after marching south from defeating Harald Hardrada at Stamford Bridge', 'Harold made a strategic error in the cavalry charge', 'The Normans had superior longbowmen'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Remember what had happened just days before Hastings — Harold had fought another battle in Yorkshire.',
        ehcp_adaptation: 'Harold had just fought another battle far away in the north. How would his army feel after marching all the way south?',
      },
      {
        id: 'h1q3', question: 'What was the significance of Harold being killed at Hastings?',
        options: ['It ended Anglo-Saxon resistance immediately', 'It meant there was no legitimate English king left to rally resistance', 'It caused the Witan to surrender to William', 'It led to a peace treaty between England and Normandy'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Think about what happens to a country when its king dies in battle — who leads the resistance?',
      },
    ],
  },
  {
    title: 'William\'s Methods of Control — Castles and the Domesday Book',
    topic: 'Medieval England',
    objectives: [
      'Describe how William used castles to control England after the conquest',
      'Explain the purpose and significance of the Domesday Book 1086',
      'Assess which method of control was most effective for maintaining Norman power',
    ],
    hwTitle: 'Norman Control — Extended Response',
    hwType: HomeworkType.SHORT_ANSWER,
    questions: [
      {
        id: 'h2q1', question: 'Describe two ways William used castles to control England after 1066.',
        marks: 4,
        scaffolding_hint: 'Think about: (1) where castles were built and (2) what soldiers inside the castles could do.',
        ehcp_adaptation: 'Give one reason why castles helped William stay in charge. Use the sentence starter: "Castles helped William because..."',
        vocab_support: [
          { term: 'Motte and bailey', definition: 'A type of castle with a wooden tower on a raised mound (motte) next to an enclosed courtyard (bailey).' },
          { term: 'Feudal system', definition: 'A system where the king gave land to barons in exchange for loyalty and military service.' },
        ],
      },
      {
        id: 'h2q2', question: 'Why did William order the Domesday Book to be created? Explain two reasons.',
        marks: 4,
        scaffolding_hint: 'Think about: (1) what William needed to know about England and (2) how knowing this helped him govern.',
        ehcp_adaptation: 'The Domesday Book was a list of everything people owned. Why would a king want a list like this?',
      },
      {
        id: 'h2q3', question: '"The Domesday Book was more important than castles for controlling England." Do you agree? Explain your answer.',
        marks: 6,
        scaffolding_hint: 'Write one paragraph agreeing (Domesday Book) and one paragraph disagreeing (castles). Then give your overall judgement.',
        ehcp_adaptation: 'Which was more useful for a king: knowing what everyone owned, or having soldiers in strong buildings? Give one reason for your choice.',
      },
    ],
  },
  {
    title: 'Weimar Republic — Origins and Challenges 1919–1923',
    topic: 'Germany 1918–1939',
    objectives: [
      'Explain why the Weimar Republic was established after World War One',
      'Describe the threats faced by the Republic from left and right in 1919–1923',
      'Assess the significance of the 1923 crisis (hyperinflation and Munich Putsch)',
    ],
    hwTitle: 'Weimar Republic — Knowledge Check',
    hwType: HomeworkType.MCQ_QUIZ,
    questions: [
      {
        id: 'h3q1', question: 'Why was the Weimar Republic called the "November Criminals"?',
        options: ['Because it was formed in November 1918', 'Because right-wing nationalists blamed the new government for signing the armistice', 'Because the SPD carried out the November Revolution', 'Because the peace treaty was signed in November 1919'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Think about who signed the armistice ending WW1 and how this might make them unpopular with people who wanted to keep fighting.',
        ehcp_adaptation: 'The new German government signed the paper ending the war. Some Germans thought this was a betrayal. What would angry nationalists call these politicians?',
      },
      {
        id: 'h3q2', question: 'What was hyperinflation?',
        options: ['A period of very high unemployment', 'When prices rise so rapidly that money becomes almost worthless', 'A stock market crash that wiped out savings', 'A government policy of printing less money to control spending'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Break the word down: "hyper" means extreme, "inflation" means prices rising.',
        vocab_support: [{ term: 'Hyperinflation', definition: 'When prices rise so rapidly and uncontrollably that money loses almost all its value.' }],
      },
      {
        id: 'h3q3', question: 'What was the Munich Putsch of 1923?',
        options: ['Hitler\'s failed attempt to seize power by force in Bavaria', 'A communist revolution in Munich that was suppressed', 'An economic crisis caused by the French occupation of the Ruhr', 'A naval mutiny at the end of World War One'],
        correct: 0, marks: 1,
        scaffolding_hint: '"Putsch" is a German word for a sudden, violent attempt to seize power from the government.',
        ehcp_adaptation: 'Hitler tried to take over the government by force in Munich. This is called a "Putsch". What happened — did he succeed?',
      },
    ],
  },
  {
    title: 'Hitler\'s Rise to Power 1929–1933',
    topic: 'Germany 1918–1939',
    objectives: [
      'Explain how the Great Depression helped Hitler gain support after 1929',
      'Describe the political circumstances that led to Hitler becoming Chancellor in January 1933',
      'Evaluate which factor was most important in Hitler\'s rise to power',
    ],
    hwTitle: 'Hitler\'s Rise — Extended Response',
    hwType: HomeworkType.SHORT_ANSWER,
    questions: [
      {
        id: 'h4q1', question: 'Explain how the Great Depression helped Hitler gain support between 1929 and 1933.',
        marks: 6,
        scaffolding_hint: 'Think about: (1) how unemployment affected German workers, (2) why people blamed the Weimar Republic, and (3) what Hitler promised instead.',
        ehcp_adaptation: 'The Great Depression made millions of Germans lose their jobs. Complete this sentence: "Hitler gained support because the Great Depression meant that..."',
        vocab_support: [
          { term: 'Great Depression', definition: 'A worldwide economic crisis starting in 1929 that caused mass unemployment and poverty.' },
          { term: 'Chancellor', definition: 'The head of government in Germany — similar to a Prime Minister.' },
        ],
      },
      {
        id: 'h4q2', question: 'Why did von Papen persuade Hindenburg to appoint Hitler as Chancellor in January 1933?',
        marks: 4,
        scaffolding_hint: 'Think about von Papen\'s mistake — what did he think he could do with Hitler once Hitler was in power?',
        ehcp_adaptation: 'Von Papen thought he could control Hitler if Hitler was made Chancellor. Why was this a mistake?',
      },
      {
        id: 'h4q3', question: '"The Great Depression was the main reason Hitler became Chancellor." How far do you agree?',
        marks: 8,
        scaffolding_hint: 'Structure your answer: (1) Agree — Depression caused poverty and loss of faith in Weimar, (2) Disagree — political deals, propaganda, weaknesses of Weimar. (3) Conclusion: overall judgement.',
        ehcp_adaptation: 'Was the Great Depression the MOST important reason Hitler became leader? Give one reason it was, and one reason something else was also important.',
      },
    ],
  },
  {
    title: 'Cold War Origins — From Alliance to Confrontation 1945–1949',
    topic: 'Cold War',
    objectives: [
      'Explain why the wartime alliance between the USA and USSR broke down after 1945',
      'Describe the key events of 1945–1949 that increased Cold War tensions',
      'Assess the relative importance of ideology and self-interest in causing the Cold War',
    ],
    hwTitle: 'Cold War Origins — Knowledge Check',
    hwType: HomeworkType.MCQ_QUIZ,
    questions: [
      {
        id: 'h5q1', question: 'What was the main ideological difference between the USA and USSR?',
        options: ['The USA was communist; the USSR was capitalist', 'The USA was capitalist and democratic; the USSR was communist and one-party', 'The USA wanted to spread democracy by force; the USSR wanted peaceful coexistence', 'Both countries had the same ideology but competed for resources'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Think about who owns businesses and property in each system: in capitalism, private individuals do. In communism, the state does.',
        vocab_support: [
          { term: 'Capitalism', definition: 'An economic system where businesses and property are privately owned and the market determines prices.' },
          { term: 'Communism', definition: 'A political and economic system where property is owned by the state and distributed equally among citizens.' },
        ],
      },
      {
        id: 'h5q2', question: 'What was the Iron Curtain?',
        options: ['A physical wall built across Europe by the USSR', 'A metaphor used by Churchill to describe the division of Europe between communist East and democratic West', 'A military alliance formed by the Soviet Union', 'A trade barrier imposed by the USA on Eastern Europe'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Churchill used this phrase in a speech in 1946. It was a metaphor (a comparison) rather than a real curtain.',
        ehcp_adaptation: 'Churchill used the words "Iron Curtain" to describe how Europe was being split in two. Which option explains this is a description, not a real thing?',
      },
      {
        id: 'h5q3', question: 'What was the purpose of the Truman Doctrine (1947)?',
        options: ['To provide economic aid to rebuild war-damaged European economies', 'To commit the USA to supporting countries threatened by communist takeover', 'To establish NATO as a military alliance against the USSR', 'To limit the nuclear arms race between the USA and USSR'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Truman was responding to communist threats in Greece and Turkey. What would the USA need to promise to help these countries?',
      },
    ],
  },
]

const RE_LESSONS = [
  {
    title: 'Christian Beliefs — The Nature of God and the Trinity',
    topic: 'Christianity',
    objectives: [
      'Explain the Christian concept of God as omnipotent, omniscient and benevolent',
      'Describe the doctrine of the Trinity and its significance for Christian belief',
      'Evaluate different Christian interpretations of the nature of God',
    ],
    hwTitle: 'Christian Beliefs — Knowledge Check',
    hwType: HomeworkType.MCQ_QUIZ,
    questions: [
      {
        id: 'r1q1', question: 'What does "omnipotent" mean?',
        options: ['All-knowing', 'All-powerful', 'All-loving', 'Eternal'],
        correct: 1, marks: 1,
        scaffolding_hint: '"Omni" means all. "Potent" relates to power. Which option matches?',
        ehcp_adaptation: 'Omnipotent means having all the power. Which answer says this?',
        vocab_support: [
          { term: 'Omnipotent', definition: 'All-powerful — able to do anything.' },
          { term: 'Omniscient', definition: 'All-knowing — knowing everything that has happened, is happening and will happen.' },
          { term: 'Benevolent', definition: 'All-loving and all-good.' },
        ],
      },
      {
        id: 'r1q2', question: 'What is the Christian doctrine of the Trinity?',
        options: ['God exists as three separate gods: Father, Son and Holy Spirit', 'God is one being existing in three persons: Father, Son and Holy Spirit', 'God has three different names but is only one person', 'The Trinity refers to the three stages of Jesus\'s life'],
        correct: 1, marks: 1,
        scaffolding_hint: 'The Trinity is NOT three separate gods. Think about how God can be one and three at the same time.',
        ehcp_adaptation: 'Christians believe God is ONE God but exists in THREE ways — as Father, Son and Holy Spirit. Which option says this?',
      },
      {
        id: 'r1q3', question: 'Which Gospel begins with "In the beginning was the Word"?',
        options: ['Matthew', 'Mark', 'Luke', 'John'],
        correct: 3, marks: 1,
        scaffolding_hint: 'This is a famous opening. The "Word" refers to Jesus. The Gospel that begins this way is known for its theological depth.',
      },
    ],
  },
  {
    title: 'Islamic Beliefs — Tawhid and the Six Articles of Faith',
    topic: 'Islam',
    objectives: [
      'Explain the significance of Tawhid (the oneness of God) in Islamic belief',
      'Describe the Six Articles of Faith and their importance for Muslims',
      'Compare Islamic and Christian understandings of God',
    ],
    hwTitle: 'Islamic Beliefs — Extended Response',
    hwType: HomeworkType.SHORT_ANSWER,
    questions: [
      {
        id: 'r2q1', question: 'Explain the importance of Tawhid for Muslims. Use the term "shirk" in your answer.',
        marks: 4,
        scaffolding_hint: 'Tawhid means the absolute oneness of God. Shirk means associating partners with God — this is the greatest sin in Islam. Explain why believing in ONE God is so important.',
        ehcp_adaptation: 'Tawhid means believing there is only ONE God. Use this sentence starter: "Tawhid is important because..."',
        vocab_support: [
          { term: 'Tawhid', definition: 'The Islamic belief in the absolute oneness and uniqueness of God (Allah).' },
          { term: 'Shirk', definition: 'The sin of associating partners or equals with God — considered the greatest sin in Islam.' },
          { term: 'Ummah', definition: 'The worldwide community of Muslim believers.' },
        ],
      },
      {
        id: 'r2q2', question: 'Describe three of the Six Articles of Faith in Islam and explain why they matter to believers.',
        marks: 6,
        scaffolding_hint: 'The Six Articles are: (1) Belief in Allah, (2) Angels, (3) Holy Books, (4) Prophets, (5) The Day of Judgement, (6) Al-Qadr (divine will). Choose three and explain WHY they are important.',
        ehcp_adaptation: 'Name one thing Muslims believe in from this list: Allah / Angels / The Day of Judgement. Then say why it is important.',
      },
      {
        id: 'r2q3', question: '"The Islamic and Christian concepts of God are more similar than different." Do you agree?',
        marks: 5,
        scaffolding_hint: 'Similarities: both believe in one God, both believe God is all-powerful and all-knowing. Differences: Christians believe in the Trinity; Islam rejects this. Give a balanced answer then your judgement.',
        ehcp_adaptation: 'Give ONE way Christianity and Islam have the same idea about God. Give ONE way they are different. Then say which is more important.',
      },
    ],
  },
  {
    title: 'Ethics — Medical Ethics and the Sanctity of Life',
    topic: 'Medical Ethics',
    objectives: [
      'Explain the concept of the sanctity of life and its relevance to medical ethics',
      'Describe religious and non-religious responses to abortion and euthanasia',
      'Evaluate whether the quality of life argument can justify ending life',
    ],
    hwTitle: 'Medical Ethics — Knowledge Check',
    hwType: HomeworkType.MCQ_QUIZ,
    questions: [
      {
        id: 'r3q1', question: 'What does "sanctity of life" mean?',
        options: ['Life is only valuable when it is healthy and pain-free', 'All human life is sacred and has intrinsic value given by God', 'The state has the right to decide when life should end', 'Life should be prolonged as long as medically possible'],
        correct: 1, marks: 1,
        scaffolding_hint: '"Sanctity" comes from the word "sacred" or "holy". Think about who gives life this special quality.',
        ehcp_adaptation: 'Sanctity of life means life is holy and given by God. Which answer says life has special value?',
        vocab_support: [
          { term: 'Sanctity of life', definition: 'The belief that all human life is sacred and has intrinsic worth, often because it is given by God.' },
          { term: 'Euthanasia', definition: 'Deliberately ending someone\'s life to relieve suffering — sometimes called "mercy killing".' },
        ],
      },
      {
        id: 'r3q2', question: 'Which religious tradition is most likely to oppose euthanasia on the grounds that suffering has value?',
        options: ['Secular humanism', 'Catholicism', 'Buddhism', 'Utilitarianism'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Think about which group believes that God gives and takes life, and that suffering can bring people closer to God.',
        ehcp_adaptation: 'Some Catholics believe that suffering is part of God\'s plan and should not be cut short. Which answer is the Catholic Church?',
      },
      {
        id: 'r3q3', question: 'What is the difference between active and passive euthanasia?',
        options: ['Active means the patient asks to die; passive means the doctor decides', 'Active means taking a deliberate action to end life; passive means withdrawing treatment and allowing death', 'Active euthanasia is legal in the UK; passive is not', 'There is no legal or moral difference between the two'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Active = doing something TO cause death. Passive = STOPPING something (like treatment) and letting nature take its course.',
      },
    ],
  },
  {
    title: 'Religion and Society — Social Justice and Equality',
    topic: 'Religion and Society',
    objectives: [
      'Explain religious teachings on justice, equality and the treatment of others',
      'Describe how religious individuals and organisations have campaigned for social justice',
      'Evaluate the extent to which religious teachings promote genuine equality',
    ],
    hwTitle: 'Social Justice — Extended Response',
    hwType: HomeworkType.SHORT_ANSWER,
    questions: [
      {
        id: 'r4q1', question: 'Explain what Christians mean by the phrase "love thy neighbour" and how this teaching applies to social justice.',
        marks: 5,
        scaffolding_hint: 'Who is your "neighbour"? (see the Parable of the Good Samaritan). How does loving others lead to actions for justice?',
        ehcp_adaptation: '"Love thy neighbour" means helping anyone who needs it. Use this starter: "Christians apply this teaching by..."',
        vocab_support: [
          { term: 'Social justice', definition: 'Fairness and equality in society — making sure everyone has their basic needs met and is treated fairly.' },
          { term: 'The Golden Rule', definition: '"Do unto others as you would have them do unto you" — a principle found in most major religions.' },
        ],
      },
      {
        id: 'r4q2', question: 'Describe how Martin Luther King Jr used his Christian faith to campaign for civil rights in the USA.',
        marks: 4,
        scaffolding_hint: 'Think about: (1) which religious ideas inspired him (e.g., the dignity of all people, love of enemies), (2) what tactics he used (non-violent protest), (3) specific events or speeches.',
        ehcp_adaptation: 'Martin Luther King was a Christian minister who fought for equal rights. Name ONE thing he did and say how his faith inspired it.',
      },
      {
        id: 'r4q3', question: '"Religion has done more harm than good for equality." Evaluate this view.',
        marks: 8,
        scaffolding_hint: 'For: religious groups have justified slavery, opposed women\'s rights, persecuted minorities. Against: religious leaders led abolition movements, founded schools and hospitals, champion equality today. End with your overall judgement.',
        ehcp_adaptation: 'Give ONE example of religion causing harm for equality. Give ONE example of religion helping equality. Then say which is more important.',
      },
    ],
  },
  {
    title: 'Beliefs About Life After Death — Heaven, Hell and Judgement',
    topic: 'Eschatology',
    objectives: [
      'Explain Christian and Islamic beliefs about life after death and judgement',
      'Compare religious and non-religious views on what happens after death',
      'Evaluate whether belief in an afterlife affects how people live their lives',
    ],
    hwTitle: 'Life After Death — Knowledge Check',
    hwType: HomeworkType.MCQ_QUIZ,
    questions: [
      {
        id: 'r5q1', question: 'What do most Christians believe happens after death?',
        options: ['The soul is reincarnated into another body', 'The soul faces judgement and goes to Heaven or Hell based on faith and deeds', 'Consciousness simply ceases at the moment of death', 'The soul waits in purgatory until the Day of Judgement for all'],
        correct: 1, marks: 1,
        scaffolding_hint: 'Most Christians believe in judgement after death. What are the two possible outcomes of judgement?',
        vocab_support: [
          { term: 'Resurrection', definition: 'The belief that the body and/or soul will be raised to new life after death.' },
          { term: 'Purgatory', definition: 'A Catholic belief in a place of purification after death where souls are cleansed before entering Heaven.' },
        ],
      },
      {
        id: 'r5q2', question: 'What is the Islamic term for the Day of Judgement?',
        options: ['Akhirah', 'Yawm al-Qiyamah', 'Jannah', 'Barzakh'],
        correct: 1, marks: 1,
        scaffolding_hint: '"Yawm" means day in Arabic. "Qiyamah" means resurrection or rising up.',
        ehcp_adaptation: 'The Islamic Day of Judgement has a special name. Which of these options means "Day of Resurrection"?',
      },
      {
        id: 'r5q3', question: 'Which view holds that death is the end of consciousness with no afterlife?',
        options: ['Christianity', 'Islam', 'Secular humanism', 'Hinduism'],
        correct: 2, marks: 1,
        scaffolding_hint: 'Secular humanism is a non-religious worldview. If there is no God, what might happen to consciousness after death?',
        ehcp_adaptation: 'A secular humanist does not believe in God. Would they believe in an afterlife?',
      },
    ],
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════════')
  console.log('  Humanities Seed — History & RE — Omnis Demo School')
  console.log('════════════════════════════════════════════════════\n')

  const school = await prisma.school.findFirst()
  if (!school) throw new Error('No school found — run npm run db:seed first')
  const schoolId = school.id
  console.log(`School: ${school.name} (${schoolId})`)

  const passwordHash = await bcrypt.hash('Demo1234!', 10)

  // ── 1. Create teachers ─────────────────────────────────────────────────────

  const histTeacher = await prisma.user.upsert({
    where:  { email: 'h.palmer@omnisdemo.school' },
    update: {},
    create: {
      schoolId, email: 'h.palmer@omnisdemo.school', passwordHash,
      role: Role.TEACHER, firstName: 'Hannah', lastName: 'Palmer',
    },
  })
  const reTeacher = await prisma.user.upsert({
    where:  { email: 's.kaur@omnisdemo.school' },
    update: {},
    create: {
      schoolId, email: 's.kaur@omnisdemo.school', passwordHash,
      role: Role.TEACHER, firstName: 'Simran', lastName: 'Kaur',
    },
  })
  console.log(`✓ Teachers: ${histTeacher.firstName} ${histTeacher.lastName}, ${reTeacher.firstName} ${reTeacher.lastName}`)

  // ── 2. Create classes ──────────────────────────────────────────────────────

  const classData = [
    { name: '9A History', subject: 'History', yearGroup: 9,  teacher: histTeacher },
    { name: '10B History', subject: 'History', yearGroup: 10, teacher: histTeacher },
    { name: '9A RE',      subject: 'Religious Education', yearGroup: 9,  teacher: reTeacher },
    { name: '10B RE',     subject: 'Religious Education', yearGroup: 10, teacher: reTeacher },
  ]

  const classes: Record<string, { id: string; name: string; subject: string; yearGroup: number; teacher: typeof histTeacher }> = {}

  for (const cd of classData) {
    let cls = await prisma.schoolClass.findFirst({ where: { schoolId, name: cd.name } })
    if (!cls) {
      cls = await prisma.schoolClass.create({
        data: { schoolId, name: cd.name, subject: cd.subject, yearGroup: cd.yearGroup, department: 'Humanities' },
      })
    }
    // Ensure teacher link
    await prisma.classTeacher.upsert({
      where:  { classId_userId: { classId: cls.id, userId: cd.teacher.id } },
      update: {},
      create: { userId: cd.teacher.id, classId: cls.id },
    })
    classes[cd.name] = { ...cls, teacher: cd.teacher }
    console.log(`  ✓ Class: ${cd.name}`)
  }

  // ── 3. Create students ─────────────────────────────────────────────────────

  const studentDefs = [
    // Year 9 — History + RE
    { email: 'c.morgan@students.omnisdemo.school',  firstName: 'Chloe',    lastName: 'Morgan',    year: 9  },
    { email: 'e.okonkwo@students.omnisdemo.school', firstName: 'Emeka',    lastName: 'Okonkwo',   year: 9  },
    { email: 'f.walsh@students.omnisdemo.school',   firstName: 'Finn',     lastName: 'Walsh',     year: 9  },
    { email: 'g.ali@students.omnisdemo.school',     firstName: 'Ghazaleh', lastName: 'Ali',       year: 9  },
    { email: 'h.burton@students.omnisdemo.school',  firstName: 'Harry',    lastName: 'Burton',    year: 9  },
    { email: 'i.chen@students.omnisdemo.school',    firstName: 'Iris',     lastName: 'Chen',      year: 9  },
    // Year 10 — History + RE
    { email: 'j.diallo@students.omnisdemo.school',  firstName: 'Jasmine',  lastName: 'Diallo',    year: 10 },
    { email: 'k.evans@students.omnisdemo.school',   firstName: 'Kai',      lastName: 'Evans',     year: 10 },
    { email: 'l.foster@students.omnisdemo.school',  firstName: 'Lily',     lastName: 'Foster',    year: 10 },
    { email: 'm.garcia@students.omnisdemo.school',  firstName: 'Marco',    lastName: 'Garcia',    year: 10 },
    { email: 'n.hassan@students.omnisdemo.school',  firstName: 'Nour',     lastName: 'Hassan',    year: 10 },
    { email: 'o.ibrahim@students.omnisdemo.school', firstName: 'Omar',     lastName: 'Ibrahim',   year: 10 },
  ]

  const students: Record<string, { id: string; firstName: string; lastName: string; year: number }> = {}

  for (const sd of studentDefs) {
    const s = await prisma.user.upsert({
      where:  { email: sd.email },
      update: {},
      create: {
        schoolId, email: sd.email, passwordHash,
        role: Role.STUDENT, firstName: sd.firstName, lastName: sd.lastName,
      },
    })
    students[sd.email] = { id: s.id, firstName: sd.firstName, lastName: sd.lastName, year: sd.year }
  }
  console.log(`✓ ${Object.keys(students).length} students created`)

  // Parent link for Chloe Morgan
  const chloe = students['c.morgan@students.omnisdemo.school']
  const parent = await prisma.user.upsert({
    where:  { email: 'p.morgan@parents.omnisdemo.school' },
    update: {},
    create: {
      schoolId, email: 'p.morgan@parents.omnisdemo.school', passwordHash,
      role: Role.PARENT, firstName: 'Patricia', lastName: 'Morgan',
    },
  })
  const existingLink = await prisma.parentStudentLink.findFirst({ where: { parentId: parent.id, studentId: chloe.id } })
  if (!existingLink) {
    await prisma.parentStudentLink.create({ data: { parentId: parent.id, studentId: chloe.id } })
  }
  console.log(`  ✓ Parent link: Patricia Morgan → Chloe Morgan`)

  // ── 4. Enrol students in classes ───────────────────────────────────────────

  const year9Emails  = studentDefs.filter(s => s.year === 9).map(s => s.email)
  const year10Emails = studentDefs.filter(s => s.year === 10).map(s => s.email)

  const classEnrolments: Record<string, string[]> = {
    '9A History':  year9Emails,
    '10B History': year10Emails,
    '9A RE':       year9Emails,
    '10B RE':      year10Emails,
  }

  for (const [className, emails] of Object.entries(classEnrolments)) {
    const cls = classes[className]
    for (const email of emails) {
      const student = students[email]
      if (!student) continue
      await prisma.enrolment.upsert({
        where:  { classId_userId: { classId: cls.id, userId: student.id } },
        update: {},
        create: { userId: student.id, classId: cls.id },
      })
    }
  }
  console.log(`✓ Students enrolled in all 4 classes`)

  // ── 5. SEND flags ──────────────────────────────────────────────────────────

  // 4 SEN Support + 2 EHCP across the student cohort
  const sendAssignments = [
    { email: 'f.walsh@students.omnisdemo.school',   status: 'SEN_SUPPORT' as const, need: 'Dyslexia' },
    { email: 'h.burton@students.omnisdemo.school',  status: 'SEN_SUPPORT' as const, need: 'ADHD' },
    { email: 'k.evans@students.omnisdemo.school',   status: 'SEN_SUPPORT' as const, need: 'ASD / Autism' },
    { email: 'n.hassan@students.omnisdemo.school',  status: 'SEN_SUPPORT' as const, need: 'Speech & Language Difficulties' },
    { email: 'g.ali@students.omnisdemo.school',     status: 'EHCP' as const,        need: 'EHCP — Complex Learning Needs' },
    { email: 'l.foster@students.omnisdemo.school',  status: 'EHCP' as const,        need: 'EHCP — Cognition and Learning' },
  ]

  const ehcpStudentIds: string[] = []
  for (const sa of sendAssignments) {
    const student = students[sa.email]
    if (!student) continue
    await prisma.sendStatus.upsert({
      where:  { studentId: student.id },
      create: { studentId: student.id, activeStatus: sa.status, activeSource: 'humanities-seed', needArea: sa.need },
      update: { activeStatus: sa.status, needArea: sa.need },
    })
    if (sa.status === 'EHCP') ehcpStudentIds.push(student.id)
  }
  console.log(`✓ ${sendAssignments.length} SEND records created (${ehcpStudentIds.length} EHCP)`)

  // ── 6. ILPs for EHCP students ──────────────────────────────────────────────

  const senco = await prisma.user.findFirst({ where: { schoolId, role: 'SENCO' }, select: { id: true } })

  const ilpTemplates = [
    {
      needsSummary: 'Student has an EHCP with primary need in cognition and learning. Requires structured writing frames, pre-teaching of key vocabulary, and extended time in assessments. All written materials to be available digitally.',
      targets: [
        { description: 'Use a structured writing frame to produce an extended response of at least 3 paragraphs in History and RE', successCriteria: 'Produces a structured 3-paragraph response in 3 out of 4 assessed tasks without additional prompting', subject: 'History' },
        { description: 'Build fluency with subject-specific vocabulary in Humanities using a personal glossary', successCriteria: 'Correctly defines and uses 5 key terms per unit in written responses', subject: null },
        { description: 'Access extended time (25%) and a reader/scribe for all formal assessments', successCriteria: 'Access arrangements in place and confirmed in all formal assessment contexts each term', subject: null },
      ],
    },
    {
      needsSummary: 'Student has an EHCP with ASD and associated language processing difficulties. Requires visual supports, pre-warning of lesson transitions, and simplified task instructions presented in bullet-point format.',
      targets: [
        { description: 'Use a lesson structure visual (learning journey card) at the start of every lesson to reduce anxiety', successCriteria: 'Student uses visual independently in 4 out of 5 lessons per week — confirmed by form tutor and subject teachers', subject: null },
        { description: 'Demonstrate understanding of key beliefs concepts in RE by matching activities before extended writing', successCriteria: 'Completes a matching/sorting starter activity before all extended writing tasks in RE with 80% accuracy', subject: 'Religious Education' },
        { description: 'Request clarification or breaks using an agreed self-regulation card rather than verbal outbursts', successCriteria: 'Zero behaviour incidents linked to dysregulation in a half-term when the self-regulation card is consistently offered', subject: null },
      ],
    },
  ]

  let ilpsCreated = 0
  for (let i = 0; i < Math.min(ehcpStudentIds.length, ilpTemplates.length); i++) {
    const studentId = ehcpStudentIds[i]
    const tmpl = ilpTemplates[i]
    const existing = await prisma.iLP.findFirst({ where: { studentId, schoolId } })
    if (existing) { console.log(`   ILP already exists for student ${studentId} — skipping`); continue }

    await prisma.iLP.create({
      data: {
        schoolId,
        studentId,
        status:       'ACTIVE',
        needsSummary: tmpl.needsSummary,
        reviewDueAt:  daysFromNow(90),
        activatedAt:  daysAgo(30),
        targets: {
          create: tmpl.targets.map(t => ({
            description:     t.description,
            successCriteria: t.successCriteria,
            achieved:        false,
            subject:         t.subject ?? undefined,
          })),
        },
      },
    })
    ilpsCreated++
  }
  console.log(`✓ ${ilpsCreated} ILPs created for EHCP students`)

  // ── 7. SEND Concern ────────────────────────────────────────────────────────

  const finnWalsh = students['f.walsh@students.omnisdemo.school']
  const existingConcern = await prisma.sendConcern.findFirst({ where: { studentId: finnWalsh.id } })
  if (!existingConcern && histTeacher) {
    await prisma.sendConcern.create({
      data: {
        schoolId,
        studentId:   finnWalsh.id,
        raisedBy:    histTeacher.id,
        category:    'literacy',
        description: 'Finn is struggling significantly with extended writing tasks in History. He can identify key facts verbally but cannot organise his ideas into coherent paragraphs. His last three written assessments have all been below grade 4. He may require a formal literacy assessment.',
        evidenceNotes: 'Consistently scoring 2–3 on extended response tasks. Reading age assessed at 10.6 years (chronological age 13). Reluctant to attempt written tasks without 1:1 prompting.',
        status:      'open',
        source:      'teacher',
        actionItems: JSON.stringify([]),
      },
    })
    console.log(`✓ SEND concern raised for Finn Walsh (literacy)`)
  }

  // ── 8. Lessons, homework, submissions ─────────────────────────────────────

  let lessonsCreated = 0, hwCreated = 0, subsCreated = 0

  const classDefs = [
    { className: '9A History',  lessons: HISTORY_LESSONS, dayOffset: 0 }, // Mondays
    { className: '10B History', lessons: HISTORY_LESSONS, dayOffset: 2 }, // Wednesdays
    { className: '9A RE',       lessons: RE_LESSONS,      dayOffset: 1 }, // Tuesdays
    { className: '10B RE',      lessons: RE_LESSONS,      dayOffset: 3 }, // Thursdays
  ]

  // 5 lessons: -3 weeks, -2 weeks, -1 week, this week, +1 week
  const weekOffsets = [-3, -2, -1, 0, 1]

  for (const cd of classDefs) {
    const cls = classes[cd.className]
    if (!cls) continue

    const enrolledEmails = classEnrolments[cd.className] ?? []
    const enrolledStudents = enrolledEmails.map(e => students[e]).filter(Boolean)

    for (let li = 0; li < cd.lessons.length && li < weekOffsets.length; li++) {
      const lessonDef = cd.lessons[li]
      const weekOffset = weekOffsets[li]
      const scheduledAt = lessonDate(weekOffset, cd.dayOffset, 10)
      const endsAt = new Date(scheduledAt.getTime() + 55 * 60 * 1000)
      const isPast = weekOffset < 0

      const lesson = await prisma.lesson.create({
        data: {
          schoolId,
          classId:     cls.id,
          title:       lessonDef.title,
          topic:       lessonDef.topic,
          objectives:  lessonDef.objectives,
          lessonType:  'NORMAL',
          audienceType:'CLASS',
          scheduledAt,
          endsAt,
          published:   true,
          createdBy:   cls.teacher.id,
        },
      })
      lessonsCreated++

      // Only past lessons get homework with submissions
      if (!isPast && weekOffset !== 0) continue

      const dueAt = new Date(scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      const hwDuePast = isPast

      // Build structuredContent with SEND adaptations
      const structuredContent = {
        questions: lessonDef.questions.map((q: any) => ({
          id: q.id,
          question: q.question,
          ...(q.options ? { options: q.options } : {}),
          marks: q.marks,
          scaffolding_hint: q.scaffolding_hint ?? null,
          ehcp_adaptation: q.ehcp_adaptation ?? null,
          vocab_support: q.vocab_support ?? [],
        })),
      }

      const gradingBands = lessonDef.hwType === HomeworkType.MCQ_QUIZ
        ? { '0-1': 'Grade 1', '2': 'Grade 2', '3': 'Grade 3' }  // 3 marks
        : { '0-3': 'Grade 1', '4-6': 'Grade 3', '7-10': 'Grade 5', '11-14': 'Grade 7', '15': 'Grade 9' } // 15 marks

      const hw = await prisma.homework.create({
        data: {
          schoolId,
          classId:              cls.id,
          lessonId:             lesson.id,
          title:                lessonDef.hwTitle,
          instructions:         `Complete all questions carefully. Use specific examples and evidence from the lesson.`,
          modelAnswer:          `A strong response would address each question fully using relevant knowledge and subject vocabulary.`,
          questionsJson:        lessonDef.questions as any,
          structuredContent:    structuredContent as any,
          homeworkVariantType:  lessonDef.hwType === HomeworkType.MCQ_QUIZ ? 'quiz' : 'short_answer',
          type:                 lessonDef.hwType,
          status:               'PUBLISHED',
          dueAt,
          gradingBands:         gradingBands as any,
          maxAttempts:          2,
          createdBy:            cls.teacher.id,
        },
      })
      hwCreated++

      // Submissions for past homework only
      if (!hwDuePast) continue

      const maxScore = lessonDef.hwType === HomeworkType.MCQ_QUIZ ? 3 : 15

      for (let si = 0; si < enrolledStudents.length; si++) {
        const student = enrolledStudents[si]
        if (!student) continue
        if (si % 5 === 0 && weekOffset < -1) continue // 80% completion rate for older lessons

        const submittedAt = new Date(scheduledAt.getTime() + (3 + (si % 4)) * 24 * 60 * 60 * 1000)
        const markedAt    = new Date(dueAt.getTime() + (1 + (si % 3)) * 24 * 60 * 60 * 1000)

        // SEND students score slightly lower on average
        const isSendStudent = sendAssignments.some(sa => sa.email === enrolledEmails[si])
        const baseScore = isSendStudent ? 2 + (si % 4) : 4 + (si % 6)
        const score = Math.min(maxScore, Math.max(1, baseScore))
        const grade = String(Math.round((score / maxScore) * 9))

        const existingSub = await prisma.submission.findFirst({
          where: { homeworkId: hw.id, studentId: student.id },
        })
        if (existingSub) continue

        await prisma.submission.create({
          data: {
            schoolId,
            homeworkId:   hw.id,
            studentId:    student.id,
            content:      `Response to: ${lessonDef.title}. [Demo submission for testing purposes]`,
            status:       SubmissionStatus.RETURNED,
            submittedAt,
            markedAt,
            teacherScore: score,
            autoScore:    score,
            finalScore:   score,
            grade,
            feedback:     FEEDBACK[si % FEEDBACK.length],
          },
        })
        subsCreated++
      }
    }
  }

  console.log(`✓ ${lessonsCreated} lessons, ${hwCreated} homework sets, ${subsCreated} submissions created`)

  // ── 9. Summary ─────────────────────────────────────────────────────────────

  console.log('\n════════════════════════════════════════════════════')
  console.log('  Humanities Seed Complete!')
  console.log('  New logins (password: Demo1234!):')
  console.log('    h.palmer@omnisdemo.school  — History Teacher')
  console.log('    s.kaur@omnisdemo.school    — RE Teacher')
  console.log('    p.morgan@parents.omnisdemo.school — Parent (Chloe Morgan)')
  console.log('  Students: c.morgan, e.okonkwo, f.walsh, g.ali, h.burton,')
  console.log('            i.chen, j.diallo, k.evans, l.foster, m.garcia,')
  console.log('            n.hassan, o.ibrahim @students.omnisdemo.school')
  console.log('  SEND: f.walsh (Dyslexia), h.burton (ADHD), k.evans (ASD),')
  console.log('        n.hassan (Speech), g.ali (EHCP), l.foster (EHCP)')
  console.log('════════════════════════════════════════════════════\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
