import { Router } from "express";
import {
  createOrg,
  editOrganization,
  getAllOrg,
} from "../controller/organization";
import { payloadSchema } from "../validator/organization";
import { validateRequest } from "../middleware/validate";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const orgRouter = Router();

orgRouter.get("/", requirePermission(MenuCode.ORGANIZATION, Action.VIEW), getAllOrg);
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

export default orgRouter;
