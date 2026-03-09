-- CreateTable
CREATE TABLE "RevisionExam" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "examBoard" TEXT,
    "paperName" TEXT,
    "examDate" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 45,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "confidence" INTEGER,
    "notes" TEXT,
    "oakLessonSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionConfidence" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionConfidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionExam_studentId_idx" ON "RevisionExam"("studentId");

-- CreateIndex
CREATE INDEX "RevisionSession_studentId_idx" ON "RevisionSession"("studentId");

-- CreateIndex
CREATE INDEX "RevisionSession_scheduledAt_idx" ON "RevisionSession"("scheduledAt");

-- CreateIndex
CREATE INDEX "RevisionConfidence_studentId_subject_idx" ON "RevisionConfidence"("studentId", "subject");

-- AddForeignKey
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "RevisionExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

