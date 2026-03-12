-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "autoFeedback" TEXT;
ALTER TABLE "Submission" ADD COLUMN "autoMarked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Submission" ADD COLUMN "teacherReviewed" BOOLEAN NOT NULL DEFAULT false;
