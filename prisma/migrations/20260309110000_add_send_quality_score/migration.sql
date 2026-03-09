-- CreateTable
CREATE TABLE "SendQualityScore" (
    "id" TEXT NOT NULL,
    "oakLessonSlug" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "readabilityScore" INTEGER NOT NULL,
    "visualLoadScore" INTEGER NOT NULL,
    "cognitiveScore" INTEGER NOT NULL,
    "languageScore" INTEGER NOT NULL,
    "structureScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendations" TEXT[],
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelVersion" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',

    CONSTRAINT "SendQualityScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SendQualityScore_oakLessonSlug_key" ON "SendQualityScore"("oakLessonSlug");

-- AddForeignKey
ALTER TABLE "SendQualityScore" ADD CONSTRAINT "SendQualityScore_oakLessonSlug_fkey" FOREIGN KEY ("oakLessonSlug") REFERENCES "OakLesson"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
