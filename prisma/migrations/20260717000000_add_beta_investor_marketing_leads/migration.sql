CREATE TABLE "BetaApplication" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "schoolSize" TEXT NOT NULL,
    "message" TEXT,
    "ip" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BetaApplication_createdAt_idx" ON "BetaApplication"("createdAt");

CREATE TABLE "InvestorInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisation" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "ip" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestorInquiry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvestorInquiry_createdAt_idx" ON "InvestorInquiry"("createdAt");
