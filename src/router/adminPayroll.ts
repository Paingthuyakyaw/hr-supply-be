import { Router } from "express";
import {
  calculateEmployeePayroll,
  createPayrollComponent,
  exportPayrollRun,
  getEmployeePayrollDetail,
  getPayrollCalculateOptions,
  getPayrollOverview,
  getPayrollRunSummary,
  listPayrollComponents,
  listPayrollRuns,
  markPayrollAsPaid,
  runPayroll,
  updatePayrollComponent,
} from "../controller/payroll";
import { validate } from "../validator";
import {
  payrollComponentCreateSchema,
  payrollComponentListSchema,
  payrollComponentUpdateSchema,
  payrollEmployeePaySchema,
  payrollEmployeePayrollDetailSchema,
  payrollEmployeePayrollSchema,
  payrollOverviewSchema,
  payrollRunCalculateOptionsSchema,
  payrollRunCreateSchema,
  payrollRunIdSchema,
  payrollRunListSchema,
} from "../validator/payroll";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const adminPayrollRouter = Router();

adminPayrollRouter.get(
  "/components",
  validate(payrollComponentListSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  listPayrollComponents,
);

adminPayrollRouter.post(
  "/components",
  validate(payrollComponentCreateSchema),
  requirePermission(MenuCode.PAYROLL, Action.CREATE),
  createPayrollComponent,
);

adminPayrollRouter.patch(
  "/components/:id",
  validate(payrollComponentUpdateSchema),
  requirePermission(MenuCode.PAYROLL, Action.UPDATE),
  updatePayrollComponent,
);

adminPayrollRouter.post(
  "/runs",
  validate(payrollRunCreateSchema),
  requirePermission(MenuCode.PAYROLL, Action.CREATE),
  runPayroll,
);

adminPayrollRouter.get(
  "/overview",
  validate(payrollOverviewSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  getPayrollOverview,
);

adminPayrollRouter.get(
  "/calculate/options",
  validate(payrollRunCalculateOptionsSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  getPayrollCalculateOptions,
);

adminPayrollRouter.post(
  "/employees/:employeeId/calculate",
  validate(payrollEmployeePayrollSchema),
  requirePermission(MenuCode.PAYROLL, Action.UPDATE),
  calculateEmployeePayroll,
);

adminPayrollRouter.get(
  "/employees/:employeeId",
  validate(payrollEmployeePayrollDetailSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  getEmployeePayrollDetail,
);

adminPayrollRouter.post(
  "/employees/:employeeId/pay",
  validate(payrollEmployeePaySchema),
  requirePermission(MenuCode.PAYROLL, Action.UPDATE),
  markPayrollAsPaid,
);

adminPayrollRouter.get(
  "/runs",
  validate(payrollRunListSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  listPayrollRuns,
);

adminPayrollRouter.get(
  "/runs/:id/summary",
  validate(payrollRunIdSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  getPayrollRunSummary,
);

adminPayrollRouter.post(
  "/runs/:id/export",
  validate(payrollRunIdSchema),
  requirePermission(MenuCode.PAYROLL, Action.VIEW),
  exportPayrollRun,
);

export default adminPayrollRouter;
