/*
  Warnings:

  - Changed the type of `code` on the `Plan` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "code",
ADD COLUMN     "code" TEXT NOT NULL;

-- DropEnum
DROP TYPE "PlanCode";
