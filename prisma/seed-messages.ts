import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding message threads...')

  // Find users from both schools
  const teacher = await prisma.user.findFirst({
    where: { role: 'TEACHER', email: { contains: 'omnisdemo' } },
  })
  const senco = await prisma.user.findFirst({
    where: { role: 'SENCO', email: { contains: 'omnisdemo' } },
  })
  const parent = await prisma.user.findFirst({
    where: { role: 'PARENT' },
  })
  const student = await prisma.user.findFirst({
    where: { role: 'STUDENT', email: { contains: 'omnisdemo' } },
  })
  const slt = await prisma.user.findFirst({
    where: { role: 'SLT' },
  })

  if (!teacher || !senco) {
    console.log('Required users not found — run npm run db:seed first')
    return
  }

  const schoolId = teacher.schoolId

  // Thread 1: Teacher → Parent (homework concern)
  if (parent) {
    await prisma.msgThread.create({
      data: {
        schoolId,
        subject:   'Homework concern — missed submissions',
        context:   'homework',
        createdBy: teacher.id,
        participants: { create: [{ userId: teacher.id }, { userId: parent.id }] },
        messages: {
          create: [
            { senderId: teacher.id, body: "Hi, I wanted to reach out about Aiden's recent homework submissions. He has missed the last two assignments. Is everything okay at home?" },
            { senderId: parent.id,  body: "Thank you for letting me know. Aiden has been unwell this week. He'll catch up by Friday. Sorry for the inconvenience." },
            { senderId: teacher.id, body: "No problem at all — please let me know if there's anything we can do to support him. I'll adjust the deadline." },
          ],
        },
      },
    })
  }

  // Thread 2: SENCO → Teacher (SEND support, private)
  await prisma.msgThread.create({
    data: {
      schoolId,
      subject:   'SEND support strategies for Year 9 class',
      context:   'send',
      isPrivate: true,
      createdBy: senco.id,
      participants: { create: [{ userId: senco.id }, { userId: teacher.id }] },
      messages: {
        create: [
          { senderId: senco.id,    body: "Hi, I've reviewed the EHCPs for your Year 9 class. A few students would benefit from chunked instructions and extra processing time. I've attached notes to their profiles." },
          { senderId: teacher.id,  body: "Thanks — really helpful. I'll review before Monday's lesson and adjust my planning accordingly." },
        ],
      },
    },
  })

  // Thread 3: Student → Teacher (question)
  if (student) {
    await prisma.msgThread.create({
      data: {
        schoolId,
        subject:   'Question about the upcoming assessment',
        context:   'general',
        createdBy: student.id,
        participants: { create: [{ userId: student.id }, { userId: teacher.id }] },
        messages: {
          create: [
            { senderId: student.id,  body: "Hi, I was wondering if the assessment on Friday will include the poetry section we covered last week?" },
            { senderId: teacher.id,  body: "Yes, poetry will be covered — about 20% of the marks. Focus on the annotation techniques we practised. Good luck!" },
          ],
        },
      },
    })
  }

  // Thread 4: Teacher → Student (praise)
  if (student) {
    await prisma.msgThread.create({
      data: {
        schoolId,
        subject:   'Well done on your recent essay',
        context:   'general',
        createdBy: teacher.id,
        participants: { create: [{ userId: teacher.id }, { userId: student.id }] },
        messages: {
          create: [
            { senderId: teacher.id, body: "I just wanted to say — your essay on Macbeth was excellent. Your analysis of the power themes was really sophisticated. Keep up the great work!" },
          ],
        },
      },
    })
  }

  // Thread 5: SLT → Teacher (cover)
  if (slt) {
    await prisma.msgThread.create({
      data: {
        schoolId,
        subject:   'Cover arrangements this Friday',
        context:   'general',
        createdBy: slt.id,
        participants: { create: [{ userId: slt.id }, { userId: teacher.id }] },
        messages: {
          create: [
            { senderId: slt.id,     body: "Hi, could you cover Period 3 for Mr Davies this Friday? He'll be on a trip. The class is 10M/Ma1 and the work has been set." },
            { senderId: teacher.id, body: "Of course — I have a free that period. I'll make sure to pick up the work from the cover folder." },
          ],
        },
      },
    })
  }

  console.log('Message threads seeded')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
