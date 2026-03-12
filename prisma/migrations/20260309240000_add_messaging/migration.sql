-- CreateTable MsgThread
CREATE TABLE "MsgThread" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "context" TEXT,
    "contextId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MsgThread_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MsgParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MsgParticipant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MsgMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "attachments" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    CONSTRAINT "MsgMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MsgParticipant_threadId_userId_key" ON "MsgParticipant"("threadId", "userId");
CREATE INDEX "MsgThread_schoolId_idx" ON "MsgThread"("schoolId");
CREATE INDEX "MsgThread_updatedAt_idx" ON "MsgThread"("updatedAt");
CREATE INDEX "MsgParticipant_userId_idx" ON "MsgParticipant"("userId");
CREATE INDEX "MsgMessage_threadId_sentAt_idx" ON "MsgMessage"("threadId", "sentAt");
ALTER TABLE "MsgThread" ADD CONSTRAINT "MsgThread_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MsgParticipant" ADD CONSTRAINT "MsgParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MsgThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MsgParticipant" ADD CONSTRAINT "MsgParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MsgMessage" ADD CONSTRAINT "MsgMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MsgThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MsgMessage" ADD CONSTRAINT "MsgMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
