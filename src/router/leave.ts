import { Router } from "express";
import {
  cancelMyLeaveRequest,
  createLeaveRequest,
  listMyLeaveBalances,
  listMyLeaveRequests,
} from "../controller/leave";
import { validate } from "../validator";
import {
  cancelLeaveRequestSchema,
  createLeaveRequestSchema,
  leaveBalanceListSchema,
  leaveListSchema,
} from "../validator/leave";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const leaveRouter = Router();

leaveRouter.get(
  "/balances",
  validate(leaveBalanceListSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.VIEW),
  listMyLeaveBalances,
);

leaveRouter.get(
  "/requests",
  validate(leaveListSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.VIEW),
  listMyLeaveRequests,
);

leaveRouter.post(
  "/requests",
  validate(createLeaveRequestSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.CREATE),
  createLeaveRequest,
);

leaveRouter.patch(
  "/requests/:id/cancel",
  validate(cancelLeaveRequestSchema),
  requirePermission(MenuCode.LEAVE_MANGEMENT, Action.UPDATE),
  cancelMyLeaveRequest,
);

export default leaveRouter;
