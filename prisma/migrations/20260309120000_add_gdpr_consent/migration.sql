-- CreateTable
CREATE TABLE "ConsentPurpose" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lawfulBasis" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "studentId" TEXT,
    "submittedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentPurpose_schoolId_idx" ON "ConsentPurpose"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentPurpose_schoolId_slug_key" ON "ConsentPurpose"("schoolId", "slug");

-- CreateIndex
CREATE INDEX "ConsentRecord_purposeId_idx" ON "ConsentRecord"("purposeId");

-- CreateIndex
CREATE INDEX "ConsentRecord_studentId_idx" ON "ConsentRecord"("studentId");

-- CreateIndex
CREATE INDEX "ConsentRecord_responderId_idx" ON "ConsentRecord"("responderId");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_schoolId_status_idx" ON "DataSubjectRequest"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "ConsentPurpose" ADD CONSTRAINT "ConsentPurpose_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "ConsentPurpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
