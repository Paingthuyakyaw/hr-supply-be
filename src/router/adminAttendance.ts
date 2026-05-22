import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { decideApproval, listApprovals } from "../controller/approval";
import {
  createAttendanceShift,
  getAttendancePolicy,
  listAttendanceRecords,
  listAttendanceShifts,
  updateAttendanceShift,
  upsertAttendancePolicy,
} from "../controller/attendance";
import { validate } from "../validator";
import { approvalListSchema, decideApprovalSchema } from "../validator/approval";
import {
  attendancePolicySchema,
  attendanceRecordListSchema,
  attendanceShiftCreateSchema,
  attendanceShiftUpdateSchema,
} from "../validator/attendance";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode, PlatformPermission } from "../generated/prisma/enums";
import { requireOwnAdminScope } from "../middleware/scope";
import { requirePlatformPermissionIfSuperadmin } from "../middleware/platformPermission";

const adminAttendanceRouter = Router();

const forceApproverRole = (req: Request, _res: Response, next: NextFunction) => {
  req.query = { ...req.query, role: "approver" };
  return next();
};

adminAttendanceRouter.get(
  "/approvals",
  forceApproverRole,
  validate(approvalListSchema),
  requirePlatformPermissionIfSuperadmin(PlatformPermission.APPROVAL_VIEW),
  requirePermission(MenuCode.ATTENDANCE, Action.VIEW),
  listApprovals,
);

adminAttendanceRouter.post(
  "/approvals/:id/decision",
  validate(decideApprovalSchema),
  requirePlatformPermissionIfSuperadmin(PlatformPermission.APPROVAL_DECIDE),
  requirePermission(MenuCode.ATTENDANCE, Action.UPDATE),
  decideApproval,
);

adminAttendanceRouter.get(
  "/policy",
  requireOwnAdminScope,
  requirePermission(MenuCode.ATTENDANCE, Action.VIEW),
  getAttendancePolicy,
);

adminAttendanceRouter.put(
  "/policy",
  validate(attendancePolicySchema),
  requireOwnAdminScope,
  requirePermission(MenuCode.ATTENDANCE, Action.UPDATE),
  upsertAttendancePolicy,
);

adminAttendanceRouter.get(
  "/shifts",
  requireOwnAdminScope,
  requirePermission(MenuCode.ATTENDANCE, Action.VIEW),
  listAttendanceShifts,
);

adminAttendanceRouter.post(
  "/shifts",
  validate(attendanceShiftCreateSchema),
  requireOwnAdminScope,
  requirePermission(MenuCode.ATTENDANCE, Action.CREATE),
  createAttendanceShift,
);

adminAttendanceRouter.patch(
  "/shifts/:id",
  validate(attendanceShiftUpdateSchema),
  requireOwnAdminScope,
  requirePermission(MenuCode.ATTENDANCE, Action.UPDATE),
  updateAttendanceShift,
);

adminAttendanceRouter.get(
  "/records",
  validate(attendanceRecordListSchema),
  requireOwnAdminScope,
  requirePermission(MenuCode.ATTENDANCE, Action.VIEW),
  listAttendanceRecords,
);

export default adminAttendanceRouter;
