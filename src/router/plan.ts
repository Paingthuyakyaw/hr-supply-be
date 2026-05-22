import { Router } from "express";
import { createPlan, editPlan, getAllPlan } from "../controller/plan";
import { validate } from "../validator/index";
import { createPlanSchema, editPlanSchema } from "../validator/plan";
import { requirePermission } from "../middleware/permission";
import {
  Action,
  MenuCode,
  PlatformPermission,
} from "../generated/prisma/enums";
import { requirePlatformPermissionIfSuperadmin } from "../middleware/platformPermission";

const planRouter = Router();

planRouter.get(
  "/",
  requirePlatformPermissionIfSuperadmin(PlatformPermission.APPROVAL_VIEW),
  requirePermission(MenuCode.PLAN_MANAGEMENT, Action.VIEW),
  getAllPlan,
);
planRouter.post(
  "/",
  requirePlatformPermissionIfSuperadmin(PlatformPermission.APPROVAL_DECIDE),
  requirePermission(MenuCode.PLAN_MANAGEMENT, Action.CREATE),
  validate(createPlanSchema),
  createPlan,
);
planRouter.put(
  "/:id",
  requirePlatformPermissionIfSuperadmin(PlatformPermission.APPROVAL_DECIDE),
  requirePermission(MenuCode.PLAN_MANAGEMENT, Action.UPDATE),
  validate(editPlanSchema),
  editPlan,
);

export default planRouter;
