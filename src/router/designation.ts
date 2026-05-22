import { Router } from "express";
import {
  createDesignation,
  deleteDesignation,
  getDesignationDetail,
  getDesignation,
  updateDesignation,
} from "../controller/designation";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";
import { validate } from "../validator";
import {
  createDesignationSchema,
  designationIdParamSchema,
  designationListSchema,
  updateDesignationSchema,
} from "../validator/designation";

const designationRouter = Router();

designationRouter.get(
  `/`,
  validate(designationListSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.VIEW),
  getDesignation,
);
designationRouter.get(
  `/:id`,
  validate(designationIdParamSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.VIEW),
  getDesignationDetail,
);
designationRouter.post(
  `/`,
  validate(createDesignationSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.CREATE),
  createDesignation,
);
designationRouter.put(
  `/:id`,
  validate(updateDesignationSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.UPDATE),
  updateDesignation,
);
designationRouter.delete(
  `/:id`,
  validate(designationIdParamSchema),
  requirePermission(MenuCode.EMPLOYEE, Action.DELETE),
  deleteDesignation,
);

export default designationRouter;
