-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'COVER_MANAGER', 'TEACHER', 'SENCO', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('NORMAL', 'COVER', 'INTERVENTION', 'CLUB');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('CLASS', 'CUSTOM_GROUP');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PLAN', 'SLIDES', 'WORKSHEET', 'VIDEO', 'LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "HomeworkType" AS ENUM ('MCQ_QUIZ', 'SHORT_ANSWER', 'EXTENDED_WRITING', 'MIXED');

-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReleasePolicy" AS ENUM ('AUTO_OBJECTIVE', 'TEACHER_EXTENDED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQ', 'MARKED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ILPStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StrategyAppliesTo" AS ENUM ('HOMEWORK', 'CLASSROOM', 'BOTH');

-- CreateEnum
CREATE TYPE "AdaptationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SendStatusValue" AS ENUM ('NONE', 'SEN_SUPPORT', 'EHCP');

-- CreateEnum
CREATE TYPE "SendReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('PARENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "IntegrityCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CLOSED_NO_ACTION', 'CLOSED_ACTIONED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('HOMEWORK_CREATED', 'HOMEWORK_PUBLISHED', 'HOMEWORK_ADAPTED', 'SUBMISSION_GRADED', 'GRADE_OVERRIDDEN', 'SUBMISSION_RETURNED', 'RESUBMISSION_REQUESTED', 'ILP_CREATED', 'ILP_ACTIVATED', 'ILP_REVIEWED', 'ILP_SHARED_WITH_PARENT', 'SEND_STATUS_CHANGED', 'INTEGRITY_FLAGGED', 'INTEGRITY_REVIEWED', 'MESSAGE_SENT', 'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED', 'LESSON_PUBLISHED', 'WONDE_SYNC_COMPLETED', 'RESOURCE_UPLOADED', 'ADAPTATION_APPLIED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wondeId" TEXT,
    "aiOptIn" BOOLEAN NOT NULL DEFAULT false,
    "dayStartHour" INTEGER NOT NULL DEFAULT 8,
    "dayEndHour" INTEGER NOT NULL DEFAULT 16,
    "extStartHour" INTEGER NOT NULL DEFAULT 7,
    "extEndHour" INTEGER NOT NULL DEFAULT 19,
    "allowAggregatedContribution" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermDate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "yearGroup" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "yearGroup" INTEGER NOT NULL,
    "department" TEXT NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTeacher" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ClassTeacher_pkey" PRIMARY KEY ("classId","userId")
);

-- CreateTable
CREATE TABLE "Enrolment" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("classId","userId")
);

-- CreateTable
CREATE TABLE "ParentStudentLink" (
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "ParentStudentLink_pkey" PRIMARY KEY ("parentId","studentId")
);

