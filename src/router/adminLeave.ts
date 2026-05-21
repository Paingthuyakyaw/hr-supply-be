import { Router } from "express";
import {
  createHoliday,
  createLeaveType,
  decideLeaveRequest,
  listHolidays,
  listLeaveRequestsAdmin,
  listLeaveTypes,
  runLeaveCarryForward,
  updateLeaveType,
} from "../controller/leave";
import { validate } from "../validator";
import {
  holidayCreateSchema,
  holidayListSchema,
  leaveCarryForwardSchema,
  leaveDecisionSchema,
  leaveRequestAdminListSchema,
  leaveTypeCreateSchema,
  leaveTypeUpdateSchema,
} from "../validator/leave";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const adminLeaveRouter = Router();

adminLeaveRouter.get(
  "/types",
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.VIEW),
  listLeaveTypes,
);

adminLeaveRouter.post(
  "/types",
  validate(leaveTypeCreateSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.CREATE),
  createLeaveType,
);

adminLeaveRouter.patch(
  "/types/:id",
  validate(leaveTypeUpdateSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.UPDATE),
  updateLeaveType,
);

adminLeaveRouter.get(
  "/holidays",
  validate(holidayListSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.VIEW),
  listHolidays,
);

adminLeaveRouter.post(
  "/holidays",
  validate(holidayCreateSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.CREATE),
  createHoliday,
);

adminLeaveRouter.get(
  "/requests",
  validate(leaveRequestAdminListSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.VIEW),
  listLeaveRequestsAdmin,
);

adminLeaveRouter.post(
  "/requests/:id/decision",
  validate(leaveDecisionSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.UPDATE),
  decideLeaveRequest,
);

adminLeaveRouter.post(
  "/carry-forward",
  validate(leaveCarryForwardSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.UPDATE),
  runLeaveCarryForward,
);

export default adminLeaveRouter;
