-- CreateTable
CREATE TABLE "OakSubject" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OakSubject_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "OakUnit" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "keystage" TEXT NOT NULL,
    "yearGroup" INTEGER,
    "examBoard" TEXT,
    "tier" TEXT,
    "programmeSlug" TEXT NOT NULL,
    "description" TEXT,
    "whyThisWhyNow" TEXT,
    "priorKnowledgeRequirements" JSONB NOT NULL DEFAULT '[]',
    "nationalCurriculumContent" JSONB NOT NULL DEFAULT '[]',
    "threads" JSONB NOT NULL DEFAULT '[]',
    "subjectCategories" JSONB NOT NULL DEFAULT '[]',
    "connectionPriorUnit" TEXT,
    "connectionFutureUnit" TEXT,
    "plannedLessonCount" INTEGER NOT NULL DEFAULT 0,
    "orderInProgramme" INTEGER NOT NULL DEFAULT 0,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OakUnit_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "OakLesson" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unitSlug" TEXT NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "keystage" TEXT NOT NULL,
    "yearGroup" INTEGER,
    "examBoard" TEXT,
    "tier" TEXT,
    "orderInUnit" INTEGER NOT NULL DEFAULT 0,
    "pupilLessonOutcome" TEXT,
    "keyLearningPoints" JSONB NOT NULL DEFAULT '[]',
    "lessonKeywords" JSONB NOT NULL DEFAULT '[]',
    "lessonOutline" JSONB NOT NULL DEFAULT '[]',
    "starterQuiz" JSONB NOT NULL DEFAULT '[]',
    "exitQuiz" JSONB NOT NULL DEFAULT '[]',
    "misconceptionsAndCommonMistakes" JSONB NOT NULL DEFAULT '[]',
    "teacherTips" JSONB NOT NULL DEFAULT '[]',
    "contentGuidance" JSONB NOT NULL DEFAULT '[]',
    "supervisionLevel" TEXT,
    "videoMuxPlaybackId" TEXT,
    "videoWithSignLanguageMuxPlaybackId" TEXT,
    "transcriptSentences" JSONB NOT NULL DEFAULT '[]',
    "worksheetUrl" TEXT,
    "presentationUrl" TEXT,
    "subjectCategories" JSONB NOT NULL DEFAULT '[]',
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "loginRequired" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OakLesson_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "OakResource" (
    "id" TEXT NOT NULL,
    "lessonSlug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "ext" TEXT,
    "exists" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OakResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OakSubject_phase_idx" ON "OakSubject"("phase");

-- CreateIndex
CREATE INDEX "OakUnit_subjectSlug_idx" ON "OakUnit"("subjectSlug");

-- CreateIndex
CREATE INDEX "OakUnit_keystage_idx" ON "OakUnit"("keystage");

-- CreateIndex
CREATE INDEX "OakUnit_programmeSlug_idx" ON "OakUnit"("programmeSlug");

-- CreateIndex
CREATE INDEX "OakUnit_examBoard_idx" ON "OakUnit"("examBoard");

-- CreateIndex
CREATE INDEX "OakUnit_yearGroup_idx" ON "OakUnit"("yearGroup");

-- CreateIndex
CREATE INDEX "OakLesson_unitSlug_idx" ON "OakLesson"("unitSlug");

-- CreateIndex
CREATE INDEX "OakLesson_subjectSlug_idx" ON "OakLesson"("subjectSlug");

-- CreateIndex
CREATE INDEX "OakLesson_keystage_idx" ON "OakLesson"("keystage");

-- CreateIndex
CREATE INDEX "OakLesson_examBoard_idx" ON "OakLesson"("examBoard");

-- CreateIndex
CREATE INDEX "OakLesson_yearGroup_idx" ON "OakLesson"("yearGroup");

-- CreateIndex
CREATE INDEX "OakResource_lessonSlug_idx" ON "OakResource"("lessonSlug");

-- CreateIndex
CREATE UNIQUE INDEX "OakResource_lessonSlug_type_key" ON "OakResource"("lessonSlug", "type");

-- AddForeignKey
ALTER TABLE "OakUnit" ADD CONSTRAINT "OakUnit_subjectSlug_fkey" FOREIGN KEY ("subjectSlug") REFERENCES "OakSubject"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OakLesson" ADD CONSTRAINT "OakLesson_unitSlug_fkey" FOREIGN KEY ("unitSlug") REFERENCES "OakUnit"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OakResource" ADD CONSTRAINT "OakResource_lessonSlug_fkey" FOREIGN KEY ("lessonSlug") REFERENCES "OakLesson"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
