import { Router } from "express";
import { createPlan, editPlan, getAllPlan } from "../controller/plan";
import { validate } from "../validator/index";
import { createPlanSchema, editPlanSchema } from "../validator/plan";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const planRouter = Router();

planRouter.get(
  "/",
  // requirePermission(MenuCode.PLAN_MANAGEMENT, Action.VIEW),
  getAllPlan,
);
planRouter.post(
  "/",
  // requirePermission(MenuCode.PLAN_MANAGEMENT, Action.CREATE),
  validate(createPlanSchema),
  createPlan,
);
planRouter.put(
  "/:id",
  // requirePermission(MenuCode.PLAN_MANAGEMENT, Action.UPDATE),
  validate(editPlanSchema),
  editPlan,
);

export default planRouter;
