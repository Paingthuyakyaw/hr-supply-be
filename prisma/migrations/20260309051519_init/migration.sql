/*
  Warnings:

  - You are about to drop the column `position_id` on the `Employee` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_position_id_fkey";

-- DropIndex
DROP INDEX "Employee_position_id_idx";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "position_id";
