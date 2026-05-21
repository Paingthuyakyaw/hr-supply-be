import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  createApproval,
  listApprovals,
} from "../controller/approval";
import {
  checkIn,
  checkOut,
  listMyAttendanceRecords,
} from "../controller/attendance";
import { validate } from "../validator";
import {
  attendanceCheckInSchema,
  attendanceCheckOutSchema,
  attendanceMyRecordListSchema,
} from "../validator/attendance";
import {
  approvalListSchema,
  createApprovalSchema,
} from "../validator/approval";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const approvalRouter = Router();
const forceRequesterRole = (req: Request, _res: Response, next: NextFunction) => {
  req.query = { ...req.query, role: "requester" };
  return next();
};

approvalRouter.post(
  "/check-in",
  validate(attendanceCheckInSchema),
  requirePermission(MenuCode.ATTENDANCE, Action.CREATE),
  checkIn,
);

approvalRouter.post(
  "/check-out",
  validate(attendanceCheckOutSchema),
  requirePermission(MenuCode.ATTENDANCE, Action.UPDATE),
  checkOut,
);

approvalRouter.get(
  "/records",
  validate(attendanceMyRecordListSchema),
  requirePermission(MenuCode.ATTENDANCE, Action.VIEW),
  listMyAttendanceRecords,
);

approvalRouter.get(
  "/",
  forceRequesterRole,
  validate(approvalListSchema),
  requirePermission(MenuCode.ATTENDANCE, Action.VIEW),
  listApprovals,
);

approvalRouter.post(
  "/",
  validate(createApprovalSchema),
  requirePermission(MenuCode.ATTENDANCE, Action.CREATE),
  createApproval,
);

export default approvalRouter;
