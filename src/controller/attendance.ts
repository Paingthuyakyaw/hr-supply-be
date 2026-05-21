import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import {
  AttendanceRecordState,
  AttendanceWorkStatus,
  WeekDay,
} from "../generated/prisma/enums";
import { sendError, sendSuccess } from "../utils/httpResponse";
import { logAuditEvent } from "../utils/audit";

type JwtUser = {
  sub: number;
  orgId: number;
  email: string;
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

const getUserContext = (req: Request) => {
  const user = (req as RequestWithUser).user;
  if (!user || !Number.isFinite(user.sub) || !Number.isFinite(user.orgId)) {
    return null;
  }
  return {
    userId: Number(user.sub),
    orgId: Number(user.orgId),
  };
};

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const toWorkDate = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const minutesBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60000));

const getWeekday = (date: Date): WeekDay => {
  const day = date.getUTCDay();
  const mapping: WeekDay[] = [
    WeekDay.SUN,
    WeekDay.MON,
    WeekDay.TUE,
    WeekDay.WED,
    WeekDay.THU,
    WeekDay.FRI,
    WeekDay.SAT,
  ];
  return mapping[day];
};

const buildDateWithTime = (baseDate: Date, timeDate: Date) =>
  new Date(
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      timeDate.getUTCHours(),
      timeDate.getUTCMinutes(),
      timeDate.getUTCSeconds(),
      0,
    ),
  );

export const checkIn = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const now = new Date();
    const workDate = toWorkDate(now);
    const weekday = getWeekday(now);

    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        organizationId: user.orgId,
        employeeId: user.userId,
        workDate,
      },
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        recordState: true,
      },
    });
    if (existing?.checkInAt) {
      return sendError(res, {
        status: 400,
        message: "Already checked in for today",
      });
    }

    const [policy, shift] = await Promise.all([
      prisma.attendancePolicy.findUnique({
        where: { organizationId: user.orgId },
      }),
      prisma.attendanceShift.findFirst({
        where: {
          organizationId: user.orgId,
          isActive: true,
          weekdays: { has: weekday },
        },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      }),
    ]);

    const scheduledStart = shift?.startTime ?? policy?.defaultStartTime;
    const lateGrace = shift?.lateGraceMinutes ?? policy?.lateGraceMinutes ?? 0;
    if (!scheduledStart) {
      return sendError(res, {
        status: 400,
        message: "No attendance policy or shift configured for today",
      });
    }

    const expectedCheckIn = buildDateWithTime(now, scheduledStart);
    const lateMinutes = Math.max(0, minutesBetween(expectedCheckIn, now) - lateGrace);

    const created = await prisma.attendanceRecord.create({
      data: {
        organizationId: user.orgId,
        employeeId: user.userId,
        shiftId: shift?.id,
        workDate,
        checkInAt: now,
        lateMinutes,
        recordState: AttendanceRecordState.OPEN,
        status: AttendanceWorkStatus.PRESENT,
        notes: typeof req.body?.notes === "string" ? req.body.notes : undefined,
      },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "attendance_record",
      entityId: created.id,
      action: "CREATE",
      changes: {
        event: "check_in",
        workDate: created.workDate,
        shiftId: created.shiftId,
        lateMinutes: created.lateMinutes,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Checked in successfully",
      data: created,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to check in",
      error,
    });
  }
};

export const checkOut = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const now = new Date();
    const openRecord = await prisma.attendanceRecord.findFirst({
      where: {
        organizationId: user.orgId,
        employeeId: user.userId,
        recordState: AttendanceRecordState.OPEN,
      },
      orderBy: { id: "desc" },
      include: {
        shift: true,
      },
    });

    if (!openRecord || !openRecord.checkInAt) {
      return sendError(res, { status: 400, message: "No active check-in found" });
    }

    const policy = await prisma.attendancePolicy.findUnique({
      where: { organizationId: user.orgId },
    });

    const scheduledEnd = openRecord.shift?.endTime ?? policy?.defaultEndTime;
    const earlyGrace =
      openRecord.shift?.earlyLeaveGraceMinutes ??
      policy?.earlyLeaveGraceMinutes ??
      0;
    const minHalfDayMinutes = policy?.minHalfDayMinutes ?? 240;

    const workedMinutes = minutesBetween(openRecord.checkInAt, now);
    const expectedCheckOut = scheduledEnd ? buildDateWithTime(now, scheduledEnd) : null;
    const earlyLeaveMinutes = expectedCheckOut
      ? Math.max(0, minutesBetween(now, expectedCheckOut) - earlyGrace)
      : 0;

    const status =
      workedMinutes < minHalfDayMinutes
        ? AttendanceWorkStatus.HALF_DAY
        : AttendanceWorkStatus.PRESENT;

    const updated = await prisma.attendanceRecord.update({
      where: { id: openRecord.id },
      data: {
        checkOutAt: now,
        workedMinutes,
        earlyLeaveMinutes,
        status,
        recordState: AttendanceRecordState.CLOSED,
        notes:
          typeof req.body?.notes === "string"
            ? req.body.notes
            : openRecord.notes ?? undefined,
      },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "attendance_record",
      entityId: updated.id,
      action: "UPDATE",
      changes: {
        event: "check_out",
        workedMinutes: updated.workedMinutes,
        earlyLeaveMinutes: updated.earlyLeaveMinutes,
        status: updated.status,
      },
    });

    return sendSuccess(res, {
      message: "Checked out successfully",
      data: updated,
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to check out",
      error,
    });
  }
};

