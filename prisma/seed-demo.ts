/**
 * prisma/seed-demo.ts
 *
 * Comprehensive demo seed — builds on top of seed-wonde.ts (Oakfield Academy).
 * Run AFTER `npm run wonde:seed`.
 *
 * Creates for 4 core subjects (English, Maths, Science, History) × 4 year groups:
 *   - 4 past lessons per class (64 total)
 *   - 1 homework per lesson (64 total, SHORT_ANSWER, PUBLISHED)
 *   - ~85% submission coverage per homework (RETURNED + graded)
 *   - ClassPerformanceAggregates per class
 *   - TeacherPredictions per enrolled student per subject
 *   - ILPs for SEN_SUPPORT students (3 targets each)
 *   - EHCPs for EHCP students (3 outcomes each)
 *   - IlpEvidenceEntries linking SEND submissions to ILP targets
 *   - SendConcerns for lowest-performing students
 *
 * Idempotent: safe to run multiple times (all records use upsert with stable IDs).
 * Run with: npm run demo:seed
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

// ── Deterministic RNG (LCG) — different seed from seed-wonde.ts ───────────────
let _s = 0xFACEB00C
const rng  = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296 }
const ri   = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1))

// ── Subject configuration ─────────────────────────────────────────────────────
const CORE_SUBJECTS = ['English', 'Maths', 'Science', 'History'] as const
type CoreSubject = typeof CORE_SUBJECTS[number]

const SUBJECT_CODE: Record<CoreSubject, string> = {
  English: 'En', Maths: 'Ma', Science: 'Sc', History: 'Hi',
}

// Teacher emails per subject, indexed [Y7, Y8, Y9, Y10]
const TEACHER_EMAILS: Record<CoreSubject, [string, string, string, string]> = {
  English: ['helen.davies@oakfield.edu',     'mark.evans@oakfield.edu',       'lucy.williams@oakfield.edu',  'daniel.martin@oakfield.edu'],
  Maths:   ['robert.johnson@oakfield.edu',   'paul.roberts@oakfield.edu',     'karen.hughes@oakfield.edu',   'steven.turner@oakfield.edu'],
  Science: ['patricia.lee@oakfield.edu',     'james.mitchell@oakfield.edu',   'natalie.brown@oakfield.edu',  'christopher.hall@oakfield.edu'],
  History: ['andrew.baker@oakfield.edu',     'thomas.harris@oakfield.edu',    'jennifer.white@oakfield.edu', 'benjamin.scott@oakfield.edu'],
}

// gradingBands: keys 1-9 → maxFromBands = 9 → finalScore on 0-9 scale
const GRADING_BANDS = {
  '1': 'Grade 1 — Foundational understanding only',
  '2': 'Grade 2 — Limited understanding with significant gaps',
  '3': 'Grade 3 — Some understanding but many misconceptions',
  '4': 'Grade 4 — Basic understanding, approaching expected standard',
  '5': 'Grade 5 — Good understanding, meeting expected standard',
  '6': 'Grade 6 — Strong understanding above expected standard',
  '7': 'Grade 7 — Very strong analytical work',
  '8': 'Grade 8 — Excellent work demonstrating mastery',
  '9': 'Grade 9 — Outstanding: exceptional depth and originality',
}

// ── Homework content per subject: 4 batches (one per lesson) ─────────────────
type HwTemplate = {
  lessonTitle: string
  topic: string
  title: string
  instructions: string
  questions: Array<{ prompt: string; modelAnswer: string }>
}

const HW_TEMPLATES: Record<CoreSubject, [HwTemplate, HwTemplate, HwTemplate, HwTemplate]> = {
  English: [
    {
      lessonTitle: 'Victorian Literature — Context and Language',
      topic: 'Victorian Literature',
      title: 'Victorian Prose — Language Analysis',
      instructions: 'Analyse the extract carefully. Answer each question in full sentences, using textual evidence to support your points.',
      questions: [
        { prompt: 'How does the author use language to create a sense of poverty in the opening paragraph?', modelAnswer: 'The author uses bleak, sombre diction such as "gaunt" and "hollow" to evoke the harsh reality of Victorian poverty. Short, fragmented sentences mirror the broken lives of the characters, while the semantic field of darkness — "shrouded", "dim", "shadow" — reinforces the oppressive mood.' },
        { prompt: 'What is the significance of the setting in establishing the mood of the text?', modelAnswer: 'The industrial cityscape, with its smog and factory chimneys, creates an oppressive atmosphere. The setting functions symbolically — the physical environment externalises the moral corruption of society. The juxtaposition of the wealthy merchant\'s mansion against the workers\' slums reinforces the class divide.' },
        { prompt: 'How does the writer present the theme of class division?', modelAnswer: 'The stark contrast between the wealthy characters\' opulent homes and the workers\' squalid conditions highlights the rigid class structure of Victorian England. The writer uses free indirect discourse to expose the prejudice of the upper-class characters, positioning the reader to sympathise with the working poor.' },
      ],
    },
    {
      lessonTitle: 'Poetry — War and Conflict',
      topic: 'War Poetry',
      title: 'War Poetry — Comparative Analysis',
      instructions: 'Refer closely to the poems you have studied. Use the comparative connectives practised in class.',
      questions: [
        { prompt: 'How does Owen use imagery in "Dulce et Decorum Est" to convey the horror of war?', modelAnswer: 'Owen employs visceral, harrowing imagery — "guttering, choking, drowning" — to depict the brutal reality of a gas attack. The extended simile "as under a green sea" transforms the battlefield into a nightmarish seascape, while the present-tense dream sequence "in all my dreams" suggests the psychological trauma that persists beyond the battlefield.' },
        { prompt: 'Compare how two poets from the anthology present the theme of patriotism.', modelAnswer: 'Rupert Brooke glorifies patriotism through idealised, Romantic imagery in "The Soldier", presenting death as noble sacrifice — "There\'s some corner of a foreign field / That is forever England." Conversely, Owen subverts patriotism through savage irony in "Dulce", exposing the "old Lie" perpetuated by those who send young men to die. Brooke\'s reverential, sonnet form contrasts with Owen\'s irregular, disrupted verse, mirroring their contrasting perspectives.' },
        { prompt: 'What structural techniques does Sassoon use to create impact in his war poetry?', modelAnswer: 'Sassoon employs irregular rhyme schemes to reflect the chaos and moral disorder of war. His sardonic final couplets deliver a sharp satirical punch — the volta signals a sudden shift from false heroism to grim, ironic reality. In "The General", the brevity of the poem mirrors the disposability of soldiers\' lives in the eyes of command.' },
      ],
    },
    {
      lessonTitle: 'Macbeth — Themes and Context',
      topic: 'Shakespeare — Macbeth',
      title: 'Macbeth — Shakespeare\'s Language and Themes',
      instructions: 'Explore Shakespeare\'s use of language and dramatic techniques. Reference the historical and social context of the Jacobean period where relevant.',
      questions: [
        { prompt: 'How does Shakespeare present the theme of ambition in Macbeth?', modelAnswer: 'Shakespeare portrays ambition as inherently corrosive through Macbeth\'s rapid moral deterioration. The soliloquy "I have no spur / To prick the sides of my intent, but only / Vaulting ambition" reveals Macbeth\'s self-awareness of his hollow motivation. The equine metaphor suggests he will fall — ambition, like an over-eager rider, leads only to destruction. Lady Macbeth, initially the more ambitious, epitomises how unchecked desire corrupts the self.' },
        { prompt: 'Analyse the significance of the supernatural in the play.', modelAnswer: 'The witches embody the external forces of temptation and moral ambiguity. Their equivocal prophecies — "fair is foul and foul is fair" — establish a world of moral inversion from the outset, reflecting the Jacobean anxiety about demonic influence. Crucially, they never compel Macbeth to act; rather, they reveal possibilities, implicating free will in his downfall. The appearance of Banquo\'s ghost externalises Macbeth\'s psychological guilt.' },
        { prompt: 'How does Shakespeare use language to distinguish between characters of different social classes?', modelAnswer: 'Noble characters, including Macbeth and Duncan, speak predominantly in iambic pentameter — the verse reflecting their elevated status and rational order. When Macbeth\'s mental state deteriorates, his verse fractures, signalling his psychological disintegration. The Porter scene introduces comic prose, providing tonal relief and highlighting the class divide through register. This linguistic variation mirrors the rigid social hierarchy of Jacobean Scotland.' },
      ],
    },
    {
      lessonTitle: 'Non-Fiction Writing — Rhetoric and Persuasion',
      topic: 'Non-Fiction Writing',
      title: 'Persuasive Writing Techniques',
      instructions: 'Demonstrate your understanding of persuasive techniques and how they are used by writers to influence the reader.',
      questions: [
        { prompt: 'Identify and analyse three rhetorical techniques used in the extract provided.', modelAnswer: 'The writer employs the rule of three — "education, aspiration, achievement" — to create a rhythmic, memorable effect. The rhetorical question "Can we afford to ignore the evidence?" directly implicates the reader, creating a sense of personal responsibility. The inclusive pronoun "we" builds solidarity, positioning the reader as part of a shared civic project rather than passive observers.' },
        { prompt: 'How does the writer use structural techniques to build their argument?', modelAnswer: 'The writer opens with an anecdote — a specific individual case — before widening to statistical evidence, moving from the particular to the universal. Counter-arguments are acknowledged and then dismantled, creating a sense of intellectual honesty. The conclusion returns to the opening anecdote, creating a circular structure that gives the essay a sense of completeness and emotional resonance.' },
        { prompt: 'Evaluate how effectively the writer uses language to appeal to different audiences.', modelAnswer: 'The writer blends emotional appeal (pathos) through personal narrative with logical evidence (logos) via statistics and expert testimony. The vocabulary is accessible yet intelligent, suggesting an educated general readership. The formal register maintains authority, while the conversational rhetorical questions prevent the tone from becoming alienating. The cumulative effect is a persuasive text that appeals to both reason and emotion.' },
      ],
    },
  ],

  Maths: [
    {
      lessonTitle: 'Algebra — Linear Equations and Graphs',
      topic: 'Algebra',
      title: 'Algebra — Equations and Expressions',
      instructions: 'Show all working clearly at each step. Marks are awarded for method as well as correct final answers.',
      questions: [
        { prompt: 'Solve the equation 4x − 3 = 2x + 9. Show all steps.', modelAnswer: '4x − 3 = 2x + 9 → Subtract 2x from both sides: 2x − 3 = 9 → Add 3 to both sides: 2x = 12 → Divide by 2: x = 6. Check: 4(6)−3 = 21, 2(6)+9 = 21. Correct.' },
        { prompt: 'Expand and simplify (x + 3)(x − 5).', modelAnswer: '(x + 3)(x − 5) = x² − 5x + 3x − 15 = x² − 2x − 15. Using the FOIL method: First x·x = x², Outer x·(−5) = −5x, Inner 3·x = 3x, Last 3·(−5) = −15. Collecting like terms: x² − 2x − 15.' },
        { prompt: 'Factorise x² + 7x + 12 and hence solve x² + 7x + 12 = 0.', modelAnswer: 'Find two numbers that multiply to 12 and add to 7: 3 and 4. So x² + 7x + 12 = (x + 3)(x + 4). Setting equal to zero: (x + 3)(x + 4) = 0 → x = −3 or x = −4.' },
      ],
    },
    {
      lessonTitle: 'Geometry — Angles, Proof and Congruence',
      topic: 'Geometry',
      title: 'Geometry — Angles and Proof',
      instructions: 'Give geometric reasons for each step of your proofs. State angle theorems by name.',
      questions: [
        { prompt: 'Prove that the interior angles of any triangle sum to 180°.', modelAnswer: 'Draw line PQ parallel to BC through vertex A. Angle PAB = angle ABC (alternate angles, PQ ∥ BC). Angle QAC = angle ACB (alternate angles, PQ ∥ BC). Angles PAB + BAC + QAC form a straight line at A, so they sum to 180°. Therefore angle ABC + BAC + ACB = 180°. QED.' },
        { prompt: 'Calculate all missing angles in a regular octagon. Show your method.', modelAnswer: 'Sum of interior angles = (n − 2) × 180° = 6 × 180° = 1080°. Each interior angle = 1080° ÷ 8 = 135°. Each exterior angle = 180° − 135° = 45°. The sum of exterior angles of any polygon = 360°: 8 × 45° = 360°. Confirmed.' },
        { prompt: 'State the four conditions for congruence in triangles and explain when to use each.', modelAnswer: 'SSS (Side-Side-Side): all three sides equal — use when three sides are known. SAS (Side-Angle-Side): two sides and the included angle — use when the angle is between the two known sides. ASA (Angle-Side-Angle): two angles and the included side. RHS (Right angle-Hypotenuse-Side): for right-angled triangles. AAS is also valid. Do not use SSA as it is ambiguous.' },
      ],
    },
    {
      lessonTitle: 'Statistics — Averages, Spread and Probability',
      topic: 'Statistics and Probability',
      title: 'Statistics — Data Interpretation',
      instructions: 'Use appropriate statistical measures and justify your choice of measure. Show all calculations.',
      questions: [
        { prompt: 'A data set is: 8, 3, 11, 7, 5, 3, 9, 14, 3. Calculate the mean, median, mode and range.', modelAnswer: 'Ordered: 3,3,3,5,7,8,9,11,14. Mean = 63 ÷ 9 = 7. Median (5th value) = 7. Mode = 3 (appears 3 times). Range = 14 − 3 = 11.' },
        { prompt: 'Explain why the median is often preferred to the mean when summarising skewed data.', modelAnswer: 'The mean is affected by extreme values (outliers). In skewed distributions, one very high or low value pulls the mean away from most of the data, making it unrepresentative. The median — the middle value — is resistant to outliers and gives a better sense of a "typical" value. For example, in a salary data set, one very high earner would inflate the mean, but the median would remain representative.' },
        { prompt: 'A bag contains 5 red, 4 blue and 6 green counters. Two are drawn without replacement. Find P(both red).', modelAnswer: 'P(1st red) = 5/15 = 1/3. After removing one red: P(2nd red) = 4/14 = 2/7. P(both red) = 1/3 × 2/7 = 2/21 ≈ 0.095 (9.5%).' },
      ],
    },
    {
      lessonTitle: 'Number — Ratio, Proportion and Percentages',
      topic: 'Number',
      title: 'Number — Percentages, Ratio and Proportion',
      instructions: 'Write all fractions in their simplest form. Show full working for all percentage calculations.',
      questions: [
        { prompt: 'A coat originally costs £75. It is reduced by 20% in a sale. Calculate the sale price.', modelAnswer: '20% of £75 = 0.20 × 75 = £15. Sale price = £75 − £15 = £60. Alternatively: sale price = 80% of £75 = 0.80 × 75 = £60.' },
        { prompt: 'Share £360 in the ratio 3:4:5. How much does each person receive?', modelAnswer: 'Total parts = 3 + 4 + 5 = 12. Value of one part = £360 ÷ 12 = £30. Person A: 3 × £30 = £90. Person B: 4 × £30 = £120. Person C: 5 × £30 = £150. Check: 90 + 120 + 150 = £360. Correct.' },
        { prompt: 'A quantity increases from 80 to 96. Calculate the percentage increase, then find the multiplier for a 15% decrease.', modelAnswer: 'Increase = 96 − 80 = 16. Percentage increase = (16 ÷ 80) × 100 = 20%. Multiplier for 15% decrease = 1 − 0.15 = 0.85.' },
      ],
    },
  ],

  Science: [
    {
      lessonTitle: 'Biology — Cell Biology and Transport',
      topic: 'Cell Biology',
      title: 'Cell Biology — Structure and Transport',
      instructions: 'Use accurate scientific terminology. Include labelled diagrams where they add clarity to your answers.',
      questions: [
        { prompt: 'Describe the key differences between plant and animal cells, referring to organelles.', modelAnswer: 'Plant cells contain: a cell wall (cellulose) for structural support; chloroplasts containing chlorophyll for photosynthesis; a large permanent vacuole for maintaining turgor. Animal cells have centrioles for cell division and lack the above structures. Both contain: nucleus (genetic control), cell membrane (selective permeability), mitochondria (ATP production via respiration), ribosomes (protein synthesis), and cytoplasm.' },
        { prompt: 'Explain the processes of diffusion, osmosis and active transport across cell membranes.', modelAnswer: 'Diffusion: passive movement of particles from high to low concentration (down a gradient); no energy required; applies to gases (O₂, CO₂) and solutes. Osmosis: diffusion of water molecules across a partially permeable membrane from high water potential to low water potential; no ATP needed. Active transport: movement against the concentration gradient using carrier proteins and ATP; allows cells to absorb substances at higher concentrations than the surrounding fluid — e.g., glucose absorption in the small intestine.' },
        { prompt: 'Describe how four different specialised cells are adapted to their function.', modelAnswer: 'Red blood cells: biconcave disc maximises surface area; no nucleus — maximises space for haemoglobin; contains haemoglobin for O₂ transport. Sperm cells: streamlined head; large mitochondria in midpiece for energy; acrosome contains enzymes to penetrate egg. Root hair cells: large surface area for water and mineral absorption; no chloroplasts; thin cell wall. Palisade mesophyll cells: packed with chloroplasts near the leaf surface; transparent vacuole; maximises light absorption for photosynthesis.' },
      ],
    },
    {
      lessonTitle: 'Chemistry — Atomic Structure and the Periodic Table',
      topic: 'Atomic Structure',
      title: 'Chemistry — Atoms, Elements and Bonding',
      instructions: 'Use appropriate chemical notation. Balance all equations.',
      questions: [
        { prompt: 'Describe the structure of an atom. Explain what atomic number and mass number represent.', modelAnswer: 'An atom has a central nucleus containing protons (relative charge +1, relative mass 1) and neutrons (charge 0, mass 1). Electrons (charge −1, negligible mass) orbit in shells/energy levels. Atomic number = number of protons (defines the element). Mass number = protons + neutrons. The number of electrons equals the number of protons in a neutral atom.' },
        { prompt: 'Explain ionic bonding using sodium chloride (NaCl) as an example.', modelAnswer: 'Sodium (2,8,1) loses its one outer electron to become Na⁺ (2,8). Chlorine (2,8,7) gains one electron to become Cl⁻ (2,8,8), achieving a stable full outer shell. The electrostatic attraction between oppositely charged ions forms the ionic bond. NaCl forms a giant ionic lattice — a regular 3D arrangement of alternating Na⁺ and Cl⁻ ions — explaining its high melting point and ability to conduct electricity when molten or dissolved.' },
        { prompt: 'Compare the properties of ionic, covalent and metallic substances and explain them in terms of bonding.', modelAnswer: 'Ionic: high melting points (strong lattice forces); conduct electricity when dissolved/molten (free ions); e.g. NaCl. Covalent molecular: low melting points (weak intermolecular forces); don\'t conduct (no free charges); e.g. H₂O. Giant covalent: very high melting points (strong network of covalent bonds); usually don\'t conduct (except graphite); e.g. diamond. Metallic: high melting points; excellent conductors (delocalised electrons); malleable (layers slide); e.g. iron.' },
      ],
    },
    {
      lessonTitle: 'Physics — Forces, Motion and Energy',
      topic: 'Forces and Motion',
      title: 'Physics — Forces, Newton\'s Laws and Energy',
      instructions: 'State the law or principle you are applying. Include units in all calculations.',
      questions: [
        { prompt: 'State Newton\'s three laws of motion and give a real-world example for each.', modelAnswer: '1st Law (Inertia): A body remains at rest or in uniform motion unless acted upon by a resultant force — a satellite in orbit continues moving without thrust. 2nd Law (F = ma): Resultant force = mass × acceleration — a heavier car requires more force to achieve the same acceleration. 3rd Law (Action-Reaction): Every action has an equal and opposite reaction — a rocket expels gas downwards (action); the gas pushes the rocket upwards (reaction).' },
        { prompt: 'A 1200 kg car accelerates from 0 to 30 m/s in 12 seconds. Calculate (a) the acceleration and (b) the driving force if friction is 200 N.', modelAnswer: '(a) a = Δv ÷ t = 30 ÷ 12 = 2.5 m/s². (b) Using F = ma: Total force = 1200 × 2.5 = 3000 N. This is the resultant force. Driving force = resultant force + friction = 3000 + 200 = 3200 N.' },
        { prompt: 'Explain the principle of conservation of energy and apply it to a falling object.', modelAnswer: 'The principle states that energy cannot be created or destroyed — only converted between forms. Total energy remains constant in a closed system. For a falling object of mass m from height h: at the top, all energy is GPE = mgh; as it falls, GPE converts to KE = ½mv²; at ground level (ignoring air resistance), all GPE has converted to KE, so ½mv² = mgh, giving v = √(2gh). In practice, air resistance dissipates some energy as heat.' },
      ],
    },
    {
      lessonTitle: 'Biology — Ecosystems, Evolution and Natural Selection',
      topic: 'Ecology and Evolution',
      title: 'Ecology — Ecosystems and Adaptation',
      instructions: 'Use ecological terminology precisely. Draw and interpret food webs where relevant.',
      questions: [
        { prompt: 'Explain the roles of producers, primary consumers, secondary consumers and decomposers in an ecosystem.', modelAnswer: 'Producers (plants/algae): convert solar energy to chemical energy via photosynthesis — the foundation of all food chains. Primary consumers (herbivores): eat producers; e.g. rabbits. Secondary consumers (carnivores): eat primary consumers; e.g. foxes. Decomposers (bacteria, fungi): break down dead organic matter, releasing minerals back into the soil for producers — completing the nutrient cycle. Without decomposers, nutrients would remain locked in dead organisms.' },
        { prompt: 'Explain how Darwin\'s theory of natural selection accounts for the evolution of the peppered moth.', modelAnswer: 'Before industrialisation, pale moths blended with pale tree bark (camouflage); dark moths were visible to predators and rarely survived to reproduce. During industrialisation, soot darkened trees; dark moths now had the selective advantage — they survived to reproduce and passed on the allele for dark colouring. Over generations, natural selection increased the frequency of the dark allele in polluted areas. When pollution reduced, pale moths regained their selective advantage. This demonstrates: variation → selection pressure → differential survival → inherited change.' },
        { prompt: 'Describe how carbon is cycled through an ecosystem, including the role of photosynthesis, respiration and decomposition.', modelAnswer: 'Photosynthesis removes CO₂ from the atmosphere, fixing carbon into organic compounds in producers. Respiration by all organisms releases CO₂ back into the atmosphere. Consumers transfer carbon by feeding; excretion releases organic carbon compounds. Decomposers break down dead organisms, releasing CO₂ through their respiration and returning inorganic nutrients to the soil. Combustion of fossil fuels (formed from ancient organisms) returns ancient stored carbon to the atmosphere, disrupting the natural balance.' },
      ],
    },
  ],

  History: [
    {
      lessonTitle: 'Medieval Britain — Normans and Feudalism',
      topic: 'Medieval Britain',
      title: 'The Norman Conquest and Feudal England',
      instructions: 'Support all historical claims with specific evidence. Use the PEEL paragraph structure.',
      questions: [
        { prompt: 'Explain why William the Conqueror\'s victory at Hastings in 1066 was historically significant.', modelAnswer: 'The Battle of Hastings was a transformative moment in English history. William\'s victory ended Anglo-Saxon rule and introduced Norman governance, language and culture. William redistributed land to loyal Norman barons, introducing feudalism. The Domesday Book (1086) showed his administrative ambition — surveying all England\'s wealth. Norman French influenced the English language significantly, giving us words like "beef" (boeuf) and "justice" (justice). The conquest fundamentally altered English identity, society and political institutions for centuries.' },
        { prompt: 'Describe the main features of the feudal system and explain how it benefited William.', modelAnswer: 'The feudal system was a hierarchical land tenure system: William (as sovereign) owned all land; he granted large estates (fiefs) to tenants-in-chief (barons) in exchange for knight service and loyalty (homage and fealty). Barons sublet to knights, who extracted labour from villeins (serfs) tied to the land. It benefited William by: securing military service (vital for ongoing conquest); rewarding loyalty, binding barons to him; replacing Anglo-Saxon landowners with reliable Normans; and enabling efficient administration of a conquered territory.' },
        { prompt: 'How far was the Norman Conquest a disaster for the English people? Justify your answer.', modelAnswer: 'The Conquest was largely detrimental for most English people. Anglo-Saxon thegns lost their land, replaced by Norman barons. The "Harrying of the North" (1069-70) devastated communities, causing famine — the Domesday Book records vast areas as "waste". Villeins faced increased obligations and the loss of Anglo-Saxon legal freedoms. However, some historians argue the conquest brought administrative improvements (Domesday survey), greater continental links, and architectural achievements (Romanesque churches). Overall, the immediate impact on ordinary English people was overwhelmingly negative.' },
      ],
    },
    {
      lessonTitle: 'Industrial Revolution — Change and Consequence',
      topic: 'Industrial Revolution',
      title: 'The Industrial Revolution — Causes and Social Impact',
      instructions: 'Consider multiple perspectives. Use specific historical evidence and dates.',
      questions: [
        { prompt: 'What were the main causes of the Industrial Revolution in Britain? Explain why Britain was first.', modelAnswer: 'Britain industrialised first due to several interconnected factors. Natural resources: abundant coal and iron ore fuelled factories and steam engines. Agricultural Revolution (enclosures): freed labour for factories; released capital for investment. Stable political system: the constitutional monarchy protected property rights and encouraged commerce. Colonial markets: the British Empire provided raw materials and captive markets. Canal and railway networks facilitated trade. Technological innovation — Watt\'s steam engine (1769), Arkwright\'s water frame — drove productivity. The absence of internal tariffs allowed free trade between regions.' },
        { prompt: 'Describe the living and working conditions for industrial workers in early 19th-century Britain.', modelAnswer: 'Conditions were frequently brutal. Factory workers, including children from age 5, worked 12-16 hour days in dangerous conditions — unguarded machinery caused frequent injuries and deaths. Industrial towns like Manchester suffered severe overcrowding; back-to-back housing lacked sanitation, causing periodic cholera (1831-2, 1848) and typhoid outbreaks. Life expectancy in Manchester was just 28 years in 1841 (compared to 41 in rural areas). Child chimney sweeps faced occupational cancers. However, factory work did offer wages, albeit meagre, unlike the precarious subsistence farming it replaced for many.' },
        { prompt: 'How effective were attempts to reform the conditions created by industrialisation between 1833 and 1870?', modelAnswer: 'Reform was gradual and contested. The Factory Act (1833) employed inspectors and banned children under 9 from textile factories. The Mines Act (1842) excluded women and boys under 10 from underground work. The Ten Hours Act (1847) limited the working day. The Public Health Act (1848) allowed but did not compel local councils to act. Progress was uneven — factory owners resisted regulation as costly. The Chartist movement, though ultimately failing its six demands, applied political pressure. By 1870, conditions had improved measurably but were still far from acceptable by modern standards — reform was incremental, not revolutionary.' },
      ],
    },
    {
      lessonTitle: 'World War One — Causes, Experience and Legacy',
      topic: 'World War One',
      title: 'The First World War — Causes and Consequences',
      instructions: 'Use the MAIN factors (Militarism, Alliances, Imperialism, Nationalism) where relevant. Assess the relative importance of factors.',
      questions: [
        { prompt: 'Using the MAIN framework, analyse the long-term causes of the First World War.', modelAnswer: 'Militarism: the arms race — particularly the Anglo-German naval rivalry (Dreadnought programme) and Germany\'s military expansion — created a war-ready atmosphere and military planning (e.g. Schlieffen Plan). Alliances: the Triple Entente (Britain, France, Russia) vs. Triple Alliance (Germany, Austria-Hungary, Italy) meant any conflict could rapidly escalate. Imperialism: competition for colonies in Africa and Asia bred resentment and rivalry between powers. Nationalism: Serbian nationalism threatened Austria-Hungary\'s multi-ethnic empire; Pan-Slavism drew Russia in; German nationalism fuelled expansionist ambitions. Together, these created a powder keg — the assassination of Franz Ferdinand was merely the spark.' },
        { prompt: 'How significant was the assassination of Archduke Franz Ferdinand in causing WWI?', modelAnswer: 'The assassination (28 June 1914) was the immediate trigger but not the underlying cause. It activated the alliance system — Austria declared war on Serbia; Russia mobilised to defend Serbia; Germany (blank cheque) declared war on Russia; France was brought in by alliance; Germany invaded Belgium, bringing Britain in. Without the underlying tensions (MAIN factors), the assassination could have remained a regional crisis. Indeed, previous crises (Morocco 1905, 1911; Bosnian Crisis 1908) had been resolved diplomatically. The assassination mattered because it occurred in a uniquely volatile context. As AJP Taylor argued, it was the alliance system that made war likely; the assassination made it actual.' },
        { prompt: 'Assess the impact of the Treaty of Versailles on Germany and its long-term consequences for Europe.', modelAnswer: 'The Treaty (1919) imposed severe terms: Article 231 (war guilt) blamed Germany, demanding £6.6 billion in reparations. Germany lost 13% of territory (Alsace-Lorraine to France; Polish Corridor; colonies) and was limited to 100,000 troops. Economically, reparations contributed to hyperinflation (1923) and, combined with the Depression, mass unemployment — creating conditions exploited by extremists. John Maynard Keynes, in "The Economic Consequences of the Peace", argued the treaty was vindictive and economically destructive. The "stab in the back" myth and resentment of the Diktat provided Hitler with his political platform. The treaty is widely considered to have sown the seeds of the Second World War.' },
      ],
    },
    {
      lessonTitle: 'Cold War — Origins, Crises and Collapse',
      topic: 'Cold War',
      title: 'The Cold War — Rivalry, Crises and Legacy',
      instructions: 'Evaluate the relative importance of factors. Consider both US and Soviet perspectives.',
      questions: [
        { prompt: 'Explain the main ideological differences between the USA and USSR that fuelled the Cold War.', modelAnswer: 'The fundamental conflict was ideological. The USA championed capitalism (private ownership, free markets, liberal democracy, individual rights) and saw the spread of communism as an existential threat to Western values. The USSR promoted Marxist-Leninist communism (collective ownership, state planning, one-party rule, international proletarian solidarity) and perceived capitalist encirclement as a threat to the Soviet state. Both powers believed their system was historically inevitable and morally superior. This ideological incompatibility made compromise extremely difficult and transformed every geopolitical conflict into a proxy battle for global supremacy.' },
        { prompt: 'How significant was the Cuban Missile Crisis (1962) in the development of the Cold War?', modelAnswer: 'The Cuban Missile Crisis was uniquely significant as the closest the Cold War came to nuclear war — 13 days in October when miscalculation could have caused catastrophe. Its significance lies partly in the immediate outcome: Kennedy\'s naval quarantine succeeded; Khrushchev withdrew missiles in exchange for a secret pledge not to invade Cuba and removal of US missiles from Turkey. More importantly, the crisis prompted structural change: the Moscow-Washington hotline (1963) was established for direct communication; the Partial Test Ban Treaty (1963) followed. It contributed to the spirit of détente in the 1970s. Some historians argue it demonstrated the rationality of deterrence; others that we survived by luck as much as judgement.' },
        { prompt: 'What factors led to the collapse of the Soviet Union in 1991? Which was most significant?', modelAnswer: 'Multiple interlocking factors caused Soviet collapse. Economic: the command economy stagnated from the 1970s; the arms race (Reagan\'s SDI/Star Wars) was financially ruinous; the Afghan War (1979-89) cost lives and resources. Political: Gorbachev\'s glasnost (openness) and perestroika (restructuring) loosened central control without replacing it effectively. Nationalist: independence movements in the Baltic States, Ukraine and elsewhere proved impossible to suppress without returning to Stalinist terror — which Gorbachev refused. External: living standards comparison with the West delegitimised the system. Most significant was arguably the economic collapse — without the ability to deliver material improvements, the USSR lost its ideological justification. Gorbachev\'s reforms, though intended to save the system, accelerated its dissolution.' },
      ],
    },
  ],
}

// ── ILP content per SEND need area ───────────────────────────────────────────
type IlpContent = {
  sendCategory: string
  currentStrengths: string
  areasOfNeed: string
  strategies: string[]
  successCriteria: string
  targets: Array<{ target: string; strategy: string; successMeasure: string }>
}

const ILP_CONTENT: Record<string, IlpContent> = {
  dyslexia: {
    sendCategory: 'Specific Learning Difficulty',
    currentStrengths: 'Strong verbal comprehension and creative thinking. Enthusiastic contributor to class discussions and demonstrates excellent understanding when material is presented orally. Shows good mathematical reasoning and logical thinking.',
    areasOfNeed: 'Reading fluency is approximately 2 years below chronological age. Spelling accuracy affects written expression. Difficulty organising extended writing and decoding unfamiliar vocabulary.',
    strategies: ['Coloured overlays and pastel-tinted paper', 'Chunked written instructions with visual cues', 'Subject-specific word banks displayed prominently', '25% additional time for all written assessments', 'Text-to-speech software available across all subjects'],
    successCriteria: 'Student accesses written texts independently using support tools and produces structured written responses with scaffolding that is being progressively withdrawn.',
    targets: [
      { target: 'Improve reading fluency by at least one standardised year group over the academic year', strategy: 'Paired reading programme three times per week; audio books used alongside text; weekly decoding practice using specialist dyslexia programme', successMeasure: 'Standardised reading assessment at end of each term shows measurable improvement; student reads aloud unfamiliar text with fewer than 3 errors per paragraph' },
      { target: 'Use a personalised subject vocabulary book effectively across all lessons', strategy: 'Build vocabulary entries collaboratively with each teacher; practise using Look-Cover-Write-Check multisensory method twice weekly', successMeasure: 'Student correctly spells 80% of target vocabulary in independent writing tasks; teacher observation confirms regular, independent use of vocabulary book' },
      { target: 'Produce independently structured PEEL paragraphs with scaffolding progressively withdrawn', strategy: 'Modelled writing → joint writing → supported independent writing → independent writing over the term; sentence starters gradually removed', successMeasure: 'Three pieces of independent written work across different subjects demonstrate PEEL structure without use of prompt cards' },
    ],
  },
  ADHD: {
    sendCategory: 'Social, Emotional and Mental Health',
    currentStrengths: 'High energy and enthusiasm for practical, hands-on tasks. Creative problem-solver who generates original ideas. Shows considerable academic potential when engaged with stimulating, fast-paced material. Strong peer relationships.',
    areasOfNeed: 'Sustained attention during longer tasks (30+ minutes). Impulse control — calling out and interrupting. Organisational skills — frequently arrives without required equipment. Difficulty following multi-step verbal instructions.',
    strategies: ['Tasks broken into 5-10 minute micro-goals with timer', 'Preferred seating near front, away from windows and high-traffic areas', 'Movement breaks built into lessons approximately every 20 minutes', 'Fidget tools available as agreed with student', 'Visual timetable and equipment checklist in planner'],
    successCriteria: 'Student sustains focused attention on a single academic task for 20+ minutes and independently uses organisational strategies without adult prompting.',
    targets: [
      { target: 'Sustain on-task behaviour for 20-minute work blocks without adult redirection', strategy: 'Visual countdown timer; task broken into micro-goals on a checklist; brief movement break after each block; proximity support from teacher', successMeasure: 'Teacher observation tally shows on-task behaviour above 75% for three consecutive 20-minute periods in two different subjects' },
      { target: 'Arrive to lessons with all required equipment on 9 out of 10 occasions', strategy: 'End-of-day equipment check with form tutor using visual checklist; phone reminder set for the evening before practical lessons', successMeasure: 'Two-week record card shows 9/10 lessons arrived with correct equipment; student self-reports routine feels manageable' },
      { target: 'Wait to be called rather than calling out in at least 80% of lesson contributions', strategy: 'Private signal system (hand on desk rather than calling out); specific praise when strategy is used; brief daily check-in with form tutor to review progress', successMeasure: 'Three-week teacher log shows calling-out incidents have reduced by at least 60% from baseline' },
    ],
  },
  autism: {
    sendCategory: 'Autism Spectrum Condition',
    currentStrengths: 'Exceptional focus and depth of knowledge in areas of strong interest. High attention to detail and accuracy. Strong factual memory. Reliable adherence to agreed routines and rules. Written communication is excellent when working independently.',
    areasOfNeed: 'Managing transitions between activities, especially unplanned changes to routine. Participating in unstructured social situations and group work. Interpreting implicit social cues, non-literal language and figurative expressions.',
    strategies: ['5-minute advance warnings before all transitions', 'Written instructions displayed alongside verbal explanations', 'Structured social stories to prepare for new situations or changes', 'Agreed quiet workspace available at all times', 'Clear lesson objectives written on the board at the start of each lesson'],
    successCriteria: 'Student manages planned transitions independently and participates meaningfully in structured group activities, using agreed self-regulation strategies.',
    targets: [
      { target: 'Manage planned transitions between all lessons independently using a transition card', strategy: 'Visual daily schedule with subject colour-coding; 5-minute verbal warning from teacher; personalised transition card with next-step prompts; brief debrief with key worker after transitions', successMeasure: 'Pastoral log over half-term shows student-initiated transitions without significant distress in at least 9 out of 10 recorded transitions' },
      { target: 'Participate meaningfully in at least one structured group task per lesson', strategy: 'Student given a clearly defined role in each group (e.g. timekeeper, scribe, researcher); explicit expectations shared in advance; debrief privately with teacher afterwards', successMeasure: 'Teacher observation confirms participation in structured group task in 4 consecutive weeks across at least two different subjects' },
      { target: 'Independently access the agreed quiet workspace when beginning to feel overwhelmed', strategy: 'Agreed exit system practised with pastoral lead; role-play of the process; de-escalation strategy card in planner; phased introduction starting with guided exits', successMeasure: 'Three successful self-regulated exits to quiet space recorded in pastoral log this half-term; student reports strategy is effective' },
    ],
  },
  EAL: {
    sendCategory: 'English as an Additional Language',
    currentStrengths: 'Multilingual ability — speaks two or more languages fluently. High motivation, strong work ethic and excellent attendance. Shows strong mathematical and scientific reasoning that transfers across languages. Responds positively to support and feedback.',
    areasOfNeed: 'Academic English vocabulary across all subjects. Extended written responses in English lack the complexity expected at this year group. Reading comprehension of complex, multi-clause sentences. Confidence in verbal participation in whole-class discussion.',
    strategies: ['Bilingual subject glossaries provided for all core subjects', 'Key vocabulary pre-taught at the start of each unit', 'Sentence frames and academic writing stems for extended tasks', 'Think-pair-share activities to build confidence before whole-class discussion', 'Visual supports, graphic organisers and concept maps used across subjects'],
    successCriteria: 'Student independently accesses GCSE-level texts and produces extended written responses demonstrating accurate use of subject-specific academic language.',
    targets: [
      { target: 'Build and accurately use a vocabulary bank of 50 subject-specific terms per half-term across core subjects', strategy: 'Weekly vocabulary card with image, definition, phonetic transcription and example sentence; Quizlet digital practice; explicit use of new terms required in written work', successMeasure: 'Vocabulary assessment at end of half-term shows 80%+ accuracy in using target terms in context in writing' },
      { target: 'Write structured 3-paragraph responses using academic connectives without sentence frame support by the end of term', strategy: 'Modelled writing → joint writing with bilingual support → sentence frames → independent writing; connective word mats progressively removed', successMeasure: 'Written work at end of term shows independent use of academic connectives and paragraph structure; no sentence frames used' },
      { target: 'Voluntarily contribute to class discussion at least twice per lesson by half-term', strategy: 'Pre-warning of discussion questions; think-pair-share before whole-class discussion; explicit praise for contributions; gradually increase from pair to group to whole class', successMeasure: 'Teacher tally over four-week period shows student voluntarily contributes at least twice in all recorded lessons' },
    ],
  },
}

// ── EHCP content ──────────────────────────────────────────────────────────────
type EhcpContent = {
  sections: Record<string, string>
  outcomes: Array<{
    section: string
    outcomeText: string
    successCriteria: string
    provisionRequired: string
  }>
}

const EHCP_CONTENT: Record<string, EhcpContent> = {
  dyslexia: {
    sections: {
      A: 'Student experiences significant difficulties with phonological processing, reading fluency and written expression consistent with a diagnosis of Specific Learning Difficulty (Dyslexia), confirmed by an Educational Psychologist assessment. Reading age is approximately 2 years below chronological age. Student demonstrates strong verbal reasoning, good comprehension when material is presented orally, and creative thinking. Is well-liked by peers and staff.',
      B: 'Communication and Interaction: Verbal communication is age-appropriate and articulate. Student communicates ideas effectively orally but has difficulty translating verbal understanding into written form. Social communication skills are good; student participates confidently in discussion but avoids situations requiring extended writing in public.',
      E: 'The school will provide: a structured specialist literacy intervention programme delivered by a teaching assistant trained in dyslexia support; full access arrangements for examinations (25% extra time, use of a reader/scribe where appropriate); differentiated resources in all lessons (coloured overlays, chunked instructions, word banks); and access to text-to-speech software across all subjects.',
      F: 'Specialist literacy support: 3 × 30-minute sessions per week with HLTA trained in dyslexia interventions, using an evidence-based programme. Technology support: text-to-speech and word-processing software available in all lessons. Examination access arrangements: 25% additional time for all internal and public examinations; reader and scribe available on request.',
    },
    outcomes: [
      { section: 'E', outcomeText: 'Student will access the full curriculum independently using agreed assistive technology and will achieve reading fluency within 18 months of chronological age', successCriteria: 'Standardised reading assessment at the end of the academic year shows reading age within 18 months of chronological age; student independently selects and operates assistive technology in all lessons', provisionRequired: 'Weekly specialist literacy sessions; text-to-speech software in all subjects; staff training in dyslexia-friendly teaching approaches' },
      { section: 'F', outcomeText: 'Student will produce independently structured extended writing responses in English and humanities subjects meeting age-related expectations by the end of Key Stage', successCriteria: 'Three pieces of independent extended writing in different subjects demonstrate organised paragraphs, accurate subject-specific vocabulary, and analytical rather than descriptive approach; no scaffolding prompts required', provisionRequired: 'Specialist writing programme with structured withdrawal of scaffolding; regular review with SENCO; access arrangements in examinations' },
      { section: 'A', outcomeText: 'Student will develop confident self-advocacy skills and independently request adjustments and support across all areas of school life', successCriteria: 'Pastoral records and student self-report show student initiates support requests without adult prompting on at least 80% of occasions over a half-term period; student can articulate their needs to new staff', provisionRequired: 'Regular key worker meetings (fortnightly); self-advocacy skills programme; student-led annual review contribution' },
    ],
  },
  autism: {
    sections: {
      A: 'Student has a diagnosis of Autism Spectrum Condition, confirmed by a multidisciplinary team assessment. Student presents with exceptional abilities in areas of special interest, excellent factual recall, high attention to detail and a strong sense of fairness and justice. Challenges include navigating unstructured social situations, managing unexpected changes to routine, interpreting non-literal language and figurative expression, and processing sensory stimuli in busy, noisy environments.',
      B: 'Communication and Interaction: Student communicates clearly and formally in structured, one-to-one contexts. Shows excellent written communication skills when working independently. Finds implicit social rules and subtext in conversation difficult to interpret. Unstructured social situations (break time, group work without defined roles) cause significant anxiety. Does not always read non-verbal communication accurately.',
      E: 'The school will implement a comprehensive structured support package: a predictable, consistent daily routine with advance written notice of all changes; a designated key worker who meets with the student weekly; access to a named quiet workspace at all times; explicit social communication support; and staff training for all subject teachers in autism-aware teaching practice.',
      F: 'Key worker support: weekly 30-minute meeting to review wellbeing, upcoming events and any concerns; key worker acts as first point of contact for student and family. Social communication group: one session per week with other students and trained staff member. Sensory accommodation: identified quiet workspace available at all times; student may use ear defenders in any lesson without requiring permission. All staff to receive autism-awareness briefing at the start of each academic year.',
    },
    outcomes: [
      { section: 'B', outcomeText: 'Student will develop reliable strategies for navigating unstructured social situations and will participate meaningfully in structured group learning activities across all subjects', successCriteria: 'Teacher observation across subjects confirms regular participation in structured group work; student self-reports feeling comfortable in most unstructured social situations at school by the end of the year', provisionRequired: 'Weekly social communication group; explicit role assignment in all group tasks; structured preparation for social situations via social stories' },
      { section: 'E', outcomeText: 'Student will manage planned transitions and all unexpected changes using a personalised transition and self-regulation plan without requiring adult support', successCriteria: 'Pastoral records over the spring and summer terms show student-initiated, independent management of planned transitions; agreed protocol in place for unexpected changes and student uses it successfully', provisionRequired: 'Visual daily schedule with colour-coding; personalised transition card; key worker daily check-in; flexibility in timetable arrangements where possible' },
      { section: 'F', outcomeText: 'Student\'s sensory needs will be fully accommodated so they can access the complete school day and all curricular activities without significant sensory distress', successCriteria: 'Student self-reports sensory wellbeing score of 7+ on weekly check-in scale for 8 consecutive weeks; number of sensory-related withdrawals from lessons reduces to fewer than 2 per week', provisionRequired: 'Quiet workspace with agreed access; ear defenders; sensory audit of all teaching spaces; staff training in sensory sensitivities; advance notice of any unusual environmental changes' },
    ],
  },
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Oakfield Academy — Comprehensive Demo Seed')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── 1. Find school ────────────────────────────────────────────────────────
  const school = await prisma.school.findFirst({ where: { wondeId: 'WONDE-OAKFIELD' } })
  if (!school) throw new Error('Oakfield Academy not found. Run `npm run wonde:seed` first.')
  console.log(`✓ School: ${school.name} (${school.id})`)

  // ── 2. Find SENCO ─────────────────────────────────────────────────────────
  const senco = await prisma.user.findFirst({ where: { email: 'emma.wilson@oakfield.edu' } })
  if (!senco) throw new Error('SENCO not found. Run `npm run wonde:seed` first.')
  console.log(`✓ SENCO: ${senco.firstName} ${senco.lastName}`)

  // ── 3. Resolve teacher user IDs ───────────────────────────────────────────
  const teacherIdByEmail = new Map<string, string>()
  const allTeacherEmails = Object.values(TEACHER_EMAILS).flat()
  for (const email of allTeacherEmails) {
    const u = await prisma.user.findFirst({ where: { email }, select: { id: true } })
    if (u) teacherIdByEmail.set(email, u.id)
  }
  console.log(`✓ ${teacherIdByEmail.size} teachers resolved`)

  // ── 4. Fetch all students with SEND status ────────────────────────────────
  const students = await prisma.user.findMany({
    where:   { schoolId: school.id, role: 'STUDENT', isActive: true },
    include: { sendStatus: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`✓ ${students.length} students loaded`)

  // ── 5. Assign deterministic ability scores (1–9 float) ───────────────────
  const studentAbility = new Map<string, number>()
  for (const s of students) {
    // Base ability: weighted towards the middle (4–8), some outliers
    let base = 3.5 + rng() * 5   // 3.5–8.5
    // Apply slight SEND modifier (still can be high-performing)
    if (s.sendStatus && s.sendStatus.activeStatus !== 'NONE') {
      base = Math.max(1.5, base - 0.5 - rng() * 0.8)
    }
    studentAbility.set(s.id, Math.min(9, Math.max(1, base)))
  }

  // ── 6. Core loop: Lessons → Homework → Submissions ────────────────────────
  const now = new Date()
  let lessonCount = 0, hwCount = 0, subCount = 0, skipCount = 0

  // Map student ability → submissions per class for aggregate calculations
  const classScores = new Map<string, number[]>()  // classId → all finalScores
  const classEnrolled = new Map<string, number>()   // classId → enrolled count

  for (const subj of CORE_SUBJECTS) {
    const subjCode     = SUBJECT_CODE[subj]
    const teacherEmails = TEACHER_EMAILS[subj]

    for (let yi = 0; yi < 4; yi++) {
      const year        = 7 + yi
      const classId     = `oakfield-WCLS-${year}-${subjCode}`
      const teacherEmail = teacherEmails[yi]
      const teacherUserId = teacherIdByEmail.get(teacherEmail)
      if (!teacherUserId) {
        console.warn(`  ! Teacher not found: ${teacherEmail}`)
        continue
      }

      // Enrolled students for this class
      const enrolments = await prisma.enrolment.findMany({
        where:  { classId },
        select: { userId: true },
      })
      const enrolledIds = enrolments.map(e => e.userId)
      if (!enrolledIds.length) {
        console.warn(`  ! No enrolments found for class ${classId}`)
        continue
      }
      classEnrolled.set(classId, enrolledIds.length)
      if (!classScores.has(classId)) classScores.set(classId, [])

      // 4 lessons: 4 weeks ago → 1 week ago
      const templates = HW_TEMPLATES[subj]

      for (let li = 0; li < 4; li++) {
        const weeksAgo = 4 - li  // 4, 3, 2, 1 weeks ago
        const lessonDate = new Date(now.getTime() - weeksAgo * 7 * 86400000)
        lessonDate.setHours(10, 0, 0, 0)
        const lessonEnd = new Date(lessonDate.getTime() + 60 * 60000)
        const tmpl = templates[li]

        // Lesson
        const lessonId = `demo-lesson-${year}-${subjCode}-${li}`
        await prisma.lesson.upsert({
          where:  { id: lessonId },
          update: { scheduledAt: lessonDate, endsAt: lessonEnd },
          create: {
            id:          lessonId,
            schoolId:    school.id,
            classId,
            title:       tmpl.lessonTitle,
            topic:       tmpl.topic,
            scheduledAt: lessonDate,
            endsAt:      lessonEnd,
            published:   true,
            createdBy:   teacherUserId,
          },
        })
        lessonCount++

        // Homework (due 5 days after lesson)
        const dueAt = new Date(lessonDate.getTime() + 5 * 86400000)
        const hwId  = `demo-hw-${year}-${subjCode}-${li}`
        const hw = await prisma.homework.upsert({
          where:  { id: hwId },
          update: { dueAt },
          create: {
            id:           hwId,
            schoolId:     school.id,
            classId,
            lessonId,
            title:        tmpl.title,
            instructions: tmpl.instructions,
            modelAnswer:  tmpl.questions.map((q, i) => `Q${i + 1}: ${q.modelAnswer}`).join('\n\n'),
            type:         'SHORT_ANSWER',
            status:       'PUBLISHED',
            gradingBands: GRADING_BANDS,
            questionsJson: tmpl.questions.map((q, i) => ({
              id:     i + 1,
              prompt: q.prompt,
              answer: q.modelAnswer,
              marks:  3,
              type:   'short_answer',
            })),
            dueAt,
            bloomsLevel:       li < 2 ? 'KNOWLEDGE' : 'ANALYSIS',
            learningObjectives: [tmpl.topic],
            createdBy:    teacherUserId,
          },
        })
        hwCount++

        // Submissions for ~85% of enrolled students
        for (const studentId of enrolledIds) {
          if (rng() < 0.15) { skipCount++; continue }  // 15% don't submit

          const ability  = studentAbility.get(studentId) ?? 5
          const variance = (rng() - 0.5) * 2.5  // -1.25 to +1.25
          const rawScore = Math.min(9, Math.max(1, ability + variance))
          const score    = Math.round(rawScore * 10) / 10  // 1dp
          const grade    = String(Math.round(score))

          // Submission date: 0–3 days before due, marked 1–4 days after submission
          const submittedAt = new Date(dueAt.getTime() - ri(0, 3) * 86400000)
          const markedAt    = new Date(submittedAt.getTime() + ri(1, 4) * 86400000)
          const feedback    = score >= 7
            ? 'Excellent work demonstrating strong conceptual understanding. Keep it up.'
            : score >= 5
            ? 'Good effort. Some areas for further development — see the model answer for guidance.'
            : 'Needs significant improvement. Please review the material carefully and reattempt.'

          await prisma.submission.upsert({
            where:  { homeworkId_studentId: { homeworkId: hw.id, studentId } },
            update: {},
            create: {
              schoolId:       school.id,
              homeworkId:     hw.id,
              studentId,
              content:        `Response to "${tmpl.title}": The student addressed each question, demonstrating their understanding of ${tmpl.topic}. Full answers are recorded below.`,
              status:         'RETURNED',
              submittedAt,
              markedAt,
              autoScore:      score,
              teacherScore:   score,
              finalScore:     score,
              grade,
              feedback,
              autoMarked:     true,
              teacherReviewed: true,
            },
          })
          subCount++
          classScores.get(classId)!.push(score)
        }
      }

      process.stdout.write(`  Y${year} ${subj}: ${templates.length} lessons, ${enrolledIds.length} enrolled\n`)
    }
  }

  console.log(`\n✓ Lessons:     ${lessonCount}`)
  console.log(`✓ Homework:    ${hwCount}`)
  console.log(`✓ Submissions: ${subCount} (${skipCount} skipped — no-submit)`)

  // ── 7. ClassPerformanceAggregates ────────────────────────────────────────
  let aggCount = 0
  for (const subj of CORE_SUBJECTS) {
    for (let yi = 0; yi < 4; yi++) {
      const year    = 7 + yi
      const classId = `oakfield-WCLS-${year}-${SUBJECT_CODE[subj]}`
      const scores  = classScores.get(classId) ?? []
      if (!scores.length) continue

      const avgScore     = scores.reduce((a, b) => a + b, 0) / scores.length
      const enrolled     = classEnrolled.get(classId) ?? 1
      const completionRate = (scores.length / (enrolled * 4))  // across 4 homeworks
      const predictedDelta = (avgScore - 5.5) * 0.2  // small positive/negative delta vs expected

      await prisma.classPerformanceAggregate.upsert({
        where:  { classId_termId: { classId, termId: 'spring-2026' } },
        update: { avgScore, completionRate, predictedDelta },
        create: {
          schoolId:      school.id,
          classId,
          termId:        'spring-2026',
          avgScore,
          completionRate,
          predictedDelta,
          integrityFlagRate: 0,
        },
      })
      aggCount++
    }
  }
  console.log(`✓ ClassPerformanceAggregates: ${aggCount}`)

  // ── 8. TeacherPredictions ─────────────────────────────────────────────────
  let predCount = 0
  for (const subj of CORE_SUBJECTS) {
    for (let yi = 0; yi < 4; yi++) {
      const year        = 7 + yi
      const classId     = `oakfield-WCLS-${year}-${SUBJECT_CODE[subj]}`
      const teacherEmail = TEACHER_EMAILS[subj][yi]
      const teacherUserId = teacherIdByEmail.get(teacherEmail)
      if (!teacherUserId) continue

      const enrolments = await prisma.enrolment.findMany({
        where:  { classId },
        select: { userId: true },
      })

      for (const { userId: studentId } of enrolments) {
        const ability = studentAbility.get(studentId) ?? 5
        // predictedScore is 0-100: convert ability (1-9) to percentage
        const predictedScore = Math.round((ability / 9) * 100)

        await prisma.teacherPrediction.upsert({
          where: {
            studentId_teacherId_subject_termLabel: {
              studentId,
              teacherId:  teacherUserId,
              subject:    subj,
              termLabel:  'Spring 2026',
            },
          },
          update: { predictedScore },
          create: {
            schoolId:       school.id,
            studentId,
            teacherId:      teacherUserId,
            subject:        subj,
            termLabel:      'Spring 2026',
            predictedScore,
            adjustment:     0,
            notes:          `Prediction based on ${subj} performance this term.`,
          },
        })
        predCount++
      }
    }
  }
  console.log(`✓ TeacherPredictions: ${predCount}`)

  // ── 9. ILPs for SEN_SUPPORT students ─────────────────────────────────────
  const sendStudents = students.filter(
    s => s.sendStatus && s.sendStatus.activeStatus !== 'NONE',
  )
  const senSupportStudents = sendStudents.filter(
    s => s.sendStatus!.activeStatus === 'SEN_SUPPORT',
  )
  const ehcpStudents = sendStudents.filter(
    s => s.sendStatus!.activeStatus === 'EHCP',
  )

  let ilpCount = 0, targetCount = 0
  const studentIlpTargets = new Map<string, string[]>()  // studentId → [targetId, ...]

  for (const student of senSupportStudents) {
    const needArea = student.sendStatus!.needArea ?? 'dyslexia'
    const content  = ILP_CONTENT[needArea] ?? ILP_CONTENT['dyslexia']
    const ilpId    = `demo-ilp-${student.id}`
    const reviewDate = new Date(now.getTime() + 90 * 86400000)

    const ilp = await prisma.individualLearningPlan.upsert({
      where:  { id: ilpId },
      update: {},
      create: {
        id:               ilpId,
        schoolId:         school.id,
        studentId:        student.id,
        createdBy:        senco.id,
        sendCategory:     content.sendCategory,
        currentStrengths: content.currentStrengths,
        areasOfNeed:      content.areasOfNeed,
        strategies:       content.strategies,
        successCriteria:  content.successCriteria,
        reviewDate,
        status:           'active',
        autoGenerated:    true,
        approvedBySenco:  true,
        approvedAt:       new Date(now.getTime() - 30 * 86400000),
        approvedBy:       senco.id,
      },
    })
    ilpCount++

    const targetIds: string[] = []
    for (let ti = 0; ti < content.targets.length; ti++) {
      const t       = content.targets[ti]
      const targetId = `demo-ilptarget-${student.id}-${ti}`
      const targetDate = new Date(now.getTime() + (90 + ti * 30) * 86400000)

      await prisma.ilpTarget.upsert({
        where:  { id: targetId },
        update: {},
        create: {
          id:            targetId,
          ilpId:         ilp.id,
          target:        t.target,
          strategy:      t.strategy,
          successMeasure: t.successMeasure,
          targetDate,
          status:        'active',
        },
      })
      targetIds.push(targetId)
      targetCount++
    }
    studentIlpTargets.set(student.id, targetIds)
  }
  console.log(`✓ ILPs: ${ilpCount} (${targetCount} targets) for SEN_SUPPORT students`)

  // ── 10. EHCPs for EHCP students ──────────────────────────────────────────
  let ehcpCount = 0, outcomeCount = 0

  for (const student of ehcpStudents) {
    const needArea = student.sendStatus!.needArea ?? 'dyslexia'
    const content  = EHCP_CONTENT[needArea] ?? EHCP_CONTENT['dyslexia']
    const ehcpId   = `demo-ehcp-${student.id}`
    const planDate  = new Date(now.getTime() - 180 * 86400000)
    const reviewDate = new Date(now.getTime() + 185 * 86400000)

    const ehcp = await prisma.ehcpPlan.upsert({
      where:  { id: ehcpId },
      update: {},
      create: {
        id:             ehcpId,
        schoolId:       school.id,
        studentId:      student.id,
        localAuthority: 'Oakfield Local Authority',
        planDate,
        reviewDate,
        coordinatorName: `${senco.firstName} ${senco.lastName}`,
        status:          'active',
        createdBy:       senco.id,
        autoGenerated:   true,
        approvedBySenco: true,
        approvedAt:      planDate,
        approvedBy:      senco.id,
        sections:        content.sections,
      },
    })
    ehcpCount++

    for (let oi = 0; oi < content.outcomes.length; oi++) {
      const o        = content.outcomes[oi]
      const outcomeId = `demo-ehcp-outcome-${student.id}-${oi}`
      await prisma.ehcpOutcome.upsert({
        where:  { id: outcomeId },
        update: {},
        create: {
          id:               outcomeId,
          ehcpId:           ehcp.id,
          section:          o.section,
          outcomeText:      o.outcomeText,
          targetDate:       o.targetDate ?? new Date(now.getTime() + 180 * 86400000),
          successCriteria:  o.successCriteria,
          provisionRequired: o.provisionRequired,
          status:           'active',
        },
      })
      outcomeCount++
    }

    // EHCP students also get an ILP (many schools use both)
    const ilpContent = ILP_CONTENT[needArea] ?? ILP_CONTENT['dyslexia']
    const ilpId = `demo-ilp-ehcp-${student.id}`
    const ilpReviewDate = new Date(now.getTime() + 90 * 86400000)

    const ilp = await prisma.individualLearningPlan.upsert({
      where:  { id: ilpId },
      update: {},
      create: {
        id:               ilpId,
        schoolId:         school.id,
        studentId:        student.id,
        createdBy:        senco.id,
        sendCategory:     ilpContent.sendCategory,
        currentStrengths: ilpContent.currentStrengths,
        areasOfNeed:      ilpContent.areasOfNeed,
        strategies:       ilpContent.strategies,
        successCriteria:  ilpContent.successCriteria,
        reviewDate:       ilpReviewDate,
        status:           'active',
        autoGenerated:    true,
        approvedBySenco:  true,
        approvedAt:       planDate,
        approvedBy:       senco.id,
      },
    })
    ilpCount++

    const ehcpTargetIds: string[] = []
    for (let ti = 0; ti < ilpContent.targets.length; ti++) {
      const t        = ilpContent.targets[ti]
      const targetId  = `demo-ilptarget-ehcp-${student.id}-${ti}`
      const targetDate = new Date(now.getTime() + (90 + ti * 30) * 86400000)
      await prisma.ilpTarget.upsert({
        where:  { id: targetId },
        update: {},
        create: {
          id:            targetId,
          ilpId:         ilp.id,
          target:        t.target,
          strategy:      t.strategy,
          successMeasure: t.successMeasure,
          targetDate,
          status:        'active',
        },
      })
      ehcpTargetIds.push(targetId)
      targetCount++
    }
    studentIlpTargets.set(student.id, ehcpTargetIds)
  }
  console.log(`✓ EHCPs: ${ehcpCount} (${outcomeCount} outcomes) for EHCP students`)
  console.log(`✓ ILPs total: ${ilpCount} (${targetCount} targets including EHCP students)`)

  // ── 11. ILP Evidence Entries for SEND students ────────────────────────────
  let evidenceCount = 0

  for (const student of sendStudents) {
    const targetIds = studentIlpTargets.get(student.id)
    if (!targetIds?.length) continue

    // Find their English submissions (primary subject for evidence)
    const subs = await prisma.submission.findMany({
      where: {
        schoolId:  school.id,
        studentId: student.id,
        status:    'RETURNED',
      },
      orderBy: { submittedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        finalScore: true,
        homework: { select: { title: true, class: { select: { subject: true } } } },
      },
    })

    for (let si = 0; si < Math.min(subs.length, targetIds.length); si++) {
      const sub       = subs[si]
      const targetId  = targetIds[si]
      const score     = sub.finalScore ?? 5
      const evidenceType = score >= 6 ? 'PROGRESS' : score >= 4 ? 'NEUTRAL' : 'CONCERN'

      await prisma.ilpEvidenceEntry.upsert({
        where:  { submissionId_ilpTargetId: { submissionId: sub.id, ilpTargetId: targetId } },
        update: {},
        create: {
          schoolId:     school.id,
          studentId:    student.id,
          ilpTargetId:  targetId,
          submissionId: sub.id,
          homeworkTitle: sub.homework.title,
          subject:       sub.homework.class?.subject ?? 'Unknown',
          score,
          maxScore:      9,
          evidenceType,
          aiSummary:    evidenceType === 'PROGRESS'
            ? `Student demonstrated progress against their ILP target. Score of ${score}/9 indicates understanding above baseline.`
            : evidenceType === 'CONCERN'
            ? `Score of ${score}/9 suggests student is struggling with this ILP target area. Review support strategies.`
            : `Neutral evidence — score of ${score}/9 is broadly in line with baseline expectations.`,
          autoLinked:   true,
          createdBy:    senco.id,
        },
      })
      evidenceCount++
    }
  }
  console.log(`✓ ILP Evidence Entries: ${evidenceCount}`)

  // ── 12. Send Concerns for lowest-performing students ─────────────────────
  let concernCount = 0

  // Find students with ability below 4 (persistently struggling)
  const lowPerformers = students.filter(s => (studentAbility.get(s.id) ?? 5) < 3.5)

  for (const student of lowPerformers.slice(0, 10)) {  // cap at 10 concerns
    // Find the subject teacher they struggle most with
    const concernId = `demo-concern-${student.id}`
    const yearIdx   = student.yearGroup ? student.yearGroup - 7 : 0
    const teacherEmail = TEACHER_EMAILS.English[Math.min(yearIdx, 3)]
    const teacherUserId = teacherIdByEmail.get(teacherEmail)
    if (!teacherUserId) continue

    // Check if concern already exists
    const existing = await prisma.sendConcern.findFirst({
      where: { id: concernId },
    })
    if (existing) continue

    await prisma.sendConcern.create({
      data: {
        id:          concernId,
        schoolId:    school.id,
        studentId:   student.id,
        raisedBy:    teacherUserId,
        source:      'teacher',
        category:    'literacy',
        description: `Persistent underperformance across multiple assessments this term. Student is consistently scoring below Grade 4 and is not responding to standard differentiation strategies. SEND assessment may be appropriate.`,
        status:      'open',
      },
    })
    concernCount++
  }
  console.log(`✓ SendConcerns: ${concernCount} (low-performing non-SEND students)`)

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Demo Seed Complete — Oakfield Academy')
  console.log(`  Lessons:          ${lessonCount}   (4 per class, 4 core subjects × 4 year groups)`)
  console.log(`  Homework:         ${hwCount}   (1 per lesson, SHORT_ANSWER, PUBLISHED)`)
  console.log(`  Submissions:      ${subCount}  (~85% of enrolled students, RETURNED)`)
  console.log(`  Performance aggs: ${aggCount}   (one per class, spring-2026 term)`)
  console.log(`  Predictions:      ${predCount}  (per student per subject)`)
  console.log(`  ILPs:             ${ilpCount}   (SEN_SUPPORT + EHCP students)`)
  console.log(`  ILP Targets:      ${targetCount}`)
  console.log(`  EHCPs:            ${ehcpCount}`)
  console.log(`  EHCP Outcomes:    ${outcomeCount}`)
  console.log(`  ILP Evidence:     ${evidenceCount}`)
  console.log(`  SEND Concerns:    ${concernCount}`)
  console.log('\n  Credentials (all password: Demo1234!)')
  console.log('  SENCO:     emma.wilson@oakfield.edu')
  console.log('  Teacher:   helen.davies@oakfield.edu  (English HOD, Y7)')
  console.log('  Teacher:   robert.johnson@oakfield.edu (Maths HOD, Y7)')
  console.log('  Teacher:   patricia.lee@oakfield.edu  (Science HOD, Y7)')
  console.log('  Teacher:   andrew.baker@oakfield.edu  (History HOD, Y7)')
  console.log('  SLT:       james.harrison@oakfield.edu')
  console.log('═══════════════════════════════════════════════════════\n')
}

main()
  .catch(err => { console.error('\nFATAL:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
