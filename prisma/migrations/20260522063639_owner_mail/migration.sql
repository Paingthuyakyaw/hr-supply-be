-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "ownerEmail" TEXT;

-- CreateTable
CREATE TABLE "OrganizationOnboardingToken" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationOnboardingToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationOnboardingToken_tokenHash_key" ON "OrganizationOnboardingToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationOnboardingToken_organizationId_email_idx" ON "OrganizationOnboardingToken"("organizationId", "email");

-- CreateIndex
CREATE INDEX "OrganizationOnboardingToken_employeeId_idx" ON "OrganizationOnboardingToken"("employeeId");

-- CreateIndex
CREATE INDEX "OrganizationOnboardingToken_expiresAt_idx" ON "OrganizationOnboardingToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "OrganizationOnboardingToken" ADD CONSTRAINT "OrganizationOnboardingToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationOnboardingToken" ADD CONSTRAINT "OrganizationOnboardingToken_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
