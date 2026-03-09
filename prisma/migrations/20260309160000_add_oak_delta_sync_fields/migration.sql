-- AlterTable
ALTER TABLE "OakLesson" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OakSubject" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OakUnit" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OakSyncLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'delta',
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "newSubjects" INTEGER NOT NULL DEFAULT 0,
    "updatedSubjects" INTEGER NOT NULL DEFAULT 0,
    "deletedSubjects" INTEGER NOT NULL DEFAULT 0,
    "newUnits" INTEGER NOT NULL DEFAULT 0,
    "updatedUnits" INTEGER NOT NULL DEFAULT 0,
    "deletedUnits" INTEGER NOT NULL DEFAULT 0,
    "newLessons" INTEGER NOT NULL DEFAULT 0,
    "updatedLessons" INTEGER NOT NULL DEFAULT 0,
    "deletedLessons" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "OakSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OakSyncLog_startedAt_idx" ON "OakSyncLog"("startedAt");
