For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AdaptationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."AudienceType" AS ENUM ('CLASS', 'CUSTOM_GROUP');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('HOMEWORK_CREATED', 'HOMEWORK_PUBLISHED', 'HOMEWORK_ADAPTED', 'SUBMISSION_GRADED', 'GRADE_OVERRIDDEN', 'SUBMISSION_RETURNED', 'RESUBMISSION_REQUESTED', 'ILP_CREATED', 'ILP_ACTIVATED', 'ILP_REVIEWED', 'ILP_SHARED_WITH_PARENT', 'SEND_STATUS_CHANGED', 'INTEGRITY_FLAGGED', 'INTEGRITY_REVIEWED', 'MESSAGE_SENT', 'USER_CREATED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED', 'LESSON_PUBLISHED', 'WONDE_SYNC_COMPLETED', 'RESOURCE_UPLOADED', 'ADAPTATION_APPLIED', 'USER_SETTINGS_CHANGED');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."HomeworkStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."HomeworkType" AS ENUM ('MCQ_QUIZ', 'SHORT_ANSWER', 'EXTENDED_WRITING', 'MIXED', 'UPLOAD');

-- CreateEnum
CREATE TYPE "public"."ILPStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."IntegrityCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CLOSED_NO_ACTION', 'CLOSED_ACTIONED');

