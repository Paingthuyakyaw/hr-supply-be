import { Router } from "express";
import { validate } from "../validator";
import {
  createPlatformUserSchema,
  platformUserIdParamSchema,
  platformUserListSchema,
  updatePlatformUserSchema,
} from "../validator/platformUser";
import {
  createPlatformUser,
  deletePlatformUser,
  listPlatformUsers,
  updatePlatformUser,
} from "../controller/platformUser";
import { requirePlatformPermission } from "../middleware/platformPermission";
import { PlatformPermission } from "../generated/prisma/enums";

const adminPlatformUserRouter = Router();

adminPlatformUserRouter.get(
  "/",
  validate(platformUserListSchema),
  requirePlatformPermission(PlatformPermission.APPROVAL_VIEW),
  listPlatformUsers,
);

adminPlatformUserRouter.post(
  "/",
  validate(createPlatformUserSchema),
  requirePlatformPermission(PlatformPermission.APPROVAL_DECIDE),
  createPlatformUser,
);

adminPlatformUserRouter.patch(
  "/:id",
  validate(updatePlatformUserSchema),
  requirePlatformPermission(PlatformPermission.APPROVAL_DECIDE),
  updatePlatformUser,
);

adminPlatformUserRouter.delete(
  "/:id",
  validate(platformUserIdParamSchema),
  requirePlatformPermission(PlatformPermission.APPROVAL_DECIDE),
  deletePlatformUser,
);

export default adminPlatformUserRouter;
