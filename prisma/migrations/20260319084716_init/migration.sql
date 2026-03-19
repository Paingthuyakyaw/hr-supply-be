-- CreateEnum
CREATE TYPE "MenuCode" AS ENUM ('DASHBOARD', 'EMPLOYEE', 'DEPARTMENT', 'POSITION', 'ORGANIZATION', 'PLAN_MANAGEMENT', 'ATTENDANCE', 'LEAVE_MANGEMENT', 'PAYROLL');

-- CreateEnum
CREATE TYPE "Action" AS ENUM ('CREATE', 'VIEW', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "WeekDay" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('PART_TIME', 'FULL_TIME', 'HYBRID');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_PROBATION', 'PENDING', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "IDDocType" AS ENUM ('PASSPORT', 'DRIVER_LICENSE', 'NRC');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PRO', 'ENTERPRISE', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "total_employees" INTEGER NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "expire_time" TIMESTAMP(3),
    "planId" INTEGER NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" SERIAL NOT NULL,
    "code" "PlanCode" NOT NULL DEFAULT 'FREE',
    "name" TEXT NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "head_employee_id" INTEGER,
    "employee_count" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "annual_budget" TEXT,
    "startTime" TIME(6) NOT NULL,
    "endTime" TIME(6) NOT NULL,
    "working_days" "WeekDay"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "department_id" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "avg_salary" INTEGER,
    "min_salary" INTEGER,
    "max_salary" INTEGER,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "avatar" TEXT,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "password" TEXT,
    "dob" TIMESTAMP(3),
    "employment_type" "EmployeeType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'PENDING',
    "location" TEXT NOT NULL,
    "date_joined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "department_id" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnPosition" (
    "position_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeOnPosition_pkey" PRIMARY KEY ("employee_id","position_id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "fileKey" TEXT,
    "folder" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ID_Document" (
    "id" SERIAL NOT NULL,
    "type" "IDDocType" NOT NULL,
    "front_url" TEXT,
    "back_url" TEXT,
    "employee_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ID_Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" SERIAL NOT NULL,
    "menu" "MenuCode" NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanOnMenu" (
    "planId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "actions" "Action"[] DEFAULT ARRAY['VIEW']::"Action"[],

    CONSTRAINT "PlanOnMenu_pkey" PRIMARY KEY ("planId","menuId")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignationOnMenu" (
    "designationId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "actions" "Action"[] DEFAULT ARRAY['VIEW']::"Action"[],

    CONSTRAINT "DesignationOnMenu_pkey" PRIMARY KEY ("designationId","menuId")
);

-- CreateTable
CREATE TABLE "DesignationOnEmployee" (
    "designationId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,

    CONSTRAINT "DesignationOnEmployee_pkey" PRIMARY KEY ("designationId","employeeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_head_employee_id_key" ON "Department"("head_employee_id");

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Position_organizationId_idx" ON "Position"("organizationId");

-- CreateIndex
CREATE INDEX "Position_department_id_idx" ON "Position"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_name_key" ON "Position"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_phoneNumber_key" ON "Employee"("phoneNumber");

-- CreateIndex
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

-- CreateIndex
CREATE INDEX "Employee_department_id_idx" ON "Employee"("department_id");

-- CreateIndex
CREATE INDEX "EmployeeOnPosition_employee_id_idx" ON "EmployeeOnPosition"("employee_id");

-- CreateIndex
CREATE INDEX "EmployeeOnPosition_position_id_idx" ON "EmployeeOnPosition"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "Image_fileKey_key" ON "Image"("fileKey");

-- CreateIndex
CREATE INDEX "Designation_organizationId_idx" ON "Designation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_organizationId_name_key" ON "Designation"("organizationId", "name");

-- CreateIndex
CREATE INDEX "DesignationOnMenu_designationId_idx" ON "DesignationOnMenu"("designationId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_head_employee_id_fkey" FOREIGN KEY ("head_employee_id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnPosition" ADD CONSTRAINT "EmployeeOnPosition_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnPosition" ADD CONSTRAINT "EmployeeOnPosition_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ID_Document" ADD CONSTRAINT "ID_Document_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOnMenu" ADD CONSTRAINT "PlanOnMenu_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOnMenu" ADD CONSTRAINT "PlanOnMenu_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationOnMenu" ADD CONSTRAINT "DesignationOnMenu_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationOnMenu" ADD CONSTRAINT "DesignationOnMenu_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationOnEmployee" ADD CONSTRAINT "DesignationOnEmployee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationOnEmployee" ADD CONSTRAINT "DesignationOnEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
