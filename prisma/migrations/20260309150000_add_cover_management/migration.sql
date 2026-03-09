-- CreateTable
CREATE TABLE "StaffAbsence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "reportedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "timetableEntryId" TEXT NOT NULL,
    "coveredBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unassigned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAbsence_schoolId_date_idx" ON "StaffAbsence"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StaffAbsence_staffId_idx" ON "StaffAbsence"("staffId");

-- CreateIndex
CREATE INDEX "CoverAssignment_schoolId_absenceId_idx" ON "CoverAssignment"("schoolId", "absenceId");

-- CreateIndex
CREATE INDEX "CoverAssignment_coveredBy_idx" ON "CoverAssignment"("coveredBy");

-- AddForeignKey
ALTER TABLE "StaffAbsence" ADD CONSTRAINT "StaffAbsence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverAssignment" ADD CONSTRAINT "CoverAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverAssignment" ADD CONSTRAINT "CoverAssignment_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "StaffAbsence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
