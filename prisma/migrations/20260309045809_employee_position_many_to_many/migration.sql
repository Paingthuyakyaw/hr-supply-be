-- CreateTable
CREATE TABLE "EmployeeOnPosition" (
    "position_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeOnPosition_pkey" PRIMARY KEY ("employee_id","position_id")
);

-- CreateIndex
CREATE INDEX "EmployeeOnPosition_employee_id_idx" ON "EmployeeOnPosition"("employee_id");

-- CreateIndex
CREATE INDEX "EmployeeOnPosition_position_id_idx" ON "EmployeeOnPosition"("position_id");

-- AddForeignKey
ALTER TABLE "EmployeeOnPosition" ADD CONSTRAINT "EmployeeOnPosition_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnPosition" ADD CONSTRAINT "EmployeeOnPosition_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


