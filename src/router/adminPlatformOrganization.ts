import { Router } from "express";
import { validate } from "../validator";
import { requirePlatformPermission } from "../middleware/platformPermission";
import { PlatformPermission } from "../generated/prisma/enums";
import { approveOrganizationAndSendSetup } from "../controller/platformOrganization";
import { approveOrganizationSchema } from "../validator/platformOrganization";

const adminPlatformOrganizationRouter = Router();

adminPlatformOrganizationRouter.post(
  "/:id/approve",
  validate(approveOrganizationSchema),
  requirePlatformPermission(PlatformPermission.APPROVAL_DECIDE),
  approveOrganizationAndSendSetup,
);

export default adminPlatformOrganizationRouter;
