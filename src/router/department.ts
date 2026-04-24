import { Router } from "express";
import {
  createDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartments,
  updateDepartment,
} from "../controller/department";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const deptRouter = Router();

deptRouter.get("/", requirePermission(MenuCode.DEPARTMENT, Action.VIEW), getDepartments);
deptRouter.get(
  "/:id",
  requirePermission(MenuCode.DEPARTMENT, Action.VIEW),
  getDepartmentById,
);
deptRouter.post(
  "/",
  requirePermission(MenuCode.DEPARTMENT, Action.CREATE),
  createDepartment,
);
deptRouter.put(
  "/:id",
  requirePermission(MenuCode.DEPARTMENT, Action.UPDATE),
  updateDepartment,
);
deptRouter.delete(
  "/:id",
  requirePermission(MenuCode.DEPARTMENT, Action.DELETE),
  deleteDepartment,
);

export default deptRouter;
