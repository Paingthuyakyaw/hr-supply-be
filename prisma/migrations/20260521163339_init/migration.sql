-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollCalculationType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'FINALIZED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "PayrollEmployeeStatus" AS ENUM ('PENDING', 'PROCESSED', 'PAID');

-- CreateTable
CREATE TABLE "PayrollComponent" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PayrollComponentType" NOT NULL,
    "calculationType" "PayrollCalculationType" NOT NULL DEFAULT 'FIXED',
    "value" DECIMAL(12,2) NOT NULL,
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "payrollRunId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "componentId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "employeeSummaryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmployeeSummary" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "payrollRunId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "totalAllowances" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "status" "PayrollEmployeeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEmployeeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollComponent_organizationId_idx" ON "PayrollComponent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponent_organizationId_code_key" ON "PayrollComponent"("organizationId", "code");

-- CreateIndex
CREATE INDEX "PayrollRun_organizationId_month_idx" ON "PayrollRun"("organizationId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_organizationId_month_key" ON "PayrollRun"("organizationId", "month");

-- CreateIndex
CREATE INDEX "PayrollItem_organizationId_employeeId_idx" ON "PayrollItem"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollItem_organizationId_payrollRunId_idx" ON "PayrollItem"("organizationId", "payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollEmployeeSummary_organizationId_payrollRunId_idx" ON "PayrollEmployeeSummary"("organizationId", "payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollEmployeeSummary_organizationId_employeeId_idx" ON "PayrollEmployeeSummary"("organizationId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEmployeeSummary_payrollRunId_employeeId_key" ON "PayrollEmployeeSummary"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "PayrollComponent" ADD CONSTRAINT "PayrollComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_employeeSummaryId_fkey" FOREIGN KEY ("employeeSummaryId") REFERENCES "PayrollEmployeeSummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeSummary" ADD CONSTRAINT "PayrollEmployeeSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeSummary" ADD CONSTRAINT "PayrollEmployeeSummary_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeSummary" ADD CONSTRAINT "PayrollEmployeeSummary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
