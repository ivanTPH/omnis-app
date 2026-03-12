-- AlterTable: WondeStudent photos
ALTER TABLE "WondeStudent" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "WondeStudent" ADD COLUMN "photoUpdatedAt" TIMESTAMP(3);

-- AlterTable: User avatar
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
