import { Router } from "express";
import {
  createOrg,
  editOrganization,
  getOrganizationSchedule,
  getAllOrg,
  updateOrganizationSchedule,
} from "../controller/organization";
import { payloadSchema } from "../validator/organization";
import { validateRequest } from "../middleware/validate";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";
import { validate } from "../validator";
import {
  organizationScheduleParamSchema,
  updateOrganizationScheduleSchema,
} from "../validator/organizationSchedule";

const orgRouter = Router();

orgRouter.get(
  "/",
  requirePermission(MenuCode.ORGANIZATION, Action.VIEW),
  getAllOrg,
);
orgRouter.post(
  "/",
  requirePermission(MenuCode.ORGANIZATION, Action.CREATE),
  payloadSchema,
  validateRequest,
  createOrg,
);
orgRouter.put(
  "/:id",
  requirePermission(MenuCode.ORGANIZATION, Action.UPDATE),
  editOrganization,
);
orgRouter.get(
  "/:id/schedule",
  validate(organizationScheduleParamSchema),
  requirePermission(MenuCode.ORGANIZATION, Action.VIEW),
  getOrganizationSchedule,
);
orgRouter.put(
  "/:id/schedule",
  validate(updateOrganizationScheduleSchema),
  requirePermission(MenuCode.ORGANIZATION, Action.UPDATE),
  updateOrganizationSchedule,
);

export default orgRouter;
