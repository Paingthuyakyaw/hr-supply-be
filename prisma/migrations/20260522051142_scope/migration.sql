-- CreateEnum
CREATE TYPE "ApprovalStepScope" AS ENUM ('ORG', 'PLATFORM');

-- CreateEnum
CREATE TYPE "PlatformPermission" AS ENUM ('APPROVAL_VIEW', 'APPROVAL_DECIDE');

-- DropForeignKey
ALTER TABLE "ApprovalStep" DROP CONSTRAINT "ApprovalStep_approverId_fkey";

-- AlterTable
ALTER TABLE "ApprovalStep" ADD COLUMN     "platformApproverId" INTEGER,
ADD COLUMN     "scope" "ApprovalStepScope" NOT NULL DEFAULT 'ORG',
ALTER COLUMN "approverId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "permissions" "PlatformPermission"[] DEFAULT ARRAY['APPROVAL_VIEW', 'APPROVAL_DECIDE']::"PlatformPermission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE INDEX "ApprovalStep_platformApproverId_idx" ON "ApprovalStep"("platformApproverId");

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_platformApproverId_fkey" FOREIGN KEY ("platformApproverId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
