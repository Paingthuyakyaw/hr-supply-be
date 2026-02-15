/*
  Warnings:

  - You are about to drop the `DesignationPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanOnPermission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DesignationPermission" DROP CONSTRAINT "DesignationPermission_designationId_fkey";

-- DropForeignKey
ALTER TABLE "DesignationPermission" DROP CONSTRAINT "DesignationPermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "PlanOnPermission" DROP CONSTRAINT "PlanOnPermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "PlanOnPermission" DROP CONSTRAINT "PlanOnPermission_planId_fkey";

-- DropTable
DROP TABLE "DesignationPermission";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "PlanOnPermission";

-- CreateTable
CREATE TABLE "Menu" (
    "id" SERIAL NOT NULL,
    "menu" "MenuCode" NOT NULL,
    "action" "Action"[] DEFAULT ARRAY['VIEW']::"Action"[],

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
CREATE TABLE "DesignationOnMenu" (
    "designationId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "actions" "Action"[] DEFAULT ARRAY['VIEW']::"Action"[],

    CONSTRAINT "DesignationOnMenu_pkey" PRIMARY KEY ("designationId","menuId")
);

-- CreateIndex
CREATE INDEX "DesignationOnMenu_designationId_idx" ON "DesignationOnMenu"("designationId");

-- AddForeignKey
ALTER TABLE "PlanOnMenu" ADD CONSTRAINT "PlanOnMenu_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanOnMenu" ADD CONSTRAINT "PlanOnMenu_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationOnMenu" ADD CONSTRAINT "DesignationOnMenu_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationOnMenu" ADD CONSTRAINT "DesignationOnMenu_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
