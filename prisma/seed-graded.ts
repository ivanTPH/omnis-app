/**
 * Seed: graded homework submissions for demo marking verification.
 * Targets demo-hw-macbeth-1 (Macbeth — Ambition Essay Plan, 10E/En2).
 *
 * Creates 8 RETURNED submissions at a spread of GCSE grades (4–9),
 * each with realistic student answers and teacher feedback.
 *
 * Run with: npm run grade:seed
 * Safe to re-run (upserts throughout).
 */

import { PrismaClient, SubmissionStatus } from '@prisma/client'

const prisma = new PrismaClient()

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10, 0, 0, 0)
  return d
}

// ── Macbeth Q&A content per student (4 questions, graded 0–9) ────────────────
// Questions:
//  Q1 "Stars, hide your fires" — what does this reveal about ambition? [3 marks]
//  Q2 How does Lady Macbeth influence Macbeth's ambition in Act 1 Sc 7? [3 marks]
//  Q3 Why would a Jacobean audience find Macbeth's ambition shocking?   [2 marks]
//  Q4 Write a topic sentence for PEE on ambition as destructive.        [3 marks]

const SUBMISSIONS: {
  email: string
  grade: number
  feedback: string
  answers: string[]  // one entry per question
}[] = [
  // ── Grade 9 — Sustained, confident, terminology-rich ──────────────────────
  {
    email: 'h.griffiths@students.omnisdemo.school',
    grade: 9,
    feedback: "Outstanding analytical work, Hannah. Your close reading of 'Stars, hide your fires' is exactly the standard expected at Grade 9 — you've unpacked the imagery, linked it to Macbeth's psychological state and integrated the Jacobean context seamlessly. Your PEE topic sentence is a model of how to embed technique and effect. To push even further: explore the verb 'hide' as an imperative and what it implies about Macbeth's relationship with morality.",
    answers: [
      "Shakespeare's use of apostrophe in \"Stars, hide your fires\" creates a paradox at the heart of Macbeth's character. By commanding the stars — symbols of divine order in Jacobean cosmology — to suppress their light, Macbeth is simultaneously acknowledging the wrongness of his desires (they must be concealed) and actively seeking to perpetuate them. The word \"black\" carries connotations of evil and moral corruption, suggesting that ambition has already begun to warp Macbeth's conscience before a single treasonous act has been committed. Shakespeare thus presents ambition as a force that corrupts not just actions but the very moral faculties that would otherwise restrain them.",
      "In Act 1, Scene 7, Lady Macbeth exploits Macbeth's own conception of masculinity to override his moral hesitation. When she taunts \"Was the hope drunk / Wherein you dressed yourself?\", she frames his reluctance not as wisdom but as cowardice — a direct attack on his identity as a warrior. Her invocation to \"unsex me here\" earlier in the act establishes her as a figure who has already renounced the feminine virtues of compassion and mercy; she now attempts to transfer that renunciation to her husband. The use of conditional phrasing — \"When you durst do it, then you were a man\" — weaponises ambition by tying it to gender, making murder seem a prerequisite for manhood.",
      "For a Jacobean audience deeply shaped by the doctrine of the Divine Right of Kings, Macbeth's ambition would have been not merely immoral but cosmically transgressive. King James I, on the throne when the play was first performed in 1606, was himself a fervent believer in divine appointment; regicide was therefore an act of defiance against God's order, not merely a political crime. The disorder in the natural world that follows Duncan's murder — the \"darkness\" at noon and the horses eating each other — would have been read by a Jacobean audience as evidence of the chaos that inevitably follows when the cosmic hierarchy is disrupted by unchecked ambition.",
      "Through the imagery of hidden fires and the moral disintegration of Macbeth, Shakespeare presents ambition as an insidious and ultimately self-destructive force that corrodes both the individual conscience and the wider social order in which that individual operates.",
    ],
  },

  // ── Grade 8 — Strong analysis, some sophisticated terminology ─────────────
  {
    email: 'a.patel10@students.omnisdemo.school',
    grade: 8,
    feedback: "Excellent work, Anya. Your analysis of 'Stars, hide your fires' clearly identifies the semantic field of darkness and links it to moral corruption — that's sophisticated thinking. The Lady Macbeth paragraph makes strong use of quotation. To reach Grade 9: develop your contextual paragraph further — a sentence on James I's *Daemonologie* or the specific divine right doctrine would lift it considerably.",
    answers: [
      "In Act 1, Scene 4, Macbeth commands the stars to hide their light so they cannot witness his treacherous ambitions. Shakespeare uses a semantic field of darkness — \"fires\", \"black\", \"light\" — to show that Macbeth's desires are morally corrupt. The contrast between light and dark is significant: in Jacobean England, light was associated with God and goodness, so Macbeth's desire for darkness signals his willingness to move away from divine virtue. This reveals that his ambition is not just political but spiritually dangerous — he is aware that what he wants is wrong, yet presses forward regardless.",
      "Lady Macbeth uses emotional manipulation and attacks on Macbeth's sense of masculinity to intensify his ambition. Her rhetorical question \"Art thou afeard / To be the same in thine own act and valour / As thou art in desire?\" implies that his hesitation makes him a coward. She also questions whether he is a man: \"When you durst do it, then you were a man\". By linking bravery and manhood to the act of murder, she weaponises Macbeth's pride. Without this manipulation, Macbeth's own conscience — seen in the 'Is this a dagger' soliloquy and his decision to abandon the plan — might have prevailed.",
      "A Jacobean audience would have been shocked by Macbeth's ambition because killing a king was considered an attack on God himself. King James I, who was watching the first performance, believed in the Divine Right of Kings — the idea that monarchs are appointed by God. Therefore regicide was not just a crime but a sin. Shakespeare reinforces this by showing the natural world falling into disorder after Duncan's murder, reflecting the Jacobean belief that the cosmos mirrors moral order.",
      "Shakespeare presents ambition as a psychologically destructive force, demonstrated through Macbeth's use of darkness imagery to conceal desires that he himself recognises as morally corrupted, suggesting that unchecked ambition ultimately destroys the conscience that might otherwise prevent it.",
    ],
  },

  // ── Grade 7 — Secure analysis, good use of terminology ───────────────────
  {
    email: 'f.alamin@students.omnisdemo.school',
    grade: 7,
    feedback: "Good analytical work, Fatima. You've correctly identified the light/dark imagery and linked it to Macbeth's ambition, and your Lady Macbeth paragraph includes well-chosen quotations. To push toward Grade 8: try to say more about *why* Shakespeare makes these choices — consider the effect on the audience as well as on the characters. Your Jacobean context paragraph is accurate but could be more specific (e.g. reference to James I's attendance at the first performance).",
    answers: [
      "When Macbeth says \"Stars, hide your fires; / Let not light see my black and deep desires\", Shakespeare uses light and dark imagery to show that Macbeth's ambition is linked to evil. The stars represent goodness and God's order, but Macbeth wants them hidden so his dark thoughts cannot be seen. This shows that he knows what he is thinking is wrong — he wants to hide it even from the heavens. Shakespeare presents ambition as something Macbeth is ashamed of, but not ashamed enough to abandon.",
      "Lady Macbeth influences Macbeth's ambition by questioning his courage and masculinity. She says \"Was the hope drunk / Wherein you dressed yourself?\" which suggests his earlier confidence was like being drunk — not genuine. She also tells him \"When you durst do it, then you were a man\", meaning she will only see him as a true man if he goes through with the murder. These powerful psychological tactics override Macbeth's doubts and push his ambition forward when it might otherwise have faded.",
      "In Jacobean England, people believed that kings were chosen by God — this was called the Divine Right of Kings. This means that killing a king was seen as going against God's will. A Jacobean audience would have found Macbeth's ambition to be king deeply shocking because it threatened the entire divine order they believed in. The unnatural events that follow Duncan's murder — like horses eating each other — would have confirmed their belief that Macbeth's ambition had disrupted the natural and spiritual order.",
      "Shakespeare presents ambition as a force that forces Macbeth to suppress his own conscience, revealing through the imagery of hidden darkness that unchecked ambition is not just politically destructive but morally corrupting.",
    ],
  },

  // ── Grade 6 — Some analysis, limited terminology, decent engagement ────────
  {
    email: 'e.moody@students.omnisdemo.school',
    grade: 6,
    feedback: "There's some genuine engagement with the text here, Ethan. You've understood the basic meaning of the quotations and made some relevant points about ambition and corruption. To move into Grade 7, you need to use more specific subject terminology (e.g. 'apostrophe', 'semantic field', 'soliloquy') and make sure each point includes a clear quotation followed by a developed analysis of the language — not just what it means, but *how* Shakespeare achieves the effect.",
    answers: [
      "Macbeth is asking the stars to hide their light so that nobody can see what he is planning. He calls his desires \"black and deep\" which tells us they are evil and he knows they are wrong. Shakespeare is showing that Macbeth's ambition makes him want to hide from goodness and light. This is significant because it shows his ambition has a dark side — he is not just ambitious for good reasons, he wants to become king even if it means doing something terrible.",
      "Lady Macbeth makes Macbeth more ambitious by calling him a coward when he says he doesn't want to go through with the murder. She says things like \"Was the hope drunk\" to make him feel embarrassed about changing his mind. She also says he was only a man when he was willing to commit the murder. This works because Macbeth cares a lot about being seen as brave and powerful, so when she attacks that, he feels he has to prove himself. Her influence is really important because without her, Macbeth might not have gone through with killing Duncan.",
      "In Jacobean times, killing a king was thought to be one of the worst things you could do because kings were believed to be chosen by God. So if you killed the king, you were also going against God. This would have made a Jacobean audience very shocked by Macbeth's ambitions, because they would see his desire to be king as not just selfish but as a terrible sin. The fact that weird things start happening in nature after Duncan is killed would have seemed to them like proof that Macbeth had done something deeply wrong.",
      "Shakespeare presents ambition as a destructive force that causes Macbeth to hide his true desires from the world and ultimately leads him to commit terrible actions that destroy both himself and those around him.",
    ],
  },

  // ── Grade 5 — Basic analysis, limited development, mostly retells plot ─────
  {
    email: 'l.jensen@students.omnisdemo.school',
    grade: 5,
    feedback: "You've shown you understand what's happening in the play, Leo. Your answers retell the events accurately and you've included some quotations — that's a good start. To push toward Grade 6, you need to *analyse* the language choices rather than just explaining what happens. For example, instead of saying 'Macbeth says he wants to hide his desires', ask yourself: why does Shakespeare choose the word 'black'? What effect does asking the stars (not a person) to hide their light have on the audience? Push yourself to develop each point further.",
    answers: [
      "Macbeth says this when he finds out he might become king. He is saying that he wants the stars to hide their light so that nobody can see what he is thinking about. His desires are \"black\" which means they are evil. This shows that Macbeth has ambition to become king but he knows that what he might have to do is wrong. He is already thinking about the dark things he might need to do.",
      "Lady Macbeth makes Macbeth want to kill the king even more. When Macbeth says he won't do it, she is very angry and calls him a coward. She says things like \"when you durst do it, then you were a man\" which makes Macbeth feel like he has to prove himself. She is very persuasive and Macbeth listens to her. Without her pushing him, he probably wouldn't have gone ahead with the murder of King Duncan.",
      "In Jacobean times people believed kings were chosen by God, so trying to become king by killing the current king would have been very shocking. The audience would have thought Macbeth was doing something terrible and going against God. This helps explain why Shakespeare shows all the bad things that happen to Macbeth later in the play.",
      "Shakespeare shows ambition as destructive in Act 1 because Macbeth's ambition drives him to consider murdering the king even though he knows it is wrong, showing that ambition can make people do terrible things.",
    ],
  },

  // ── Grade 4 — Minimal analysis, mostly narrative, limited quotation use ───
  {
    email: 'c.ross@students.omnisdemo.school',
    grade: 4,
    feedback: "You've demonstrated a basic understanding of the story, Callum, and you've attempted to include quotations, which is good. However, at the moment your answers mostly re-tell what happens rather than analysing *how* Shakespeare presents ambition through language. For Grade 5 and above, every point needs to include: a specific quotation, a language term or technique if possible, and an explanation of the *effect* on the reader. Try re-writing your first answer with this structure: Point → Evidence → Explain the language effect.",
    answers: [
      "Macbeth says this in Act 1. He is saying that the stars should hide their light because he has dark desires. He wants to be king and he knows that the things he will need to do to get there are bad. So he wants to hide his thoughts. This shows that Macbeth is very ambitious because he is already thinking about these bad things early on in the play.",
      "Lady Macbeth influences Macbeth's ambition because she really wants him to become king. She tells him off when he says he won't kill Duncan. She calls him names and questions whether he is really a man. Macbeth is upset by this and decides to go ahead with the plan. Lady Macbeth is shown as the person who keeps his ambition alive when he starts to have doubts.",
      "A Jacobean audience would be shocked because in those times they believed the king was chosen by God. So wanting to kill the king was like going against God. Macbeth's ambition would have seemed very wrong to them for this reason.",
      "Shakespeare shows that ambition is destructive because Macbeth's desire to become king causes him to think about doing terrible things and eventually leads him to murder King Duncan.",
    ],
  },

  // ── Grade 6 (second example) — SEND student, good effort, some gaps ────────
  {
    email: 'r.brooks@students.omnisdemo.school',
    grade: 6,
    feedback: "Solid effort, Reuben. You've engaged seriously with all four questions and your analysis of Lady Macbeth's manipulation is your strongest section — the point about her weaponising gender expectations is perceptive. Keep developing that kind of thinking. Your context paragraph on Jacobean attitudes is accurate and relevant. To move higher: try to embed shorter quotations more smoothly into your sentences rather than quoting and then explaining separately.",
    answers: [
      "In \"Stars, hide your fires\", Macbeth is asking the stars to block out their light so that his dark ambitions remain hidden. The word \"black\" has connotations of evil and sin, suggesting that Macbeth knows his desires are morally wrong. This creates a sense of dramatic irony because the audience can see that Macbeth's ambition is already leading him toward dark thoughts, even as he appears loyal to Duncan. Shakespeare may be suggesting that ambition inherently involves some element of deception — both of others and of oneself.",
      "Lady Macbeth acts as the driving force behind Macbeth's ambition in Act 1 Scene 7. She uses emotional manipulation by attacking his masculinity, telling him he was only \"a man\" when he intended to go through with the plan. This is significant because it weaponises gender expectations — in Jacobean England, courage and action were central to what it meant to be male, so Lady Macbeth frames Macbeth's hesitation as an attack on his very identity. Her influence shows how ambition can spread between people and be intensified through social pressure.",
      "A Jacobean audience would have been horrified by Macbeth's ambition because of the widespread belief in the Divine Right of Kings. Monarchs were seen as God's appointed rulers, meaning any attempt to usurp the throne was an act of sacrilege. Shakespeare reinforces this through the supernatural disorder that follows Duncan's murder, signalling to the audience that the natural order has been broken. This would have been deeply alarming to contemporary viewers who would read these signs as divine punishment.",
      "Shakespeare presents ambition as a morally corrupting force, using Macbeth's command for darkness to conceal his desires to demonstrate that ambition drives individuals to suppress their own conscience in pursuit of power.",
    ],
  },

  // ── Grade 8 (second example) — confident, well-structured ────────────────
  {
    email: 'i.weir@students.omnisdemo.school',
    grade: 8,
    feedback: "Very strong work, Imogen. You've written with confidence and your analysis consistently moves from quotation to language technique to effect — exactly what the mark scheme rewards. Your Jacobean context is woven in naturally rather than tacked on as an afterthought. The topic sentence is concise and analytical. To reach the top band: push the Lady Macbeth paragraph to explore the structure of her speech — why does Shakespeare give her a persuasive rhetoric that echoes the witches? Is she a parallel figure?",
    answers: [
      "The apostrophe \"Stars, hide your fires\" positions Macbeth as someone who commands the natural world — a Faustian figure whose ambition has overreached mortal limits. By asking celestial bodies to conceal his intentions, Shakespeare implies that Macbeth's desires are visible even to the cosmos, and that only by suppressing divine order can he pursue them. The qualifier \"black and deep\" functions as a compound adjective of moral corruption: \"black\" signals evil, while \"deep\" implies that this corruption has penetrated to the core of his character. Together they suggest that Macbeth's ambition is not a recent development but a fundamental aspect of his identity that the events of the play are simply revealing.",
      "Lady Macbeth's influence operates through a systematic dismantling of Macbeth's moral framework. She exploits his warrior identity by linking murder to manhood: \"When you durst do it, then you were a man.\" The use of the past tense — \"durst\" — is pointed: it frames his previous willingness to act as the authentic Macbeth, while his current hesitation is positioned as a corruption of his true self. This inverts the moral logic: where Macbeth sees hesitation as conscience, Lady Macbeth reframes it as weakness. Shakespeare presents her as an embodiment of ambition stripped of scruple, showing how ambition unchecked by morality can become a tool of persuasion and control.",
      "The Divine Right of Kings was not merely a political theory in Jacobean England — it was theological doctrine. King James I's *Basilikon Doron* articulated the king's sacred status, meaning regicide carried implications of damnation for the murderer. A Jacobean audience watching Macbeth in 1606 would have understood that Macbeth's ambition was not simply immoral but cosmically transgressive. The supernatural unravelling that follows Duncan's murder — framed through Ross and the Old Man's dialogue — confirms that the natural order, which mirrors the divine, has been violated.",
      "Shakespeare presents ambition as a force that cannot be contained within the individual conscience, instead corrupting the social and divine order, as shown through Macbeth's impulse to command nature into complicity with his darkest desires.",
    ],
  },
]

