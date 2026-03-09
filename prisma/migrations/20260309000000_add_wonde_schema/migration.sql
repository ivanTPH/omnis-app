-- CreateTable
CREATE TABLE "WondeSchool" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "wondeToken" TEXT NOT NULL,
    "mis" TEXT,
    "phaseOfEducation" TEXT,
    "urn" INTEGER,
    "laCode" TEXT,
    "establishmentNumber" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "lastDeltaAt" TIMESTAMP(3),

    CONSTRAINT "WondeSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeStudent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "misId" TEXT,
    "upn" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "yearGroup" INTEGER,
    "formGroup" TEXT,
    "isLeaver" BOOLEAN NOT NULL DEFAULT false,
    "wondeUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WondeStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeContact" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "relationship" TEXT,
    "parentalResponsibility" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WondeContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeEmployee" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "misId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT,
    "isTeacher" BOOLEAN NOT NULL DEFAULT true,
    "subjects" JSONB NOT NULL DEFAULT '[]',
    "wondeUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WondeEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "misId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "wondeUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WondeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "misId" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "yearGroup" INTEGER,
    "employeeId" TEXT,
    "groupId" TEXT,
    "wondeUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WondeClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeClassStudent" (
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "WondeClassStudent_pkey" PRIMARY KEY ("classId","studentId")
);

-- CreateTable
CREATE TABLE "WondePeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "dayOfWeek" INTEGER,

    CONSTRAINT "WondePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeTimetableEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "employeeId" TEXT,
    "periodId" TEXT NOT NULL,
    "roomName" TEXT,
    "effectiveDate" TIMESTAMP(3),

    CONSTRAINT "WondeTimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeAssessmentResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectName" TEXT,
    "resultSetName" TEXT,
    "aspectName" TEXT,
    "result" TEXT,
    "gradeValue" TEXT,
    "collectionDate" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WondeAssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeDeletion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "wondeType" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL,
    "restoredAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WondeDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeSyncLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WondeSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WondeSchool_schoolId_key" ON "WondeSchool"("schoolId");

-- CreateIndex
CREATE INDEX "WondeStudent_schoolId_idx" ON "WondeStudent"("schoolId");

-- CreateIndex
CREATE INDEX "WondeStudent_yearGroup_idx" ON "WondeStudent"("yearGroup");

-- CreateIndex
CREATE INDEX "WondeContact_studentId_idx" ON "WondeContact"("studentId");

-- CreateIndex
CREATE INDEX "WondeEmployee_schoolId_idx" ON "WondeEmployee"("schoolId");

-- CreateIndex
CREATE INDEX "WondeGroup_schoolId_idx" ON "WondeGroup"("schoolId");

-- CreateIndex
CREATE INDEX "WondeClass_schoolId_idx" ON "WondeClass"("schoolId");

-- CreateIndex
CREATE INDEX "WondeClass_employeeId_idx" ON "WondeClass"("employeeId");

-- CreateIndex
CREATE INDEX "WondePeriod_schoolId_idx" ON "WondePeriod"("schoolId");

-- CreateIndex
CREATE INDEX "WondeTimetableEntry_schoolId_idx" ON "WondeTimetableEntry"("schoolId");

-- CreateIndex
CREATE INDEX "WondeTimetableEntry_classId_idx" ON "WondeTimetableEntry"("classId");

-- CreateIndex
CREATE INDEX "WondeAssessmentResult_schoolId_idx" ON "WondeAssessmentResult"("schoolId");

-- CreateIndex
CREATE INDEX "WondeAssessmentResult_studentId_idx" ON "WondeAssessmentResult"("studentId");

-- CreateIndex
CREATE INDEX "WondeDeletion_schoolId_idx" ON "WondeDeletion"("schoolId");

-- CreateIndex
CREATE INDEX "WondeSyncLog_schoolId_idx" ON "WondeSyncLog"("schoolId");

-- AddForeignKey
ALTER TABLE "WondeSchool" ADD CONSTRAINT "WondeSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeStudent" ADD CONSTRAINT "WondeStudent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeContact" ADD CONSTRAINT "WondeContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeContact" ADD CONSTRAINT "WondeContact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "WondeStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeEmployee" ADD CONSTRAINT "WondeEmployee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeGroup" ADD CONSTRAINT "WondeGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeClass" ADD CONSTRAINT "WondeClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeClass" ADD CONSTRAINT "WondeClass_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "WondeEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeClass" ADD CONSTRAINT "WondeClass_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WondeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeClassStudent" ADD CONSTRAINT "WondeClassStudent_classId_fkey" FOREIGN KEY ("classId") REFERENCES "WondeClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeClassStudent" ADD CONSTRAINT "WondeClassStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "WondeStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondePeriod" ADD CONSTRAINT "WondePeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeTimetableEntry" ADD CONSTRAINT "WondeTimetableEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeTimetableEntry" ADD CONSTRAINT "WondeTimetableEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "WondeClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeTimetableEntry" ADD CONSTRAINT "WondeTimetableEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "WondeEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeTimetableEntry" ADD CONSTRAINT "WondeTimetableEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "WondePeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeAssessmentResult" ADD CONSTRAINT "WondeAssessmentResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeAssessmentResult" ADD CONSTRAINT "WondeAssessmentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "WondeStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeDeletion" ADD CONSTRAINT "WondeDeletion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeSyncLog" ADD CONSTRAINT "WondeSyncLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

