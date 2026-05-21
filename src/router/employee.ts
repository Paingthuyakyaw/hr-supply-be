import { Router } from "express";
import {
  createEmployeeContract,
  createEmployee,
  deleteEmployee,
  getEmployeeContracts,
  getEmployeeById,
  getEmployees,
  transitionEmployeeLifecycle,
  updateEmployeeContract,
  updateEmployee,
} from "../controller/employee";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";
import { validate } from "../validator";
import {
  createEmployeeContractSchema,
  employeeContractListSchema,
  updateEmployeeContractSchema,
} from "../validator/employeeContract";
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
emRouter.get(
  "/:id/contracts",
  validate(employeeContractListSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.VIEW),
  getEmployeeContracts,
);
emRouter.post(
  "/:id/contracts",
  validate(createEmployeeContractSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.UPDATE),
  createEmployeeContract,
);
emRouter.patch(
  "/:id/contracts/:contractId",
  validate(updateEmployeeContractSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.UPDATE),
  updateEmployeeContract,
);

export default emRouter;
