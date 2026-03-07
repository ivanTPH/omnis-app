export type CurriculumLesson = { id: string; name: string }
export type CurriculumTopic  = { id: string; name: string; lessons: CurriculumLesson[] }
export type SubjectData = {
  subject:       string
  examBoard:     string
  yearGroups:    number[]
  qualification: string
  topics:        CurriculumTopic[]
}

export const ALL_SUBJECTS = [
  'English', 'Maths', 'Science', 'History', 'Geography',
  'French', 'Spanish', 'Art', 'Music', 'PE', 'Drama',
  'Computing', 'RE', 'PSHE',
]

export const CURRICULUM: SubjectData[] = [
  // ── English KS3 ────────────────────────────────────────────────────────────
  {
    subject: 'English', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'en-ks3-desc-writing', name: 'Descriptive Writing',
        lessons: [
          { id: 'l1', name: 'Descriptive Writing — Sensory Detail' },
          { id: 'l2', name: 'Descriptive Writing — Creating Atmosphere' },
          { id: 'l3', name: 'Descriptive Writing — Structuring for Effect' },
          { id: 'l4', name: 'Descriptive Writing — Writing Assessment' },
        ],
      },
      {
        id: 'en-ks3-narrative', name: 'Narrative Writing',
        lessons: [
          { id: 'l1', name: 'Narrative Writing — Building Characters' },
          { id: 'l2', name: 'Narrative Writing — Plot & Structure' },
          { id: 'l3', name: 'Narrative Writing — Opening Hooks' },
          { id: 'l4', name: 'Narrative Writing — Dialogue & Pace' },
        ],
      },
      {
        id: 'en-ks3-reading-fiction', name: 'Reading Fiction',
        lessons: [
          { id: 'l1', name: 'Reading Fiction — Exploring Characters' },
          { id: 'l2', name: 'Reading Fiction — Identifying Themes' },
          { id: 'l3', name: 'Reading Fiction — Language Analysis' },
          { id: 'l4', name: 'Reading Fiction — Writer\'s Viewpoint' },
        ],
      },
      {
        id: 'en-ks3-aic', name: 'An Inspector Calls',
        lessons: [
          { id: 'l1', name: 'An Inspector Calls — Context & Background' },
          { id: 'l2', name: 'An Inspector Calls — Act 1 Introduction' },
          { id: 'l3', name: 'An Inspector Calls — Character Study: Sheila' },
          { id: 'l4', name: 'An Inspector Calls — Responsibility Theme' },
          { id: 'l5', name: 'An Inspector Calls — Dramatic Techniques' },
        ],
      },
      {
        id: 'en-ks3-grammar', name: 'Grammar & Punctuation',
        lessons: [
          { id: 'l1', name: 'Grammar — Sentence Types & Structures' },
          { id: 'l2', name: 'Grammar — Punctuation for Effect' },
          { id: 'l3', name: 'Grammar — Vocabulary & Word Classes' },
          { id: 'l4', name: 'Grammar — Cohesion & Paragraphing' },
        ],
      },
    ],
  },

  // ── English GCSE ───────────────────────────────────────────────────────────
  {
    subject: 'English', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'en-gcse-aic', name: 'An Inspector Calls',
        lessons: [
          { id: 'l1', name: 'An Inspector Calls — Act 1 Introduction' },
          { id: 'l2', name: 'An Inspector Calls — Act 2: Escalating Tension' },
          { id: 'l3', name: 'An Inspector Calls — Character Study: Inspector Goole' },
          { id: 'l4', name: 'An Inspector Calls — Character Study: Sheila Birling' },
          { id: 'l5', name: 'An Inspector Calls — Character Study: Mr Birling' },
          { id: 'l6', name: 'An Inspector Calls — Responsibility Theme' },
          { id: 'l7', name: 'An Inspector Calls — Social Class & Power' },
          { id: 'l8', name: 'An Inspector Calls — Dramatic Structure & Techniques' },
          { id: 'l9', name: 'An Inspector Calls — Essay Practice (AQA-style)' },
        ],
      },
      {
        id: 'en-gcse-macbeth', name: 'Macbeth',
        lessons: [
          { id: 'l1', name: 'Macbeth — Context: Jacobean England & Witchcraft' },
          { id: 'l2', name: 'Macbeth — Ambition and Power' },
          { id: 'l3', name: 'Macbeth — Soliloquy Analysis: "Is this a dagger"' },
          { id: 'l4', name: 'Macbeth — Lady Macbeth: Power & Manipulation' },
          { id: 'l5', name: 'Macbeth — The Supernatural Theme' },
          { id: 'l6', name: 'Macbeth — Kingship & Tyranny' },
          { id: 'l7', name: 'Macbeth — Appearance vs Reality' },
          { id: 'l8', name: 'Macbeth — Essay Practice (AQA-style)' },
        ],
      },
      {
        id: 'en-gcse-romeo', name: 'Romeo & Juliet',
        lessons: [
          { id: 'l1', name: 'Romeo & Juliet — Context: Renaissance Verona' },
          { id: 'l2', name: 'Romeo & Juliet — How does Shakespeare present conflict?' },
          { id: 'l3', name: 'Romeo & Juliet — Love and its many forms' },
          { id: 'l4', name: 'Romeo & Juliet — Family, Honour & Duty' },
          { id: 'l5', name: 'Romeo & Juliet — Fate & Tragedy' },
          { id: 'l6', name: 'Romeo & Juliet — Language Analysis: key speeches' },
          { id: 'l7', name: 'Romeo & Juliet — Essay Practice (AQA-style)' },
        ],
      },
      {
        id: 'en-gcse-p1', name: 'Paper 1: Unseen Fiction',
        lessons: [
          { id: 'l1', name: 'Paper 1 Unseen Fiction — Language Analysis Techniques' },
          { id: 'l2', name: 'Paper 1 Unseen Fiction — Structural Analysis' },
          { id: 'l3', name: 'Paper 1 Unseen Fiction — Q4: Evaluation' },
          { id: 'l4', name: 'Paper 1 Unseen Fiction — Q5: Narrative Writing' },
          { id: 'l5', name: 'Paper 1 Unseen Fiction Practice' },
        ],
      },
      {
        id: 'en-gcse-p2', name: 'Paper 2: Non-Fiction',
        lessons: [
          { id: 'l1', name: 'Paper 2 Non-Fiction — Summary & Synthesis' },
          { id: 'l2', name: 'Paper 2 Non-Fiction — Language Analysis' },
          { id: 'l3', name: 'Paper 2 Non-Fiction — Comparing Perspectives' },
          { id: 'l4', name: 'Paper 2 Non-Fiction — Persuasive Writing' },
          { id: 'l5', name: 'Paper 2 Non-Fiction — Q5: Writing to Argue' },
        ],
      },
    ],
  },

  // ── English A-Level ────────────────────────────────────────────────────────
  {
    subject: 'English', examBoard: 'AQA', yearGroups: [12, 13], qualification: 'A-Level',
    topics: [
      {
        id: 'en-al-prose', name: 'Prose Study',
        lessons: [
          { id: 'l1', name: 'Prose — Close Reading: Narrative Voice' },
          { id: 'l2', name: 'Prose — Comparative Analysis' },
          { id: 'l3', name: 'Prose — Context & Interpretation' },
        ],
      },
      {
        id: 'en-al-poetry', name: 'Poetry Study',
        lessons: [
          { id: 'l1', name: 'Poetry — Unseen Analysis Techniques' },
          { id: 'l2', name: 'Poetry — Comparative Essay Skills' },
          { id: 'l3', name: 'Poetry — Anthology Study' },
        ],
      },
    ],
  },

  // ── Maths KS3 ──────────────────────────────────────────────────────────────
  {
    subject: 'Maths', examBoard: 'Edexcel', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'ma-ks3-fractions', name: 'Fractions',
        lessons: [
          { id: 'l1', name: 'Fractions — Adding & Subtracting with Different Denominators' },
          { id: 'l2', name: 'Fractions — Multiplying & Dividing' },
          { id: 'l3', name: 'Fractions — Fractions of Amounts' },
          { id: 'l4', name: 'Fractions — Fractions, Decimals & Percentages' },
          { id: 'l5', name: 'Fractions — Problem Solving' },
        ],
      },
      {
        id: 'ma-ks3-number', name: 'Number',
        lessons: [
          { id: 'l1', name: 'Number — Place Value & Rounding' },
          { id: 'l2', name: 'Number — Factors, Multiples & Primes' },
          { id: 'l3', name: 'Number — Powers & Roots' },
          { id: 'l4', name: 'Number — Order of Operations (BODMAS)' },
          { id: 'l5', name: 'Number — Negative Numbers' },
        ],
      },
      {
        id: 'ma-ks3-algebra-intro', name: 'Algebra Introduction',
        lessons: [
          { id: 'l1', name: 'Algebra — Introduction to Expressions' },
          { id: 'l2', name: 'Algebra — Simplifying Expressions' },
          { id: 'l3', name: 'Algebra — Substitution' },
          { id: 'l4', name: 'Algebra — Writing & Using Formulae' },
          { id: 'l5', name: 'Algebra — One-Step Equations' },
        ],
      },
      {
        id: 'ma-ks3-ratio', name: 'Ratio & Proportion',
        lessons: [
          { id: 'l1', name: 'Ratio — Introduction & Simplifying' },
          { id: 'l2', name: 'Ratio — Sharing in a Given Ratio' },
          { id: 'l3', name: 'Proportion — Direct & Inverse' },
          { id: 'l4', name: 'Ratio — Problem Solving' },
        ],
      },
    ],
  },

  // ── Maths GCSE ─────────────────────────────────────────────────────────────
  {
    subject: 'Maths', examBoard: 'Edexcel', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'ma-gcse-algebra', name: 'Algebra',
        lessons: [
          { id: 'l1', name: 'Algebra — Solving Linear Equations' },
          { id: 'l2', name: 'Algebra — Solving Simultaneous Equations' },
          { id: 'l3', name: 'Algebra — Expanding & Factorising Quadratics' },
          { id: 'l4', name: 'Algebra — Solving Quadratic Equations' },
          { id: 'l5', name: 'Algebra — Inequalities' },
          { id: 'l6', name: 'Algebra — Graphs: y = mx + c' },
          { id: 'l7', name: 'Algebra — nth Term of Sequences' },
          { id: 'l8', name: 'Algebra — Functions & Composite Functions' },
        ],
      },
      {
        id: 'ma-gcse-number', name: 'Number',
        lessons: [
          { id: 'l1', name: 'Number — Standard Form' },
          { id: 'l2', name: 'Number — Surds & Irrational Numbers' },
          { id: 'l3', name: 'Number — Percentages & Reverse Percentages' },
          { id: 'l4', name: 'Number — Compound Interest & Depreciation' },
          { id: 'l5', name: 'Number — Bounds & Error Intervals' },
        ],
      },
      {
        id: 'ma-gcse-stats', name: 'Statistics & Probability',
        lessons: [
          { id: 'l1', name: 'Statistics — Mean, Median, Mode & Range' },
          { id: 'l2', name: 'Statistics — Frequency Tables & Grouped Data' },
          { id: 'l3', name: 'Statistics — Histograms' },
          { id: 'l4', name: 'Probability — Basic Probability' },
          { id: 'l5', name: 'Probability — Tree Diagrams' },
          { id: 'l6', name: 'Probability — Venn Diagrams' },
        ],
      },
      {
        id: 'ma-gcse-geometry', name: 'Geometry & Measures',
        lessons: [
          { id: 'l1', name: 'Geometry — Area & Perimeter' },
          { id: 'l2', name: 'Geometry — Circles: Area & Circumference' },
          { id: 'l3', name: 'Geometry — Volume & Surface Area' },
          { id: 'l4', name: 'Geometry — Pythagoras\' Theorem' },
          { id: 'l5', name: 'Geometry — Trigonometry: SOH CAH TOA' },
          { id: 'l6', name: 'Geometry — Angles in Polygons' },
          { id: 'l7', name: 'Geometry — Transformations' },
          { id: 'l8', name: 'Geometry — Vectors' },
        ],
      },
    ],
  },

  // ── Maths A-Level ──────────────────────────────────────────────────────────
  {
    subject: 'Maths', examBoard: 'Edexcel', yearGroups: [12, 13], qualification: 'A-Level',
    topics: [
      {
        id: 'ma-al-calculus', name: 'Calculus',
        lessons: [
          { id: 'l1', name: 'Calculus — Introduction to Differentiation' },
          { id: 'l2', name: 'Calculus — Integration' },
          { id: 'l3', name: 'Calculus — Applications of Differentiation' },
        ],
      },
      {
        id: 'ma-al-stats', name: 'Statistics',
        lessons: [
          { id: 'l1', name: 'Statistics — Normal Distribution' },
          { id: 'l2', name: 'Statistics — Hypothesis Testing' },
          { id: 'l3', name: 'Statistics — Correlation & Regression' },
        ],
      },
    ],
  },

  // ── Science KS3 ────────────────────────────────────────────────────────────
  {
    subject: 'Science', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'sci-ks3-cells', name: 'Cells & Life Processes',
        lessons: [
          { id: 'l1', name: 'Cells — Plant vs Animal Cells' },
          { id: 'l2', name: 'Cells — Specialised Cells & Their Functions' },
          { id: 'l3', name: 'Cells — Diffusion, Osmosis & Active Transport' },
          { id: 'l4', name: 'Cells — Cell Division: Mitosis' },
        ],
      },
      {
        id: 'sci-ks3-forces', name: 'Forces & Motion',
        lessons: [
          { id: 'l1', name: 'Forces — Types of Force & Resultant Forces' },
          { id: 'l2', name: 'Forces — Speed, Distance & Time' },
          { id: 'l3', name: 'Forces — Gravity & Weight' },
          { id: 'l4', name: 'Forces — Pressure' },
        ],
      },
      {
        id: 'sci-ks3-particles', name: 'Particles & Matter',
        lessons: [
          { id: 'l1', name: 'Particles — States of Matter' },
          { id: 'l2', name: 'Particles — Atoms, Elements & Compounds' },
          { id: 'l3', name: 'Particles — The Periodic Table' },
          { id: 'l4', name: 'Particles — Chemical Reactions' },
        ],
      },
      {
        id: 'sci-ks3-energy', name: 'Energy',
        lessons: [
          { id: 'l1', name: 'Energy — Energy Stores & Transfers' },
          { id: 'l2', name: 'Energy — Renewable & Non-Renewable Sources' },
          { id: 'l3', name: 'Energy — Heat Transfer: Conduction, Convection, Radiation' },
          { id: 'l4', name: 'Energy — Efficiency & Conservation' },
        ],
      },
      {
        id: 'sci-ks3-ecology', name: 'Ecology & Ecosystems',
        lessons: [
          { id: 'l1', name: 'Ecology — Food Chains & Food Webs' },
          { id: 'l2', name: 'Ecology — Adaptations & Natural Selection' },
          { id: 'l3', name: 'Ecology — Human Impact on Ecosystems' },
          { id: 'l4', name: 'Ecology — Biodiversity & Conservation' },
        ],
      },
    ],
  },

  // ── Science GCSE ───────────────────────────────────────────────────────────
  {
    subject: 'Science', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'sci-biology', name: 'Biology',
        lessons: [
          { id: 'l1', name: 'Biology — Cell Structure & Function' },
          { id: 'l2', name: 'Biology — Transport in Cells' },
          { id: 'l3', name: 'Biology — DNA & Genetics' },
          { id: 'l4', name: 'Biology — Natural Selection & Evolution' },
          { id: 'l5', name: 'Biology — Ecology & Ecosystems' },
        ],
      },
      {
        id: 'sci-chemistry', name: 'Chemistry',
        lessons: [
          { id: 'l1', name: 'Chemistry — Atomic Structure' },
          { id: 'l2', name: 'Chemistry — Bonding & Structure' },
          { id: 'l3', name: 'Chemistry — Chemical Reactions' },
          { id: 'l4', name: 'Chemistry — The Periodic Table' },
          { id: 'l5', name: 'Chemistry — Quantitative Chemistry' },
        ],
      },
      {
        id: 'sci-physics', name: 'Physics',
        lessons: [
          { id: 'l1', name: 'Physics — Forces & Motion' },
          { id: 'l2', name: 'Physics — Energy' },
          { id: 'l3', name: 'Physics — Waves & Electromagnetic Spectrum' },
          { id: 'l4', name: 'Physics — Electricity' },
          { id: 'l5', name: 'Physics — Magnetism' },
        ],
      },
    ],
  },

  // ── History KS3 ────────────────────────────────────────────────────────────
  {
    subject: 'History', examBoard: 'Edexcel', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'hi-ks3-normans', name: 'The Norman Conquest',
        lessons: [
          { id: 'l1', name: 'Norman Conquest — The Battle of Hastings 1066' },
          { id: 'l2', name: 'Norman Conquest — Why William Won' },
          { id: 'l3', name: 'Norman Conquest — The Feudal System' },
          { id: 'l4', name: 'Norman Conquest — Norman Control: Castles & the Church' },
        ],
      },
      {
        id: 'hi-ks3-medieval', name: 'Medieval England',
        lessons: [
          { id: 'l1', name: 'Medieval England — King John & Magna Carta' },
          { id: 'l2', name: 'Medieval England — The Black Death' },
          { id: 'l3', name: 'Medieval England — The Peasants\' Revolt 1381' },
          { id: 'l4', name: 'Medieval England — The Wars of the Roses' },
        ],
      },
      {
        id: 'hi-ks3-tudors', name: 'Tudor England',
        lessons: [
          { id: 'l1', name: 'Tudors — Henry VIII & the Break with Rome' },
          { id: 'l2', name: 'Tudors — The English Reformation' },
          { id: 'l3', name: 'Tudors — Elizabeth I & the Armada' },
          { id: 'l4', name: 'Tudors — The Elizabethan Religious Settlement' },
        ],
      },
      {
        id: 'hi-ks3-british-empire', name: 'Empire & Industry',
        lessons: [
          { id: 'l1', name: 'Empire — The Slave Trade' },
          { id: 'l2', name: 'Empire — The Industrial Revolution' },
          { id: 'l3', name: 'Empire — British India & Colonialism' },
          { id: 'l4', name: 'Empire — Abolition of Slavery' },
        ],
      },
    ],
  },

  // ── History GCSE ───────────────────────────────────────────────────────────
  {
    subject: 'History', examBoard: 'Edexcel', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'hi-gcse-weimar', name: 'Weimar & Nazi Germany 1918–1939',
        lessons: [
          { id: 'l1', name: 'Weimar Republic — Origins & the Stab in the Back Myth' },
          { id: 'l2', name: 'Weimar Republic — Crises of 1923: Hyperinflation & Munich Putsch' },
          { id: 'l3', name: 'Weimar Republic — The Golden Years 1924–1929' },
          { id: 'l4', name: 'Rise of Hitler — How the Nazis Rose to Power' },
          { id: 'l5', name: 'Nazi Germany — Terror, Propaganda & Control' },
          { id: 'l6', name: 'Nazi Germany — Life in Nazi Germany: Youth & Women' },
          { id: 'l7', name: 'Nazi Germany — Persecution of Jews 1933–1939' },
        ],
      },
      {
        id: 'hi-gcse-cold-war', name: 'Cold War 1945–1991',
        lessons: [
          { id: 'l1', name: 'Cold War — Origins: Yalta, Potsdam & the Iron Curtain' },
          { id: 'l2', name: 'Cold War — The Truman Doctrine & Marshall Plan' },
          { id: 'l3', name: 'Cold War — Berlin Blockade & Airlift' },
          { id: 'l4', name: 'Cold War — Korea & the Korean War' },
          { id: 'l5', name: 'Cold War — Cuban Missile Crisis 1962' },
          { id: 'l6', name: 'Cold War — Détente & the End of the Cold War' },
        ],
      },
      {
        id: 'hi-gcse-medicine', name: 'Medicine Through Time',
        lessons: [
          { id: 'l1', name: 'Medicine — Medieval Medicine: Galen & the Church' },
          { id: 'l2', name: 'Medicine — Renaissance: Vesalius & Harvey' },
          { id: 'l3', name: 'Medicine — Industrial Britain: Germ Theory & Pasteur' },
          { id: 'l4', name: 'Medicine — Modern Medicine: Antibiotics & the NHS' },
          { id: 'l5', name: 'Medicine — Surgery & Anaesthetics: Simpson & Lister' },
        ],
      },
    ],
  },

  // ── Geography KS3 ──────────────────────────────────────────────────────────
  {
    subject: 'Geography', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'ge-ks3-weather', name: 'Weather & Climate',
        lessons: [
          { id: 'l1', name: 'Weather — UK Weather Systems & Air Masses' },
          { id: 'l2', name: 'Weather — Tropical Storms: Causes & Effects' },
          { id: 'l3', name: 'Weather — Climate Zones of the World' },
          { id: 'l4', name: 'Weather — Climate Change: Evidence & Causes' },
        ],
      },
      {
        id: 'ge-ks3-coasts', name: 'Coasts',
        lessons: [
          { id: 'l1', name: 'Coasts — Erosion: Processes & Landforms' },
          { id: 'l2', name: 'Coasts — Deposition: Beaches & Spits' },
          { id: 'l3', name: 'Coasts — Coastal Management: Hard & Soft Engineering' },
          { id: 'l4', name: 'Coasts — Case Study: Holderness Coastline' },
        ],
      },
      {
        id: 'ge-ks3-rivers', name: 'Rivers',
        lessons: [
          { id: 'l1', name: 'Rivers — The Water Cycle' },
          { id: 'l2', name: 'Rivers — River Processes & Landforms' },
          { id: 'l3', name: 'Rivers — Flooding: Causes & Effects' },
          { id: 'l4', name: 'Rivers — Flood Management Strategies' },
        ],
      },
      {
        id: 'ge-ks3-population', name: 'Population & Urbanisation',
        lessons: [
          { id: 'l1', name: 'Population — Global Population Growth & Distribution' },
          { id: 'l2', name: 'Population — Migration: Push & Pull Factors' },
          { id: 'l3', name: 'Population — Urbanisation in LEDCs & MEDCs' },
          { id: 'l4', name: 'Population — Megacities: Case Study' },
        ],
      },
    ],
  },

  // ── Geography GCSE ─────────────────────────────────────────────────────────
  {
    subject: 'Geography', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'ge-gcse-living-world', name: 'The Living World',
        lessons: [
          { id: 'l1', name: 'Living World — Ecosystems: Structure & Balance' },
          { id: 'l2', name: 'Living World — Tropical Rainforests: Characteristics' },
          { id: 'l3', name: 'Living World — Deforestation: Causes & Effects' },
          { id: 'l4', name: 'Living World — Hot Deserts: Opportunities & Challenges' },
        ],
      },
      {
        id: 'ge-gcse-urban', name: 'Urban Issues & Challenges',
        lessons: [
          { id: 'l1', name: 'Urban Issues — Global Urbanisation Trends' },
          { id: 'l2', name: 'Urban Issues — Rio de Janeiro: A Growing City' },
          { id: 'l3', name: 'Urban Issues — UK Cities: Bristol Case Study' },
          { id: 'l4', name: 'Urban Issues — Sustainable Urban Development' },
        ],
      },
      {
        id: 'ge-gcse-hazards', name: 'The Challenge of Natural Hazards',
        lessons: [
          { id: 'l1', name: 'Hazards — Tectonic Plates: Earthquakes & Volcanoes' },
          { id: 'l2', name: 'Hazards — Tropical Storms: Formation & Impacts' },
          { id: 'l3', name: 'Hazards — Climate Change: Evidence & Management' },
          { id: 'l4', name: 'Hazards — Managing Tectonic Hazards' },
        ],
      },
    ],
  },

  // ── French KS3 ─────────────────────────────────────────────────────────────
  {
    subject: 'French', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'fr-ks3-moi', name: 'Moi et ma famille',
        lessons: [
          { id: 'l1', name: 'Moi — Greetings, Alphabet & Numbers' },
          { id: 'l2', name: 'Moi — Describing Yourself: Personality & Appearance' },
          { id: 'l3', name: 'Moi — Family Members & Relationships' },
          { id: 'l4', name: 'Moi — Pets & Physical Descriptions' },
        ],
      },
      {
        id: 'fr-ks3-ecole', name: 'L\'école',
        lessons: [
          { id: 'l1', name: 'L\'école — School Subjects: Opinions & Reasons' },
          { id: 'l2', name: 'L\'école — The School Day & Timetable' },
          { id: 'l3', name: 'L\'école — School Rules & Facilities' },
          { id: 'l4', name: 'L\'école — Comparing Schools in France & the UK' },
        ],
      },
      {
        id: 'fr-ks3-loisirs', name: 'Les loisirs',
        lessons: [
          { id: 'l1', name: 'Loisirs — Sports & Hobbies: Likes & Dislikes' },
          { id: 'l2', name: 'Loisirs — Free Time Activities' },
          { id: 'l3', name: 'Loisirs — Music, Films & Technology' },
          { id: 'l4', name: 'Loisirs — Going Out: Making Plans' },
        ],
      },
    ],
  },

  // ── French GCSE ────────────────────────────────────────────────────────────
  {
    subject: 'French', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'fr-gcse-identity', name: 'Identity & Culture',
        lessons: [
          { id: 'l1', name: 'Identity — Me, My Family & Friends' },
          { id: 'l2', name: 'Identity — Relationships & Marriage' },
          { id: 'l3', name: 'Identity — Social Media & Technology' },
          { id: 'l4', name: 'Identity — Free Time: Sport & Music' },
        ],
      },
      {
        id: 'fr-gcse-travel', name: 'Travel & Tourism',
        lessons: [
          { id: 'l1', name: 'Travel — Holidays: Planning & Booking' },
          { id: 'l2', name: 'Travel — Accommodation & Transport' },
          { id: 'l3', name: 'Travel — Describing a Holiday Experience' },
          { id: 'l4', name: 'Travel — France: Regions & Tourist Attractions' },
        ],
      },
      {
        id: 'fr-gcse-environment', name: 'Global Issues',
        lessons: [
          { id: 'l1', name: 'Environment — Environmental Problems & Solutions' },
          { id: 'l2', name: 'Environment — Poverty & Charity Work' },
          { id: 'l3', name: 'Environment — Jobs & Future Plans' },
          { id: 'l4', name: 'Environment — Exam Writing: Extended Tasks' },
        ],
      },
    ],
  },

  // ── Spanish KS3 ────────────────────────────────────────────────────────────
  {
    subject: 'Spanish', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'sp-ks3-yo', name: 'Yo y mi familia',
        lessons: [
          { id: 'l1', name: 'Yo — Greetings, Numbers & the Alphabet' },
          { id: 'l2', name: 'Yo — Describing Yourself & Your Family' },
          { id: 'l3', name: 'Yo — Physical & Personality Descriptions' },
          { id: 'l4', name: 'Yo — Pets & Home Life' },
        ],
      },
      {
        id: 'sp-ks3-colegio', name: 'El colegio',
        lessons: [
          { id: 'l1', name: 'El colegio — School Subjects: Opinions & Reasons' },
          { id: 'l2', name: 'El colegio — The School Day & Timetable' },
          { id: 'l3', name: 'El colegio — Uniforms & School Rules' },
          { id: 'l4', name: 'El colegio — Comparing Schools in Spain & the UK' },
        ],
      },
      {
        id: 'sp-ks3-tiempo-libre', name: 'El tiempo libre',
        lessons: [
          { id: 'l1', name: 'Tiempo libre — Sports & Hobbies' },
          { id: 'l2', name: 'Tiempo libre — Music, Films & TV' },
          { id: 'l3', name: 'Tiempo libre — Going Out & Making Plans' },
          { id: 'l4', name: 'Tiempo libre — Festivals in Spain & Latin America' },
        ],
      },
    ],
  },

  // ── Spanish GCSE ───────────────────────────────────────────────────────────
  {
    subject: 'Spanish', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'sp-gcse-identity', name: 'Identity & Culture',
        lessons: [
          { id: 'l1', name: 'Identity — Me, My Family & Relationships' },
          { id: 'l2', name: 'Identity — Social Media & Technology' },
          { id: 'l3', name: 'Identity — Free Time: Sports & Music' },
          { id: 'l4', name: 'Identity — Festivals & Traditions' },
        ],
      },
      {
        id: 'sp-gcse-travel', name: 'Travel & Tourism',
        lessons: [
          { id: 'l1', name: 'Travel — Holidays & Accommodation' },
          { id: 'l2', name: 'Travel — Transport & Directions' },
          { id: 'l3', name: 'Travel — Describing Places in Spain & Latin America' },
          { id: 'l4', name: 'Travel — Complaints & Problems Abroad' },
        ],
      },
      {
        id: 'sp-gcse-future', name: 'Future Plans & Global Issues',
        lessons: [
          { id: 'l1', name: 'Future — Work Experience & Jobs' },
          { id: 'l2', name: 'Future — The Environment & Sustainability' },
          { id: 'l3', name: 'Future — Poverty, Charity & Volunteering' },
          { id: 'l4', name: 'Future — Exam Practice: Speaking & Writing' },
        ],
      },
    ],
  },

  // ── Art KS3 ────────────────────────────────────────────────────────────────
  {
    subject: 'Art', examBoard: '', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'ar-ks3-drawing', name: 'Drawing & Observational Skills',
        lessons: [
          { id: 'l1', name: 'Drawing — Line, Tone & Form: Observational Drawing' },
          { id: 'l2', name: 'Drawing — Shading Techniques: Hatching & Blending' },
          { id: 'l3', name: 'Drawing — Perspective: One-Point & Two-Point' },
          { id: 'l4', name: 'Drawing — Portraiture & the Human Face' },
        ],
      },
      {
        id: 'ar-ks3-colour', name: 'Colour & Painting',
        lessons: [
          { id: 'l1', name: 'Colour — Colour Theory: Primary, Secondary & Tertiary' },
          { id: 'l2', name: 'Colour — Painting Techniques: Watercolour & Acrylic' },
          { id: 'l3', name: 'Colour — Colour in the Work of a Named Artist' },
          { id: 'l4', name: 'Colour — Still Life Painting Project' },
        ],
      },
      {
        id: 'ar-ks3-mixed', name: 'Mixed Media & Printmaking',
        lessons: [
          { id: 'l1', name: 'Mixed Media — Collage & Texture Techniques' },
          { id: 'l2', name: 'Printmaking — Relief Printing: Lino & Monoprint' },
          { id: 'l3', name: 'Printmaking — Developing a Print from a Design' },
          { id: 'l4', name: 'Mixed Media — Artist Study: Combining Techniques' },
        ],
      },
    ],
  },

  // ── Art GCSE ───────────────────────────────────────────────────────────────
  {
    subject: 'Art', examBoard: '', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'ar-gcse-portfolio', name: 'Portfolio & Sketchbook Development',
        lessons: [
          { id: 'l1', name: 'Portfolio — Developing a Personal Theme' },
          { id: 'l2', name: 'Portfolio — Research & Artist Influence' },
          { id: 'l3', name: 'Portfolio — Experimenting with Media & Techniques' },
          { id: 'l4', name: 'Portfolio — Refining & Selecting Work for Assessment' },
        ],
      },
      {
        id: 'ar-gcse-fine-art', name: 'Fine Art',
        lessons: [
          { id: 'l1', name: 'Fine Art — Observational Drawing & Painting' },
          { id: 'l2', name: 'Fine Art — Abstract Art: Techniques & Artists' },
          { id: 'l3', name: 'Fine Art — Mixed Media & Experimental Work' },
          { id: 'l4', name: 'Fine Art — Exam Preparation: 10-Hour Timed Task' },
        ],
      },
    ],
  },

  // ── Music KS3 ──────────────────────────────────────────────────────────────
  {
    subject: 'Music', examBoard: 'Edexcel', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'mu-ks3-theory', name: 'Music Theory & Notation',
        lessons: [
          { id: 'l1', name: 'Theory — Reading & Writing Musical Notation' },
          { id: 'l2', name: 'Theory — Rhythm, Metre & Time Signatures' },
          { id: 'l3', name: 'Theory — Pitch, Scales & Key Signatures' },
          { id: 'l4', name: 'Theory — Chords & Harmony' },
        ],
      },
      {
        id: 'mu-ks3-performance', name: 'Performance',
        lessons: [
          { id: 'l1', name: 'Performance — Keyboard Skills: Playing Chords' },
          { id: 'l2', name: 'Performance — Ensemble Playing & Listening Skills' },
          { id: 'l3', name: 'Performance — Developing Accuracy & Expression' },
          { id: 'l4', name: 'Performance — Solo Performance Assessment' },
        ],
      },
      {
        id: 'mu-ks3-world', name: 'World Music & Styles',
        lessons: [
          { id: 'l1', name: 'World Music — African Drumming: Rhythm & Polyrhythm' },
          { id: 'l2', name: 'World Music — Blues & Jazz: 12-Bar Blues' },
          { id: 'l3', name: 'World Music — Indian Classical Music: Raga & Tala' },
          { id: 'l4', name: 'World Music — Samba & Latin Rhythms' },
        ],
      },
    ],
  },

  // ── Music GCSE ─────────────────────────────────────────────────────────────
  {
    subject: 'Music', examBoard: 'Edexcel', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'mu-gcse-performance', name: 'Performance',
        lessons: [
          { id: 'l1', name: 'Performance — Solo Performance: Technical Accuracy' },
          { id: 'l2', name: 'Performance — Ensemble Performance: Listening & Balance' },
          { id: 'l3', name: 'Performance — Expressive & Interpretive Qualities' },
          { id: 'l4', name: 'Performance — Assessment Preparation & Annotation' },
        ],
      },
      {
        id: 'mu-gcse-composition', name: 'Composition',
        lessons: [
          { id: 'l1', name: 'Composition — Composing to a Brief: Structuring Ideas' },
          { id: 'l2', name: 'Composition — Harmony & Melody Writing' },
          { id: 'l3', name: 'Composition — Using Technology: Sibelius / GarageBand' },
          { id: 'l4', name: 'Composition — Notation, Score & Annotation' },
        ],
      },
      {
        id: 'mu-gcse-set-works', name: 'Set Works & Listening',
        lessons: [
          { id: 'l1', name: 'Set Works — Beethoven: Piano Sonata "Pathétique"' },
          { id: 'l2', name: 'Set Works — Queen: Killer Queen' },
          { id: 'l3', name: 'Set Works — Miles Davis: All Blues' },
          { id: 'l4', name: 'Set Works — Listening Exam Technique' },
        ],
      },
    ],
  },

  // ── PE KS3 ─────────────────────────────────────────────────────────────────
  {
    subject: 'PE', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'pe-ks3-games', name: 'Team Games',
        lessons: [
          { id: 'l1', name: 'Games — Football: Passing, Dribbling & Shooting' },
          { id: 'l2', name: 'Games — Basketball: Dribbling, Lay-ups & Tactics' },
          { id: 'l3', name: 'Games — Netball: Passing Techniques & Positioning' },
          { id: 'l4', name: 'Games — Tactics, Rules & Officiating' },
        ],
      },
      {
        id: 'pe-ks3-athletics', name: 'Athletics',
        lessons: [
          { id: 'l1', name: 'Athletics — Sprint Technique: Drive Phase & Running Form' },
          { id: 'l2', name: 'Athletics — Long Jump: Approach, Take-Off & Landing' },
          { id: 'l3', name: 'Athletics — Shot Put & Throwing Events' },
          { id: 'l4', name: 'Athletics — Relay Baton Exchange Technique' },
        ],
      },
      {
        id: 'pe-ks3-fitness', name: 'Health-Related Fitness',
        lessons: [
          { id: 'l1', name: 'Fitness — Components of Fitness: Strength, Speed & Stamina' },
          { id: 'l2', name: 'Fitness — Circuit Training: Designing a Programme' },
          { id: 'l3', name: 'Fitness — Warm-Up & Cool-Down: Why & How' },
          { id: 'l4', name: 'Fitness — FITT Principles & Training Plans' },
        ],
      },
    ],
  },

  // ── PE GCSE ────────────────────────────────────────────────────────────────
  {
    subject: 'PE', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'pe-gcse-anatomy', name: 'Applied Anatomy & Physiology',
        lessons: [
          { id: 'l1', name: 'Anatomy — The Skeletal System: Bones & Joints' },
          { id: 'l2', name: 'Anatomy — The Muscular System: Major Muscle Groups' },
          { id: 'l3', name: 'Anatomy — The Cardiovascular System' },
          { id: 'l4', name: 'Anatomy — The Respiratory System & Gas Exchange' },
          { id: 'l5', name: 'Anatomy — Effects of Exercise on Body Systems' },
        ],
      },
      {
        id: 'pe-gcse-skill', name: 'Skill Acquisition',
        lessons: [
          { id: 'l1', name: 'Skill — Types of Skill: Open, Closed, Fine & Gross' },
          { id: 'l2', name: 'Skill — Stages of Learning: Cognitive to Autonomous' },
          { id: 'l3', name: 'Skill — Methods of Practice & Feedback' },
          { id: 'l4', name: 'Skill — Guidance & Transfer of Learning' },
        ],
      },
      {
        id: 'pe-gcse-health', name: 'Health, Fitness & Training',
        lessons: [
          { id: 'l1', name: 'Health — Physical, Mental & Social Health' },
          { id: 'l2', name: 'Health — Components of Fitness & Testing' },
          { id: 'l3', name: 'Training — Principles of Training: FITT & SPORT' },
          { id: 'l4', name: 'Training — Training Methods: Interval, Circuit & Resistance' },
        ],
      },
    ],
  },

  // ── Drama KS3 ──────────────────────────────────────────────────────────────
  {
    subject: 'Drama', examBoard: 'AQA', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'dr-ks3-skills', name: 'Performance Skills',
        lessons: [
          { id: 'l1', name: 'Performance — Voice: Pitch, Pace & Projection' },
          { id: 'l2', name: 'Performance — Movement, Gesture & Proxemics' },
          { id: 'l3', name: 'Performance — Facial Expression & Character' },
          { id: 'l4', name: 'Performance — Status & Physicality' },
        ],
      },
      {
        id: 'dr-ks3-improv', name: 'Improvisation',
        lessons: [
          { id: 'l1', name: 'Improvisation — Still Image & Freeze Frames' },
          { id: 'l2', name: 'Improvisation — Hot Seating & Role Play' },
          { id: 'l3', name: 'Improvisation — Thought Tracking & Conscience Alley' },
          { id: 'l4', name: 'Improvisation — Forum Theatre & Intervention' },
        ],
      },
      {
        id: 'dr-ks3-script', name: 'Scripted Performance',
        lessons: [
          { id: 'l1', name: 'Script — Reading a Play Text: Understanding Stage Directions' },
          { id: 'l2', name: 'Script — Character Analysis & Motivation' },
          { id: 'l3', name: 'Script — Rehearsal Techniques & Blocking' },
          { id: 'l4', name: 'Script — Performance Assessment & Evaluation' },
        ],
      },
    ],
  },

  // ── Drama GCSE ─────────────────────────────────────────────────────────────
  {
    subject: 'Drama', examBoard: 'AQA', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'dr-gcse-devising', name: 'Devised Theatre (Component 1)',
        lessons: [
          { id: 'l1', name: 'Devising — Responding to a Stimulus: Generating Ideas' },
          { id: 'l2', name: 'Devising — Developing Structure & Narrative' },
          { id: 'l3', name: 'Devising — Rehearsal & Refinement' },
          { id: 'l4', name: 'Devising — Evaluating the Devising Process' },
        ],
      },
      {
        id: 'dr-gcse-text', name: 'Text in Performance (Component 2)',
        lessons: [
          { id: 'l1', name: 'Text — Studying a Play: DNA by Dennis Kelly' },
          { id: 'l2', name: 'Text — Character Interpretation & Directorial Vision' },
          { id: 'l3', name: 'Text — Design Elements: Set, Costume & Lighting' },
          { id: 'l4', name: 'Text — Performance & Self-Evaluation' },
        ],
      },
      {
        id: 'dr-gcse-written', name: 'Theatre Makers in Practice (Component 3)',
        lessons: [
          { id: 'l1', name: 'Theatre Makers — Practitioners: Stanislavski & Brecht' },
          { id: 'l2', name: 'Theatre Makers — Live Theatre Review Technique' },
          { id: 'l3', name: 'Theatre Makers — Set Text Study: Exam Question Practice' },
          { id: 'l4', name: 'Theatre Makers — Written Exam Preparation' },
        ],
      },
    ],
  },

  // ── Computing KS3 ──────────────────────────────────────────────────────────
  {
    subject: 'Computing', examBoard: 'OCR', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'cp-ks3-programming', name: 'Programming with Python',
        lessons: [
          { id: 'l1', name: 'Python — Variables, Input & Output' },
          { id: 'l2', name: 'Python — Selection: if / elif / else' },
          { id: 'l3', name: 'Python — Iteration: for & while Loops' },
          { id: 'l4', name: 'Python — Functions & Modular Programming' },
          { id: 'l5', name: 'Python — Lists & String Manipulation' },
        ],
      },
      {
        id: 'cp-ks3-networks', name: 'Networks & the Internet',
        lessons: [
          { id: 'l1', name: 'Networks — Types of Network: LAN, WAN & the Internet' },
          { id: 'l2', name: 'Networks — How the Internet Works: IP, DNS & HTTP' },
          { id: 'l3', name: 'Networks — Network Topologies & Hardware' },
          { id: 'l4', name: 'Networks — Cybersecurity: Threats & Protection' },
        ],
      },
      {
        id: 'cp-ks3-data', name: 'Data & Representation',
        lessons: [
          { id: 'l1', name: 'Data — Binary Numbers: Converting & Arithmetic' },
          { id: 'l2', name: 'Data — Representing Text, Images & Sound' },
          { id: 'l3', name: 'Data — Spreadsheets & Databases' },
          { id: 'l4', name: 'Data — Data Collection & Privacy' },
        ],
      },
    ],
  },

  // ── Computing GCSE ─────────────────────────────────────────────────────────
  {
    subject: 'Computing', examBoard: 'OCR', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'cp-gcse-algorithms', name: 'Algorithms & Computational Thinking',
        lessons: [
          { id: 'l1', name: 'Algorithms — Decomposition & Abstraction' },
          { id: 'l2', name: 'Algorithms — Flowcharts & Pseudocode' },
          { id: 'l3', name: 'Algorithms — Searching: Linear & Binary Search' },
          { id: 'l4', name: 'Algorithms — Sorting: Bubble, Merge & Insertion Sort' },
        ],
      },
      {
        id: 'cp-gcse-programming', name: 'Programming (Python)',
        lessons: [
          { id: 'l1', name: 'Programming — Data Structures: Arrays & 2D Arrays' },
          { id: 'l2', name: 'Programming — File Handling: Read & Write' },
          { id: 'l3', name: 'Programming — Object-Oriented Programming: Classes' },
          { id: 'l4', name: 'Programming — Exam Task Practice: Controlled Assessment' },
        ],
      },
      {
        id: 'cp-gcse-systems', name: 'Computer Systems',
        lessons: [
          { id: 'l1', name: 'Systems — CPU Architecture: Fetch-Decode-Execute Cycle' },
          { id: 'l2', name: 'Systems — Primary & Secondary Storage' },
          { id: 'l3', name: 'Systems — Operating Systems & Utility Software' },
          { id: 'l4', name: 'Systems — Ethical, Legal & Environmental Issues' },
        ],
      },
    ],
  },

  // ── RE KS3 ─────────────────────────────────────────────────────────────────
  {
    subject: 'RE', examBoard: '', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 're-ks3-christianity', name: 'Christianity',
        lessons: [
          { id: 'l1', name: 'Christianity — The Nature of God: Trinity & Creation' },
          { id: 'l2', name: 'Christianity — Jesus: Life, Death & Resurrection' },
          { id: 'l3', name: 'Christianity — Christian Practices: Prayer & Worship' },
          { id: 'l4', name: 'Christianity — Christianity in the Modern World' },
        ],
      },
      {
        id: 're-ks3-islam', name: 'Islam',
        lessons: [
          { id: 'l1', name: 'Islam — The Nature of Allah & the Five Pillars' },
          { id: 'l2', name: 'Islam — The Prophet Muhammad & the Qur\'an' },
          { id: 'l3', name: 'Islam — Muslim Practices: Prayer, Fasting & Hajj' },
          { id: 'l4', name: 'Islam — Islam in the Modern World' },
        ],
      },
      {
        id: 're-ks3-ethics', name: 'Ethics & Big Questions',
        lessons: [
          { id: 'l1', name: 'Ethics — The Problem of Evil & Suffering' },
          { id: 'l2', name: 'Ethics — Life After Death: Religious Perspectives' },
          { id: 'l3', name: 'Ethics — War, Peace & Justice' },
          { id: 'l4', name: 'Ethics — Environmental Ethics & Stewardship' },
        ],
      },
    ],
  },

  // ── RE GCSE ────────────────────────────────────────────────────────────────
  {
    subject: 'RE', examBoard: '', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 're-gcse-christian-beliefs', name: 'Christian Beliefs',
        lessons: [
          { id: 'l1', name: 'Christian Beliefs — The Nature of God: Omnipotent & Benevolent' },
          { id: 'l2', name: 'Christian Beliefs — The Trinity: Father, Son & Holy Spirit' },
          { id: 'l3', name: 'Christian Beliefs — Creation & the Role of the Word' },
          { id: 'l4', name: 'Christian Beliefs — Salvation, Atonement & Afterlife' },
        ],
      },
      {
        id: 're-gcse-muslim-beliefs', name: 'Muslim Beliefs',
        lessons: [
          { id: 'l1', name: 'Muslim Beliefs — The Oneness of Allah: Tawhid' },
          { id: 'l2', name: 'Muslim Beliefs — Angels, Prophets & Holy Books' },
          { id: 'l3', name: 'Muslim Beliefs — Predestination & the Day of Judgement' },
          { id: 'l4', name: 'Muslim Beliefs — Sunni & Shi\'a Differences' },
        ],
      },
      {
        id: 're-gcse-ethics', name: 'Relationships, Crime & Punishment',
        lessons: [
          { id: 'l1', name: 'Relationships — Marriage, Divorce & Religious Teachings' },
          { id: 'l2', name: 'Relationships — Gender Equality in Religion' },
          { id: 'l3', name: 'Crime & Punishment — Justice, Punishment & Forgiveness' },
          { id: 'l4', name: 'Crime & Punishment — Capital Punishment: Religious Views' },
        ],
      },
    ],
  },

  // ── PSHE KS3 ───────────────────────────────────────────────────────────────
  {
    subject: 'PSHE', examBoard: '', yearGroups: [7, 8, 9], qualification: 'KS3',
    topics: [
      {
        id: 'ps-ks3-health', name: 'Health & Wellbeing',
        lessons: [
          { id: 'l1', name: 'Health — Physical & Mental Health: The Link' },
          { id: 'l2', name: 'Health — Managing Stress & Anxiety' },
          { id: 'l3', name: 'Health — Healthy Eating, Sleep & Exercise' },
          { id: 'l4', name: 'Health — Online Safety & Screen Time' },
        ],
      },
      {
        id: 'ps-ks3-relationships', name: 'Relationships & RSE',
        lessons: [
          { id: 'l1', name: 'Relationships — Healthy & Unhealthy Relationships' },
          { id: 'l2', name: 'Relationships — Consent & Boundaries' },
          { id: 'l3', name: 'Relationships — Peer Pressure & Assertiveness' },
          { id: 'l4', name: 'Relationships — Bullying, Including Cyberbullying' },
        ],
      },
      {
        id: 'ps-ks3-citizenship', name: 'Living in the Wider World',
        lessons: [
          { id: 'l1', name: 'Citizenship — Rights & Responsibilities' },
          { id: 'l2', name: 'Citizenship — Equality, Diversity & Discrimination' },
          { id: 'l3', name: 'Citizenship — British Values & Democracy' },
          { id: 'l4', name: 'Citizenship — Money Management & Enterprise' },
        ],
      },
    ],
  },

  // ── PSHE Y10-11 ────────────────────────────────────────────────────────────
  {
    subject: 'PSHE', examBoard: '', yearGroups: [10, 11], qualification: 'GCSE',
    topics: [
      {
        id: 'ps-gcse-health', name: 'Health & Wellbeing',
        lessons: [
          { id: 'l1', name: 'Health — Mental Health: Conditions & Support' },
          { id: 'l2', name: 'Health — Substance Misuse: Risks & Consequences' },
          { id: 'l3', name: 'Health — First Aid & Emergency Situations' },
          { id: 'l4', name: 'Health — Physical Health Checks & NHS Services' },
        ],
      },
      {
        id: 'ps-gcse-rse', name: 'Relationships & Sex Education',
        lessons: [
          { id: 'l1', name: 'RSE — Healthy Relationships & Consent' },
          { id: 'l2', name: 'RSE — Contraception & Sexual Health' },
          { id: 'l3', name: 'RSE — Online Relationships & Sexting' },
          { id: 'l4', name: 'RSE — Domestic Abuse: Signs & Support' },
        ],
      },
      {
        id: 'ps-gcse-careers', name: 'Economic Wellbeing & Careers',
        lessons: [
          { id: 'l1', name: 'Careers — Exploring Pathways: A-Levels, Apprenticeships & Work' },
          { id: 'l2', name: 'Careers — Writing a CV & Personal Statement' },
          { id: 'l3', name: 'Careers — Interview Skills & Work Experience' },
          { id: 'l4', name: 'Careers — Budgeting, Tax & Financial Planning' },
        ],
      },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

const EXAM_BOARDS: Record<string, string> = {
  English: 'AQA',
  Maths:   'Edexcel',
  Science: 'AQA',
  History: 'Edexcel',
  Geography: 'AQA',
  French:  'AQA',
  Spanish: 'AQA',
  Art:     '',
  Music:   'Edexcel',
  PE:      'AQA',
  Drama:   'AQA',
  Computing: 'OCR',
  RE:      '',
  PSHE:    '',
}

export function getExamBoard(subject: string): string {
  return EXAM_BOARDS[subject] ?? ''
}

export function getQualification(yearGroup: number): string {
  if (yearGroup <= 9)  return 'KS3'
  if (yearGroup <= 11) return 'GCSE'
  return 'A-Level'
}

export function getSubjectData(subject: string, yearGroup: number): SubjectData | null {
  return (
    CURRICULUM.find(
      c => c.subject === subject && c.yearGroups.includes(yearGroup)
    ) ?? null
  )
}
