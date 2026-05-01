import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding English Year 9 sample plan...')

  // Find the demo school
  const school = await prisma.school.findFirst({ where: { name: { contains: 'demo', mode: 'insensitive' } } })
    ?? await prisma.school.findFirst()
  if (!school) { console.error('No school found'); return }

  // Find the demo English teacher to use as creator
  const teacher = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'TEACHER' },
    orderBy: { createdAt: 'asc' },
  })
  if (!teacher) { console.error('No teacher found'); return }

  // Find a HOD for approver
  const hod = await prisma.user.findFirst({
    where: { schoolId: school.id, role: { in: ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN'] } },
    orderBy: { createdAt: 'asc' },
  })

  const planContent = `ENGLISH YEAR 9 — Scheme of Work

## Term 1 — An Inspector Calls (J.B. Priestley)
- Plot overview: the Birling family interrogated by Inspector Goole
- Characters: Arthur Birling, Sybil Birling, Sheila, Eric, Gerald Croft, Eva Smith/Daisy Renton
- Themes: social responsibility, class and inequality, gender, age and generation
- Context: 1912 setting written in 1945 — post-war socialist message
- Skills: close language analysis, contextual interpretation, essay structure (PEE/PEED)
- Assessment: "How does Priestley present the theme of responsibility?" — full essay (40 mins)

## Term 2 — AQA Poetry Anthology: Power & Conflict
- Set poems: Ozymandias, London, The Prelude, My Last Duchess, Charge of the Light Brigade,
  Exposure, Storm on the Island, Bayonet Charge, Remains, Poppies,
  War Photographer, Tissue, The Emigrée, Kamikaze, Checking Out Me History
- Key skills: annotation, comparative essay technique, unseen poem response
- Themes: power of nature, power of humans, effects of conflict, individual vs society
- Assessment: comparative essay (two poems from cluster) — timed 45 mins

## Term 3 — GCSE Language Paper 1 & 2
Language Paper 1 — Fiction
- Q1: identify information (4 marks)
- Q2: language analysis of a specific paragraph (8 marks)
- Q3: structural analysis of whole text (8 marks)
- Q4: evaluate a statement about the text (20 marks)
- Q5: descriptive or narrative writing (40 marks)

Language Paper 2 — Non-Fiction
- Q1: identify true statements (4 marks)
- Q2: summarise differences between two texts (8 marks)
- Q3: language analysis of one text (12 marks)
- Q4: compare writers' perspectives (16 marks)
- Q5: persuasive or informative writing (40 marks)

## Key texts and resources
- An Inspector Calls (Heinemann edition recommended)
- AQA Anthology: Power and Conflict
- GCSE English Language past papers (AQA)
- Revision: CGP GCSE English Language & Literature guides

## Assessment calendar
- Oct half-term: Inspector Calls essay (draft)
- Nov: Inspector Calls essay (final)
- Jan: Poetry comparative essay
- Feb: Language Paper 1 mock
- Mar: Language Paper 2 mock
- May: Full mock exam (both papers + Literature Paper 1)`

  // Use upsert to avoid duplicates
  const existing = await prisma.yearGroupPlan.findFirst({
    where: { schoolId: school.id, yearGroup: 9, subject: 'English' },
  })

  if (existing) {
    console.log('English Year 9 plan already exists — skipping.')
    return
  }

  await prisma.yearGroupPlan.create({
    data: {
      schoolId:    school.id,
      yearGroup:   9,
      subject:     'English',
      planContent,
      status:      'APPROVED',
      createdById: teacher.id,
      approvedById: hod?.id ?? teacher.id,
    },
  })

  console.log('Created English Year 9 APPROVED sample plan.')
  console.log('Done.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
