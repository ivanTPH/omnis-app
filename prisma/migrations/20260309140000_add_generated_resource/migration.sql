-- CreateTable
CREATE TABLE "GeneratedResource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "yearGroup" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sendAdapted" BOOLEAN NOT NULL DEFAULT false,
    "sendNotes" TEXT,
    "modelVersion" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedLessonId" TEXT,

    CONSTRAINT "GeneratedResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedResource_schoolId_createdBy_idx" ON "GeneratedResource"("schoolId", "createdBy");

-- CreateIndex
CREATE INDEX "GeneratedResource_schoolId_subject_idx" ON "GeneratedResource"("schoolId", "subject");
