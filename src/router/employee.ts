import { Router } from "express";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  transitionEmployeeLifecycle,
  updateEmployee,
} from "../controller/employee";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";
import { validate } from "../validator";
import { employeeLifecycleTransitionSchema as employeeLifecycleSchema } from "../validator/employee";

const emRouter = Router();

emRouter.get(
  "/",
  requirePermission(MenuCode.EMPLOYEE, Action.VIEW),
  getEmployees,
);
emRouter.get(
  "/:id",
  requirePermission(MenuCode.EMPLOYEE, Action.VIEW),
  getEmployeeById,
);
emRouter.post(
  "/",
  requirePermission(MenuCode.EMPLOYEE, Action.CREATE),
  createEmployee,
);
emRouter.put(
  "/:id",
  requirePermission(MenuCode.EMPLOYEE, Action.UPDATE),
  updateEmployee,
);
emRouter.patch(
  "/:id/lifecycle",
  validate(employeeLifecycleSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.UPDATE),
  transitionEmployeeLifecycle,
);
emRouter.delete(
  "/:id",
  requirePermission(MenuCode.EMPLOYEE, Action.DELETE),
  deleteEmployee,
);

export default emRouter;