export const listMyAttendanceRecords = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);

    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const state = req.query.state as AttendanceRecordState | undefined;

    const where = {
      organizationId: user.orgId,
      employeeId: user.userId,
      ...(state ? { recordState: state } : {}),
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        include: {
          shift: {
            select: {
              id: true,
              name: true,
              weekdays: true,
            },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Attendance records fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch attendance records", error });
  }
};

export const getAttendancePolicy = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const policy = await prisma.attendancePolicy.findUnique({
      where: { organizationId: user.orgId },
    });

    return sendSuccess(res, {
      message: "Attendance policy fetched",
      data: policy,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch attendance policy", error });
  }
};

export const upsertAttendancePolicy = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const {
      defaultStartTime,
      defaultEndTime,
      lateGraceMinutes,
      earlyLeaveGraceMinutes,
      minHalfDayMinutes,
    } = req.body as {
      defaultStartTime: string;
      defaultEndTime: string;
      lateGraceMinutes: number;
      earlyLeaveGraceMinutes: number;
      minHalfDayMinutes: number;
    };

    const parseTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);

    const policy = await prisma.attendancePolicy.upsert({
      where: { organizationId: user.orgId },
      update: {
        defaultStartTime: parseTime(defaultStartTime),
        defaultEndTime: parseTime(defaultEndTime),
        lateGraceMinutes,
        earlyLeaveGraceMinutes,
        minHalfDayMinutes,
      },
      create: {
        organizationId: user.orgId,
        defaultStartTime: parseTime(defaultStartTime),
        defaultEndTime: parseTime(defaultEndTime),
        lateGraceMinutes,
        earlyLeaveGraceMinutes,
        minHalfDayMinutes,
      },
    });

    return sendSuccess(res, {
      message: "Attendance policy saved",
      data: policy,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to save attendance policy", error });
  }
};

export const listAttendanceShifts = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const items = await prisma.attendanceShift.findMany({
      where: { organizationId: user.orgId },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    });

    return sendSuccess(res, {
      message: "Attendance shifts fetched",
      data: items,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch attendance shifts", error });
  }
};

export const createAttendanceShift = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const {
      name,
      weekdays,
      startTime,
      endTime,
      lateGraceMinutes,
      earlyLeaveGraceMinutes,
      isActive,
      isDefault,
    } = req.body as {
      name: string;
      weekdays: WeekDay[];
      startTime: string;
      endTime: string;
      lateGraceMinutes?: number;
      earlyLeaveGraceMinutes?: number;
      isActive?: boolean;
      isDefault?: boolean;
    };

    const parseTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.attendanceShift.updateMany({
          where: { organizationId: user.orgId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.attendanceShift.create({
        data: {
          organizationId: user.orgId,
          name,
          weekdays,
          startTime: parseTime(startTime),
          endTime: parseTime(endTime),
          lateGraceMinutes: lateGraceMinutes ?? 10,
          earlyLeaveGraceMinutes: earlyLeaveGraceMinutes ?? 10,
          isActive: typeof isActive === "boolean" ? isActive : true,
          isDefault: typeof isDefault === "boolean" ? isDefault : false,
        },
      });
    });

    return sendSuccess(res, {
      status: 201,
      message: "Attendance shift created",
      data: created,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to create attendance shift", error });
  }
};

export const updateAttendanceShift = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const shiftId = Number(req.params.id);
    if (!Number.isFinite(shiftId)) {
      return sendError(res, { status: 400, message: "Invalid shift id" });
    }

    const exists = await prisma.attendanceShift.findFirst({
      where: { id: shiftId, organizationId: user.orgId },
      select: { id: true },
    });
    if (!exists) {
      return sendError(res, { status: 404, message: "Shift not found" });
    }

    const {
      name,
      weekdays,
      startTime,
      endTime,
      lateGraceMinutes,
      earlyLeaveGraceMinutes,
      isActive,
      isDefault,
    } = req.body as {
      name?: string;
      weekdays?: WeekDay[];
      startTime?: string;
      endTime?: string;
      lateGraceMinutes?: number;
      earlyLeaveGraceMinutes?: number;
      isActive?: boolean;
      isDefault?: boolean;
    };

    const parseTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.attendanceShift.updateMany({
          where: { organizationId: user.orgId, isDefault: true, id: { not: shiftId } },
          data: { isDefault: false },
        });
      }

      return tx.attendanceShift.update({
        where: { id: shiftId },
        data: {
          ...(typeof name !== "undefined" ? { name } : {}),
          ...(typeof weekdays !== "undefined" ? { weekdays } : {}),
          ...(typeof startTime !== "undefined"
            ? { startTime: parseTime(startTime) }
            : {}),
          ...(typeof endTime !== "undefined" ? { endTime: parseTime(endTime) } : {}),
          ...(typeof lateGraceMinutes !== "undefined" ? { lateGraceMinutes } : {}),
          ...(typeof earlyLeaveGraceMinutes !== "undefined"
            ? { earlyLeaveGraceMinutes }
            : {}),
          ...(typeof isActive !== "undefined" ? { isActive } : {}),
          ...(typeof isDefault !== "undefined" ? { isDefault } : {}),
        },
      });
    });

    return sendSuccess(res, {
      message: "Attendance shift updated",
      data: updated,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to update attendance shift", error });
  }
};

export const listAttendanceRecords = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const employeeId = req.query.employeeId
      ? Number(req.query.employeeId)
      : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const state = req.query.state as AttendanceRecordState | undefined;

    const where = {
      organizationId: user.orgId,
      ...(Number.isFinite(employeeId) ? { employeeId } : {}),
      ...(state ? { recordState: state } : {}),
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              code: true,
            },
          },
          shift: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Attendance records fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch attendance records", error });
  }
};