-- CreateTable
CREATE TABLE "ParentChildLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "relationshipType" TEXT NOT NULL DEFAULT 'guardian',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentChildLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "title" TEXT NOT NULL,
    "objectives" TEXT[],
    "lessonType" "LessonType" NOT NULL DEFAULT 'NORMAL',
    "audienceType" "AudienceType" NOT NULL DEFAULT 'CLASS',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "lessonId" TEXT,
    "type" "ResourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "fileKey" TEXT,
    "oakContentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceVersion" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "url" TEXT,
    "fileKey" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceReview" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sendScore" INTEGER NOT NULL,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OakContentCache" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "responseRaw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OakContentCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "modelAnswer" TEXT,
    "gradingBands" JSONB,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "HomeworkType" NOT NULL DEFAULT 'SHORT_ANSWER',
    "releasePolicy" "ReleasePolicy" NOT NULL DEFAULT 'AUTO_OBJECTIVE',
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "isAdapted" BOOLEAN NOT NULL DEFAULT false,
    "adaptedFor" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkQuestion" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" "HomeworkType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" JSONB,
    "correctAnswerJson" JSONB,
    "explanationText" TEXT,
    "rubricJson" JSONB,
    "maxScore" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HomeworkQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedAt" TIMESTAMP(3),
    "autoScore" DOUBLE PRECISION,
    "teacherScore" DOUBLE PRECISION,
    "teacherScoreReason" TEXT,
    "finalScore" DOUBLE PRECISION,
    "finalAttemptId" TEXT,
    "integrityReviewed" BOOLEAN NOT NULL DEFAULT false,
    "integrityReleaseOverride" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "feedback" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "content" TEXT,
    "answersJson" JSONB,
    "autoScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "isResubmission" BOOLEAN NOT NULL DEFAULT false,
    "changeCategory" TEXT,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,

    CONSTRAINT "SubmissionAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegritySignal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "pasteCount" INTEGER NOT NULL DEFAULT 0,
    "pasteCharRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeOnTaskSecs" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegritySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionIntegritySignal" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NONE',
    "pasteEventsCount" INTEGER NOT NULL DEFAULT 0,
    "pastedChars" INTEGER NOT NULL DEFAULT 0,
    "typedChars" INTEGER NOT NULL DEFAULT 0,
    "pasteRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstLargePasteSecs" INTEGER,
    "largestPasteChars" INTEGER NOT NULL DEFAULT 0,
    "replacementEvents" INTEGER NOT NULL DEFAULT 0,
    "focusLostCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionIntegritySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityReviewLog" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityPatternCase" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "IntegrityCaseStatus" NOT NULL DEFAULT 'OPEN',
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "subjectCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "IntegrityPatternCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ILP" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "ILPStatus" NOT NULL DEFAULT 'DRAFT',
    "needsSummary" TEXT NOT NULL,
    "reviewDueAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ILP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ILPTarget" (
    "id" TEXT NOT NULL,
    "ilpId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "successCriteria" TEXT NOT NULL,
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT,

    CONSTRAINT "ILPTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ILPNote" (
    "id" TEXT NOT NULL,
    "ilpId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ILPNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendStatus" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStatus" "SendStatusValue" NOT NULL DEFAULT 'NONE',
    "activeSource" TEXT,
    "latestMisStatus" "SendStatusValue",
    "misLastSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendStatusReview" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "incomingStatus" "SendStatusValue" NOT NULL,
    "status" "SendReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendStatusReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "activatedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "parentSharedById" TEXT,
    "parentSharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTarget" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "needCategory" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "baselineValue" TEXT,
    "targetValue" TEXT NOT NULL,
    "measurementWindow" TEXT,
    "reviewDate" TIMESTAMP(3),
    "achieved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanStrategy" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "strategyText" TEXT NOT NULL,
    "appliesTo" "StrategyAppliesTo" NOT NULL DEFAULT 'BOTH',
    "subjectId" TEXT,

    CONSTRAINT "PlanStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanReviewCycle" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleReviewDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PlanReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectAdaptationProfile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "activeSettingsJson" JSONB NOT NULL DEFAULT '{}',
    "lockedFieldsJson" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectAdaptationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptationRecommendation" (
    "id" TEXT NOT NULL,
    "reviewCycleId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "recommendedSettingsJson" JSONB NOT NULL,
    "status" "AdaptationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRecipient" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "TeacherAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "messagingEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentConversation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "MessageSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "moderationFlag" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ParentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassPerformanceAggregate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "completionRate" DOUBLE PRECISION NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "predictedDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "integrityFlagRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassPerformanceAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectMedianAggregate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "yearGroup" INTEGER NOT NULL,
    "termId" TEXT NOT NULL,
    "mediansJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectMedianAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WondeSyncRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,

    CONSTRAINT "WondeSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalChangeLog" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "linkHref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_wondeId_key" ON "School"("wondeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_schoolId_role_idx" ON "User"("schoolId", "role");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");

-- CreateIndex
CREATE INDEX "ParentChildLink_parentId_idx" ON "ParentChildLink"("parentId");

-- CreateIndex
CREATE INDEX "ParentChildLink_childId_idx" ON "ParentChildLink"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentChildLink_parentId_childId_key" ON "ParentChildLink"("parentId", "childId");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_classId_idx" ON "Lesson"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Resource_schoolId_lessonId_idx" ON "Resource"("schoolId", "lessonId");

-- CreateIndex
CREATE INDEX "ResourceVersion_resourceId_idx" ON "ResourceVersion"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceReview_resourceId_key" ON "ResourceReview"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "OakContentCache_query_key" ON "OakContentCache"("query");

-- CreateIndex
CREATE INDEX "Homework_schoolId_classId_idx" ON "Homework"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "HomeworkQuestion_homeworkId_idx" ON "HomeworkQuestion"("homeworkId");

-- CreateIndex
CREATE INDEX "Submission_schoolId_studentId_idx" ON "Submission"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_homeworkId_studentId_key" ON "Submission"("homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_submissionId_idx" ON "SubmissionAttempt"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionAttemptAnswer_attemptId_idx" ON "SubmissionAttemptAnswer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegritySignal_submissionId_key" ON "IntegritySignal"("submissionId");

-- CreateIndex
CREATE INDEX "IntegritySignal_schoolId_idx" ON "IntegritySignal"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionIntegritySignal_attemptId_key" ON "SubmissionIntegritySignal"("attemptId");

-- CreateIndex
CREATE INDEX "IntegrityReviewLog_signalId_idx" ON "IntegrityReviewLog"("signalId");

-- CreateIndex
CREATE INDEX "IntegrityPatternCase_schoolId_studentId_idx" ON "IntegrityPatternCase"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ILP_schoolId_studentId_idx" ON "ILP"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SendStatus_studentId_key" ON "SendStatus"("studentId");

-- CreateIndex
CREATE INDEX "SendStatusReview_studentId_status_idx" ON "SendStatusReview"("studentId", "status");

-- CreateIndex
CREATE INDEX "Plan_schoolId_studentId_idx" ON "Plan"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "PlanTarget_planId_idx" ON "PlanTarget"("planId");

-- CreateIndex
CREATE INDEX "PlanStrategy_planId_idx" ON "PlanStrategy"("planId");

-- CreateIndex
CREATE INDEX "PlanReviewCycle_planId_idx" ON "PlanReviewCycle"("planId");

-- CreateIndex
CREATE INDEX "SubjectAdaptationProfile_schoolId_studentId_idx" ON "SubjectAdaptationProfile"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAdaptationProfile_schoolId_studentId_subjectId_key" ON "SubjectAdaptationProfile"("schoolId", "studentId", "subjectId");

-- CreateIndex
CREATE INDEX "AdaptationRecommendation_schoolId_studentId_idx" ON "AdaptationRecommendation"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Message_schoolId_senderId_idx" ON "Message"("schoolId", "senderId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_teacherId_key" ON "TeacherAvailability"("teacherId");

-- CreateIndex
CREATE INDEX "ParentConversation_schoolId_teacherId_idx" ON "ParentConversation"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "ParentConversation_schoolId_parentId_idx" ON "ParentConversation"("schoolId", "parentId");

-- CreateIndex
CREATE INDEX "ParentMessage_conversationId_idx" ON "ParentMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ClassPerformanceAggregate_schoolId_classId_idx" ON "ClassPerformanceAggregate"("schoolId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassPerformanceAggregate_classId_termId_key" ON "ClassPerformanceAggregate"("classId", "termId");

-- CreateIndex
CREATE INDEX "SubjectMedianAggregate_schoolId_subjectId_idx" ON "SubjectMedianAggregate"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectMedianAggregate_schoolId_subjectId_yearGroup_termId_key" ON "SubjectMedianAggregate"("schoolId", "subjectId", "yearGroup", "termId");

-- CreateIndex
CREATE INDEX "WondeSyncRun_schoolId_idx" ON "WondeSyncRun"("schoolId");

-- CreateIndex
CREATE INDEX "ExternalChangeLog_syncRunId_idx" ON "ExternalChangeLog"("syncRunId");

-- CreateIndex
CREATE INDEX "Notification_schoolId_userId_read_idx" ON "Notification"("schoolId", "userId", "read");

-- CreateIndex
CREATE INDEX "Notification_schoolId_userId_createdAt_idx" ON "Notification"("schoolId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_action_idx" ON "AuditLog"("schoolId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "TermDate" ADD CONSTRAINT "TermDate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChildLink" ADD CONSTRAINT "ParentChildLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChildLink" ADD CONSTRAINT "ParentChildLink_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceVersion" ADD CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceReview" ADD CONSTRAINT "ResourceReview_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkQuestion" ADD CONSTRAINT "HomeworkQuestion_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttemptAnswer" ADD CONSTRAINT "SubmissionAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttemptAnswer" ADD CONSTRAINT "SubmissionAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "HomeworkQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegritySignal" ADD CONSTRAINT "IntegritySignal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegritySignal" ADD CONSTRAINT "IntegritySignal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionIntegritySignal" ADD CONSTRAINT "SubmissionIntegritySignal_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityReviewLog" ADD CONSTRAINT "IntegrityReviewLog_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "SubmissionIntegritySignal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityReviewLog" ADD CONSTRAINT "IntegrityReviewLog_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ILP" ADD CONSTRAINT "ILP_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ILPTarget" ADD CONSTRAINT "ILPTarget_ilpId_fkey" FOREIGN KEY ("ilpId") REFERENCES "ILP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ILPNote" ADD CONSTRAINT "ILPNote_ilpId_fkey" FOREIGN KEY ("ilpId") REFERENCES "ILP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ILPNote" ADD CONSTRAINT "ILPNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendStatus" ADD CONSTRAINT "SendStatus_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendStatusReview" ADD CONSTRAINT "SendStatusReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendStatusReview" ADD CONSTRAINT "SendStatusReview_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_parentSharedById_fkey" FOREIGN KEY ("parentSharedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTarget" ADD CONSTRAINT "PlanTarget_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStrategy" ADD CONSTRAINT "PlanStrategy_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReviewCycle" ADD CONSTRAINT "PlanReviewCycle_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptationRecommendation" ADD CONSTRAINT "AdaptationRecommendation_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "PlanReviewCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentConversation" ADD CONSTRAINT "ParentConversation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentConversation" ADD CONSTRAINT "ParentConversation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentConversation" ADD CONSTRAINT "ParentConversation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMessage" ADD CONSTRAINT "ParentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ParentConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPerformanceAggregate" ADD CONSTRAINT "ClassPerformanceAggregate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassPerformanceAggregate" ADD CONSTRAINT "ClassPerformanceAggregate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectMedianAggregate" ADD CONSTRAINT "SubjectMedianAggregate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WondeSyncRun" ADD CONSTRAINT "WondeSyncRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalChangeLog" ADD CONSTRAINT "ExternalChangeLog_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "WondeSyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
