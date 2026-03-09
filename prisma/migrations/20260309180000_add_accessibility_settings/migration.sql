-- CreateTable
CREATE TABLE "UserAccessibilitySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dyslexiaFont" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "largeText" BOOLEAN NOT NULL DEFAULT false,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "lineSpacing" TEXT NOT NULL DEFAULT 'normal',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessibilitySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessibilitySettings_userId_key" ON "UserAccessibilitySettings"("userId");

-- AddForeignKey
ALTER TABLE "UserAccessibilitySettings" ADD CONSTRAINT "UserAccessibilitySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