async function main() {
  console.log('\nSeeding graded Macbeth submissions...\n')

  const hw = await prisma.homework.findUnique({ where: { id: 'demo-hw-macbeth-1' } })
  if (!hw) throw new Error('demo-hw-macbeth-1 not found — run npm run db:seed first')

  let created = 0, skipped = 0

  for (const s of SUBMISSIONS) {
    const student = await prisma.user.findUnique({ where: { email: s.email }, select: { id: true, schoolId: true } })
    if (!student) {
      console.log(`  SKIP ${s.email} — not found (run npm run db:seed-english first)`)
      skipped++
      continue
    }

    const combined = s.answers.map((a, i) => `Q${i + 1}: ${a}`).join('\n\n')

    await prisma.submission.upsert({
      where: { homeworkId_studentId: { homeworkId: hw.id, studentId: student.id } },
      update: {
        content:      combined,
        status:       SubmissionStatus.RETURNED,
        submittedAt:  daysAgo(6),
        markedAt:     daysAgo(4),
        teacherScore: s.grade,
        finalScore:   s.grade,
        grade:        String(s.grade),
        feedback:     s.feedback,
        integrityReviewed: true,
      },
      create: {
        schoolId:     student.schoolId,
        homeworkId:   hw.id,
        studentId:    student.id,
        content:      combined,
        status:       SubmissionStatus.RETURNED,
        submittedAt:  daysAgo(6),
        markedAt:     daysAgo(4),
        teacherScore: s.grade,
        finalScore:   s.grade,
        grade:        String(s.grade),
        feedback:     s.feedback,
        integrityReviewed: true,
      },
    })

    console.log(`  ✓ ${s.email.split('@')[0].padEnd(20)} Grade ${s.grade}`)
    created++
  }

  console.log(`\nDone — ${created} upserted, ${skipped} skipped.\n`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
