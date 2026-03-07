-- AlterTable
ALTER TABLE "SendStatus" ADD COLUMN     "needArea" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "misconceptionTags" JSONB;