-- CreateEnum
CREATE TYPE "public"."LessonSharingLevel" AS ENUM ('SCHOOL', 'SELECTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "public"."LessonType" AS ENUM ('NORMAL', 'COVER', 'INTERVENTION', 'CLUB');

-- CreateEnum
CREATE TYPE "public"."MessageSenderType" AS ENUM ('PARENT', 'TEACHER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."PlanStatus" AS ENUM ('DRAFT', 'ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ReleasePolicy" AS ENUM ('AUTO_OBJECTIVE', 'TEACHER_EXTENDED');

-- CreateEnum
CREATE TYPE "public"."ResourceType" AS ENUM ('PLAN', 'SLIDES', 'WORKSHEET', 'VIDEO', 'LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'SLT', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'COVER_MANAGER', 'TEACHER', 'SENCO', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "public"."SendReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SendStatusValue" AS ENUM ('NONE', 'SEN_SUPPORT', 'EHCP');

-- CreateEnum
CREATE TYPE "public"."StrategyAppliesTo" AS ENUM ('HOMEWORK', 'CLASSROOM', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQ', 'MARKED', 'RETURNED');

-- CreateTable
CREATE TABLE "public"."AdaptationRecommendation" (
    "id" TEXT NOT NULL,
    "reviewCycleId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "recommendedSettingsJson" JSONB NOT NULL,
    "status" "public"."AdaptationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptationRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClassPerformanceAggregate" (
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
CREATE TABLE "public"."ClassTeacher" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ClassTeacher_pkey" PRIMARY KEY ("classId","userId")
);

-- CreateTable
CREATE TABLE "public"."Enrolment" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Enrolment_pkey" PRIMARY KEY ("classId","userId")
);

-- CreateTable
CREATE TABLE "public"."ExternalChangeLog" (
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
CREATE TABLE "public"."Homework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "modelAnswer" TEXT,
    "gradingBands" JSONB,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."HomeworkStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "public"."HomeworkType" NOT NULL DEFAULT 'SHORT_ANSWER',
    "releasePolicy" "public"."ReleasePolicy" NOT NULL DEFAULT 'AUTO_OBJECTIVE',
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "isAdapted" BOOLEAN NOT NULL DEFAULT false,
    "adaptedFor" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiDecision" TEXT,
    "questionsJson" JSONB,
    "targetWordCount" INTEGER,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HomeworkQuestion" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" "public"."HomeworkType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" JSONB,
    "correctAnswerJson" JSONB,
    "explanationText" TEXT,
    "rubricJson" JSONB,
    "maxScore" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HomeworkQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ILP" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."ILPStatus" NOT NULL DEFAULT 'DRAFT',
    "needsSummary" TEXT NOT NULL,
    "reviewDueAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ILP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ILPNote" (
    "id" TEXT NOT NULL,
    "ilpId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ILPNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ILPTarget" (
    "id" TEXT NOT NULL,
    "ilpId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "successCriteria" TEXT NOT NULL,
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT,

    CONSTRAINT "ILPTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrityPatternCase" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."IntegrityCaseStatus" NOT NULL DEFAULT 'OPEN',
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "subjectCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "IntegrityPatternCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrityReviewLog" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegritySignal" (
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
CREATE TABLE "public"."Lesson" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "examBoard" TEXT,
    "objectives" TEXT[],
    "lessonType" "public"."LessonType" NOT NULL DEFAULT 'NORMAL',
    "audienceType" "public"."AudienceType" NOT NULL DEFAULT 'CLASS',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MessageRecipient" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
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
CREATE TABLE "public"."OakContentCache" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "responseRaw" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OakContentCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentChildLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "relationshipType" TEXT NOT NULL DEFAULT 'guardian',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentChildLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentConversation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "public"."MessageSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "moderationFlag" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ParentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentStudentLink" (
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "ParentStudentLink_pkey" PRIMARY KEY ("parentId","studentId")
);

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "public"."PlanStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "public"."PlanReviewCycle" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleReviewDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PlanReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanStrategy" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "strategyText" TEXT NOT NULL,
    "appliesTo" "public"."StrategyAppliesTo" NOT NULL DEFAULT 'BOTH',
    "subjectId" TEXT,

    CONSTRAINT "PlanStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlanTarget" (
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
CREATE TABLE "public"."Resource" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "lessonId" TEXT,
    "type" "public"."ResourceType" NOT NULL,
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
CREATE TABLE "public"."ResourceReview" (
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
CREATE TABLE "public"."ResourceVersion" (
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
CREATE TABLE "public"."School" (
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
CREATE TABLE "public"."SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "yearGroup" INTEGER NOT NULL,
    "department" TEXT NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SendInsight" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "yearGroup" INTEGER NOT NULL,
    "resourceType" TEXT NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "minScore" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "totalResources" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SendScoreCache" (
    "id" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendScoreCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SendStatus" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStatus" "public"."SendStatusValue" NOT NULL DEFAULT 'NONE',
    "activeSource" TEXT,
    "needArea" TEXT,
    "latestMisStatus" "public"."SendStatusValue",
    "misLastSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SendStatusReview" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "incomingStatus" "public"."SendStatusValue" NOT NULL,
    "status" "public"."SendReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendStatusReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubjectAdaptationProfile" (
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
CREATE TABLE "public"."SubjectMedianAggregate" (
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
CREATE TABLE "public"."Submission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
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
    "misconceptionTags" JSONB,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissionAttempt" (
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
CREATE TABLE "public"."SubmissionAttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerJson" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,

    CONSTRAINT "SubmissionAttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SubmissionIntegritySignal" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "riskLevel" "public"."RiskLevel" NOT NULL DEFAULT 'NONE',
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
CREATE TABLE "public"."TeacherAvailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "messagingEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeacherAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TermDate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "yearGroup" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "profilePictureUrl" TEXT,
    "bio" TEXT,
    "defaultSubject" TEXT,
    "allowEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "allowSmsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "allowAnalyticsInsights" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibleToColleagues" BOOLEAN NOT NULL DEFAULT true,
    "profileVisibleToAdmins" BOOLEAN NOT NULL DEFAULT true,
    "lessonSharing" "public"."LessonSharingLevel" NOT NULL DEFAULT 'PRIVATE',
    "allowAiImprovement" BOOLEAN NOT NULL DEFAULT false,
    "pendingEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WondeSyncRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,

    CONSTRAINT "WondeSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdaptationRecommendation_schoolId_studentId_idx" ON "public"."AdaptationRecommendation"("schoolId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_action_idx" ON "public"."AuditLog"("schoolId" ASC, "action" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "public"."AuditLog"("schoolId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ClassPerformanceAggregate_classId_termId_key" ON "public"."ClassPerformanceAggregate"("classId" ASC, "termId" ASC);

-- CreateIndex
CREATE INDEX "ClassPerformanceAggregate_schoolId_classId_idx" ON "public"."ClassPerformanceAggregate"("schoolId" ASC, "classId" ASC);

-- CreateIndex
CREATE INDEX "ExternalChangeLog_syncRunId_idx" ON "public"."ExternalChangeLog"("syncRunId" ASC);

-- CreateIndex
CREATE INDEX "Homework_schoolId_classId_idx" ON "public"."Homework"("schoolId" ASC, "classId" ASC);

-- CreateIndex
CREATE INDEX "HomeworkQuestion_homeworkId_idx" ON "public"."HomeworkQuestion"("homeworkId" ASC);

-- CreateIndex
CREATE INDEX "ILP_schoolId_studentId_idx" ON "public"."ILP"("schoolId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "IntegrityPatternCase_schoolId_studentId_idx" ON "public"."IntegrityPatternCase"("schoolId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "IntegrityReviewLog_signalId_idx" ON "public"."IntegrityReviewLog"("signalId" ASC);

-- CreateIndex
CREATE INDEX "IntegritySignal_schoolId_idx" ON "public"."IntegritySignal"("schoolId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "IntegritySignal_submissionId_key" ON "public"."IntegritySignal"("submissionId" ASC);

-- CreateIndex
CREATE INDEX "Lesson_schoolId_classId_idx" ON "public"."Lesson"("schoolId" ASC, "classId" ASC);

-- CreateIndex
CREATE INDEX "Message_schoolId_senderId_idx" ON "public"."Message"("schoolId" ASC, "senderId" ASC);

-- CreateIndex
CREATE INDEX "Notification_schoolId_userId_createdAt_idx" ON "public"."Notification"("schoolId" ASC, "userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_schoolId_userId_read_idx" ON "public"."Notification"("schoolId" ASC, "userId" ASC, "read" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OakContentCache_query_key" ON "public"."OakContentCache"("query" ASC);

-- CreateIndex
CREATE INDEX "ParentChildLink_childId_idx" ON "public"."ParentChildLink"("childId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ParentChildLink_parentId_childId_key" ON "public"."ParentChildLink"("parentId" ASC, "childId" ASC);

-- CreateIndex
CREATE INDEX "ParentChildLink_parentId_idx" ON "public"."ParentChildLink"("parentId" ASC);

-- CreateIndex
CREATE INDEX "ParentConversation_schoolId_parentId_idx" ON "public"."ParentConversation"("schoolId" ASC, "parentId" ASC);

-- CreateIndex
CREATE INDEX "ParentConversation_schoolId_teacherId_idx" ON "public"."ParentConversation"("schoolId" ASC, "teacherId" ASC);

-- CreateIndex
CREATE INDEX "ParentMessage_conversationId_idx" ON "public"."ParentMessage"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "Plan_schoolId_studentId_idx" ON "public"."Plan"("schoolId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "PlanReviewCycle_planId_idx" ON "public"."PlanReviewCycle"("planId" ASC);

-- CreateIndex
CREATE INDEX "PlanStrategy_planId_idx" ON "public"."PlanStrategy"("planId" ASC);

-- CreateIndex
CREATE INDEX "PlanTarget_planId_idx" ON "public"."PlanTarget"("planId" ASC);

-- CreateIndex
CREATE INDEX "Resource_schoolId_lessonId_idx" ON "public"."Resource"("schoolId" ASC, "lessonId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ResourceReview_resourceId_key" ON "public"."ResourceReview"("resourceId" ASC);

-- CreateIndex
CREATE INDEX "ResourceVersion_resourceId_idx" ON "public"."ResourceVersion"("resourceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "School_wondeId_key" ON "public"."School"("wondeId" ASC);

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_idx" ON "public"."SchoolClass"("schoolId" ASC);

-- CreateIndex
CREATE INDEX "SendInsight_schoolId_idx" ON "public"."SendInsight"("schoolId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SendInsight_schoolId_subject_yearGroup_resourceType_key" ON "public"."SendInsight"("schoolId" ASC, "subject" ASC, "yearGroup" ASC, "resourceType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SendScoreCache_contentHash_key" ON "public"."SendScoreCache"("contentHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SendStatus_studentId_key" ON "public"."SendStatus"("studentId" ASC);

-- CreateIndex
CREATE INDEX "SendStatusReview_studentId_status_idx" ON "public"."SendStatusReview"("studentId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "SubjectAdaptationProfile_schoolId_studentId_idx" ON "public"."SubjectAdaptationProfile"("schoolId" ASC, "studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAdaptationProfile_schoolId_studentId_subjectId_key" ON "public"."SubjectAdaptationProfile"("schoolId" ASC, "studentId" ASC, "subjectId" ASC);

-- CreateIndex
CREATE INDEX "SubjectMedianAggregate_schoolId_subjectId_idx" ON "public"."SubjectMedianAggregate"("schoolId" ASC, "subjectId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectMedianAggregate_schoolId_subjectId_yearGroup_termId_key" ON "public"."SubjectMedianAggregate"("schoolId" ASC, "subjectId" ASC, "yearGroup" ASC, "termId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_homeworkId_studentId_key" ON "public"."Submission"("homeworkId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "Submission_schoolId_studentId_idx" ON "public"."Submission"("schoolId" ASC, "studentId" ASC);

-- CreateIndex
CREATE INDEX "SubmissionAttempt_submissionId_idx" ON "public"."SubmissionAttempt"("submissionId" ASC);

-- CreateIndex
CREATE INDEX "SubmissionAttemptAnswer_attemptId_idx" ON "public"."SubmissionAttemptAnswer"("attemptId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionIntegritySignal_attemptId_key" ON "public"."SubmissionIntegritySignal"("attemptId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAvailability_teacherId_key" ON "public"."TeacherAvailability"("teacherId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_schoolId_role_idx" ON "public"."User"("schoolId" ASC, "role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "public"."UserSettings"("userId" ASC);

-- CreateIndex
CREATE INDEX "WondeSyncRun_schoolId_idx" ON "public"."WondeSyncRun"("schoolId" ASC);

-- AddForeignKey
ALTER TABLE "public"."AdaptationRecommendation" ADD CONSTRAINT "AdaptationRecommendation_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "public"."PlanReviewCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassPerformanceAggregate" ADD CONSTRAINT "ClassPerformanceAggregate_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassPerformanceAggregate" ADD CONSTRAINT "ClassPerformanceAggregate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassTeacher" ADD CONSTRAINT "ClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassTeacher" ADD CONSTRAINT "ClassTeacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrolment" ADD CONSTRAINT "Enrolment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Enrolment" ADD CONSTRAINT "Enrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalChangeLog" ADD CONSTRAINT "ExternalChangeLog_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "public"."WondeSyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Homework" ADD CONSTRAINT "Homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Homework" ADD CONSTRAINT "Homework_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Homework" ADD CONSTRAINT "Homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HomeworkQuestion" ADD CONSTRAINT "HomeworkQuestion_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "public"."Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ILP" ADD CONSTRAINT "ILP_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ILPNote" ADD CONSTRAINT "ILPNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ILPNote" ADD CONSTRAINT "ILPNote_ilpId_fkey" FOREIGN KEY ("ilpId") REFERENCES "public"."ILP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ILPTarget" ADD CONSTRAINT "ILPTarget_ilpId_fkey" FOREIGN KEY ("ilpId") REFERENCES "public"."ILP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrityReviewLog" ADD CONSTRAINT "IntegrityReviewLog_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegrityReviewLog" ADD CONSTRAINT "IntegrityReviewLog_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "public"."SubmissionIntegritySignal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegritySignal" ADD CONSTRAINT "IntegritySignal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IntegritySignal" ADD CONSTRAINT "IntegritySignal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "public"."Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageRecipient" ADD CONSTRAINT "MessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentChildLink" ADD CONSTRAINT "ParentChildLink_childId_fkey" FOREIGN KEY ("childId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentChildLink" ADD CONSTRAINT "ParentChildLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentConversation" ADD CONSTRAINT "ParentConversation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentConversation" ADD CONSTRAINT "ParentConversation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentConversation" ADD CONSTRAINT "ParentConversation_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentMessage" ADD CONSTRAINT "ParentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."ParentConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Plan" ADD CONSTRAINT "Plan_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Plan" ADD CONSTRAINT "Plan_parentSharedById_fkey" FOREIGN KEY ("parentSharedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Plan" ADD CONSTRAINT "Plan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Plan" ADD CONSTRAINT "Plan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanReviewCycle" ADD CONSTRAINT "PlanReviewCycle_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanStrategy" ADD CONSTRAINT "PlanStrategy_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlanTarget" ADD CONSTRAINT "PlanTarget_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Resource" ADD CONSTRAINT "Resource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Resource" ADD CONSTRAINT "Resource_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceReview" ADD CONSTRAINT "ResourceReview_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceVersion" ADD CONSTRAINT "ResourceVersion_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SendInsight" ADD CONSTRAINT "SendInsight_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SendStatus" ADD CONSTRAINT "SendStatus_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SendStatusReview" ADD CONSTRAINT "SendStatusReview_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SendStatusReview" ADD CONSTRAINT "SendStatusReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubjectMedianAggregate" ADD CONSTRAINT "SubjectMedianAggregate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "public"."Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissionAttempt" ADD CONSTRAINT "SubmissionAttempt_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "public"."Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissionAttemptAnswer" ADD CONSTRAINT "SubmissionAttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissionAttemptAnswer" ADD CONSTRAINT "SubmissionAttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."HomeworkQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubmissionIntegritySignal" ADD CONSTRAINT "SubmissionIntegritySignal_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."SubmissionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherAvailability" ADD CONSTRAINT "TeacherAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TermDate" ADD CONSTRAINT "TermDate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WondeSyncRun" ADD CONSTRAINT "WondeSyncRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

