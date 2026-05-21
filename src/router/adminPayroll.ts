import { Router } from "express";
import {
  createPayrollComponent,
  exportPayrollRun,
  getPayrollRunSummary,
  listPayrollComponents,
  listPayrollRuns,
  runPayroll,
  updatePayrollComponent,
} from "../controller/payroll";
import { validate } from "../validator";
import {
  payrollComponentCreateSchema,
  payrollComponentListSchema,
  payrollComponentUpdateSchema,
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
