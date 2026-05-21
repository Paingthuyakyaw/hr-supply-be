import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { LeaveRequestStatus, WeekDay } from "../generated/prisma/enums";
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

const parseUtcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

const toDateOnly = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const weekDayFromDate = (value: Date): WeekDay => {
  const map: WeekDay[] = [
    WeekDay.SUN,
    WeekDay.MON,
    WeekDay.TUE,
    WeekDay.WED,
    WeekDay.THU,
    WeekDay.FRI,
    WeekDay.SAT,
  ];
  return map[value.getUTCDay()];
};

const countBusinessDays = ({
  startDate,
  endDate,
  offDays,
  holidaySet,
}: {
  startDate: Date;
  endDate: Date;
  offDays: WeekDay[];
  holidaySet: Set<string>;
}) => {
  let count = 0;
  let cursor = toDateOnly(startDate);
  const end = toDateOnly(endDate);

  while (cursor.getTime() <= end.getTime()) {
    const key = toDateKey(cursor);
    const isOffDay = offDays.includes(weekDayFromDate(cursor));
    const isHoliday = holidaySet.has(key);
    if (!isOffDay && !isHoliday) {
      count += 1;
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return count;
};

const ensureBalanceForYear = async ({
  tx,
  orgId,
  employeeId,
  leaveTypeId,
  year,
  annualQuotaDays,
}: {
  tx: any;
  orgId: number;
  employeeId: number;
  leaveTypeId: number;
  year: number;
  annualQuotaDays: number;
}) => {
  const exists = await tx.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
  });
  if (exists) return exists;

  return tx.leaveBalance.create({
    data: {
      organizationId: orgId,
      employeeId,
      leaveTypeId,
      year,
      entitledDays: annualQuotaDays,
      carriedDays: 0,
      usedDays: 0,
      remainingDays: annualQuotaDays,
    },
  });
};

export const listMyLeaveBalances = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const year = Number(req.query.year ?? new Date().getUTCFullYear());
    const balances = await prisma.leaveBalance.findMany({
      where: {
        organizationId: user.orgId,
        employeeId: user.userId,
        year,
      },
      include: {
        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
            annualQuotaDays: true,
            carryForwardLimit: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    return sendSuccess(res, {
      message: "Leave balances fetched",
      data: balances,
      meta: { year },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch leave balances", error });
  }
};

export const listMyLeaveRequests = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const status = req.query.status as LeaveRequestStatus | undefined;

    const where = {
      organizationId: user.orgId,
      employeeId: user.userId,
      ...(status ? { status } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        orderBy: [{ id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        include: {
          leaveType: {
            select: { id: true, code: true, name: true },
          },
          reviewedBy: {
            select: { id: true, full_name: true, code: true },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Leave requests fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch leave requests", error });
  }
};

export const createLeaveRequest = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const { leaveTypeId, startDate, endDate, reason } = req.body as {
      leaveTypeId: number;
      startDate: string;
      endDate: string;
      reason?: string;
    };

    const start = parseUtcDate(startDate);
    const end = parseUtcDate(endDate);
    if (start.getTime() > end.getTime()) {
      return sendError(res, { status: 400, message: "startDate must be <= endDate" });
    }

    const [leaveType, org, holidays, overlapping] = await Promise.all([
      prisma.leaveType.findFirst({
        where: {
          id: leaveTypeId,
          organizationId: user.orgId,
          isActive: true,
        },
      }),
      prisma.organization.findUnique({
        where: { id: user.orgId },
        select: { off_days: true },
      }),
      prisma.holidayCalendar.findMany({
        where: {
          organizationId: user.orgId,
          date: {
            gte: start,
            lte: end,
          },
        },
        select: { date: true },
      }),
      prisma.leaveRequest.findFirst({
        where: {
          organizationId: user.orgId,
          employeeId: user.userId,
          status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { id: true },
      }),
    ]);

    if (!leaveType) {
      return sendError(res, { status: 404, message: "Leave type not found" });
    }
    if (!org) {
      return sendError(res, { status: 404, message: "Organization not found" });
    }
    if (overlapping) {
      return sendError(res, {
        status: 400,
        message: "Leave request overlaps with existing request",
      });
    }

    const holidaySet = new Set(holidays.map((item) => toDateKey(item.date)));
    const totalDays = countBusinessDays({
      startDate: start,
      endDate: end,
      offDays: org.off_days,
      holidaySet,
    });
    if (totalDays <= 0) {
      return sendError(res, {
        status: 400,
        message: "No leave days available for selected range",
      });
    }

    const year = start.getUTCFullYear();

    const created = await prisma.$transaction(async (tx) => {
      const balance = await ensureBalanceForYear({
        tx,
        orgId: user.orgId,
        employeeId: user.userId,
        leaveTypeId: leaveType.id,
        year,
        annualQuotaDays: leaveType.annualQuotaDays,
      });

      if (!leaveType.requiresApproval && balance.remainingDays < totalDays) {
        throw new Error("Insufficient leave balance");
      }

      const status = leaveType.requiresApproval
        ? LeaveRequestStatus.PENDING
        : LeaveRequestStatus.APPROVED;

      const requestRow = await tx.leaveRequest.create({
        data: {
          organizationId: user.orgId,
          employeeId: user.userId,
          leaveTypeId: leaveType.id,
          startDate: start,
          endDate: end,
          totalDays,
          reason,
          status,
          reviewedById: leaveType.requiresApproval ? null : user.userId,
          reviewedAt: leaveType.requiresApproval ? null : new Date(),
          reviewComment: leaveType.requiresApproval ? null : "Auto-approved by policy",
        },
        include: {
          leaveType: { select: { id: true, code: true, name: true } },
        },
      });

      if (!leaveType.requiresApproval) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: { increment: totalDays },
            remainingDays: { decrement: totalDays },
          },
        });
      }

      return requestRow;
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "leave_request",
      entityId: created.id,
      action: "CREATE",
      changes: {
        leaveTypeId,
        totalDays,
        status: created.status,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Leave request created",
      data: created,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "Insufficient leave balance") {
      return sendError(res, { status: 400, message: error.message });
    }
    return sendError(res, { message: "Failed to create leave request", error });
  }
};

export const cancelMyLeaveRequest = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid leave request id" });
    }

    const requestRow = await prisma.leaveRequest.findFirst({
      where: {
        id,
        organizationId: user.orgId,
        employeeId: user.userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!requestRow) {
      return sendError(res, { status: 404, message: "Leave request not found" });
    }
    if (requestRow.status !== LeaveRequestStatus.PENDING) {
      return sendError(res, {
        status: 400,
        message: "Only pending requests can be cancelled",
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.CANCELLED,
      },
    });

    return sendSuccess(res, {
      message: "Leave request cancelled",
      data: updated,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to cancel leave request", error });
  }
};

export const listLeaveTypes = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const items = await prisma.leaveType.findMany({
      where: { organizationId: user.orgId },
      orderBy: [{ isActive: "desc" }, { id: "asc" }],
    });

    return sendSuccess(res, {
      message: "Leave types fetched",
      data: items,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch leave types", error });
  }
};

export const createLeaveType = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const data = req.body as {
      code: string;
      name: string;
      annualQuotaDays: number;
      carryForwardLimit: number;
      requiresApproval?: boolean;
      isActive?: boolean;
    };

    const created = await prisma.leaveType.create({
      data: {
        organizationId: user.orgId,
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        annualQuotaDays: data.annualQuotaDays,
        carryForwardLimit: data.carryForwardLimit,
        requiresApproval:
          typeof data.requiresApproval === "boolean" ? data.requiresApproval : true,
        isActive: typeof data.isActive === "boolean" ? data.isActive : true,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Leave type created",
      data: created,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to create leave type", error });
  }
};

export const updateLeaveType = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid leave type id" });
    }

    const exists = await prisma.leaveType.findFirst({
      where: { id, organizationId: user.orgId },
      select: { id: true },
    });
    if (!exists) {
      return sendError(res, { status: 404, message: "Leave type not found" });
    }

    const body = req.body as {
      name?: string;
      annualQuotaDays?: number;
      carryForwardLimit?: number;
      requiresApproval?: boolean;
      isActive?: boolean;
    };

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(typeof body.name !== "undefined" ? { name: body.name.trim() } : {}),
        ...(typeof body.annualQuotaDays !== "undefined"
          ? { annualQuotaDays: body.annualQuotaDays }
          : {}),
        ...(typeof body.carryForwardLimit !== "undefined"
          ? { carryForwardLimit: body.carryForwardLimit }
          : {}),
        ...(typeof body.requiresApproval !== "undefined"
          ? { requiresApproval: body.requiresApproval }
          : {}),
        ...(typeof body.isActive !== "undefined" ? { isActive: body.isActive } : {}),
      },
    });

    return sendSuccess(res, {
      message: "Leave type updated",
      data: updated,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to update leave type", error });
  }
};

export const listHolidays = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const year = Number(req.query.year ?? new Date().getUTCFullYear());
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31));

    const items = await prisma.holidayCalendar.findMany({
      where: {
        organizationId: user.orgId,
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    return sendSuccess(res, {
      message: "Holidays fetched",
      data: items,
      meta: { year },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch holidays", error });
  }
};

export const createHoliday = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const { date, name, isOptional } = req.body as {
      date: string;
      name: string;
      isOptional?: boolean;
    };

    const created = await prisma.holidayCalendar.create({
      data: {
        organizationId: user.orgId,
        date: parseUtcDate(date),
        name: name.trim(),
        isOptional: typeof isOptional === "boolean" ? isOptional : false,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Holiday created",
      data: created,
    });
  } catch (error) {
    return sendError(res, { message: "Failed to create holiday", error });
  }
};

export const listLeaveRequestsAdmin = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const status = req.query.status as LeaveRequestStatus | undefined;
    const employeeId = req.query.employeeId
      ? Number(req.query.employeeId)
      : undefined;

    const where = {
      organizationId: user.orgId,
      ...(status ? { status } : {}),
      ...(Number.isFinite(employeeId) ? { employeeId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        orderBy: [{ id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        include: {
          employee: {
            select: { id: true, full_name: true, code: true },
          },
          leaveType: {
            select: { id: true, code: true, name: true },
          },
          reviewedBy: {
            select: { id: true, full_name: true, code: true },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Leave requests fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch leave requests", error });
  }
};

export const decideLeaveRequest = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid leave request id" });
    }

    const { decision, comment } = req.body as {
      decision: "APPROVE" | "REJECT";
      comment?: string;
    };

    const requestRow = await prisma.leaveRequest.findFirst({
      where: {
        id,
        organizationId: user.orgId,
      },
      include: {
        leaveType: true,
      },
    });
    if (!requestRow) {
      return sendError(res, { status: 404, message: "Leave request not found" });
    }
    if (requestRow.status !== LeaveRequestStatus.PENDING) {
      return sendError(res, {
        status: 400,
        message: "Leave request is already finalized",
      });
    }

    const year = requestRow.startDate.getUTCFullYear();

    const updated = await prisma.$transaction(async (tx) => {
      const nextStatus =
        decision === "APPROVE"
          ? LeaveRequestStatus.APPROVED
          : LeaveRequestStatus.REJECTED;

      if (decision === "APPROVE") {
        const balance = await ensureBalanceForYear({
          tx,
          orgId: user.orgId,
          employeeId: requestRow.employeeId,
          leaveTypeId: requestRow.leaveTypeId,
          year,
          annualQuotaDays: requestRow.leaveType.annualQuotaDays,
        });
        if (balance.remainingDays < requestRow.totalDays) {
          throw new Error("Insufficient leave balance");
        }

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: { increment: requestRow.totalDays },
            remainingDays: { decrement: requestRow.totalDays },
          },
        });
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          reviewedById: user.userId,
          reviewedAt: new Date(),
          reviewComment: comment,
        },
        include: {
          employee: { select: { id: true, full_name: true, code: true } },
          leaveType: { select: { id: true, code: true, name: true } },
          reviewedBy: { select: { id: true, full_name: true, code: true } },
        },
      });
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "leave_request",
      entityId: id,
      action: "UPDATE",
      changes: {
        decision,
        statusAfter: updated.status,
      },
    });

    return sendSuccess(res, {
      message: "Leave request decision applied",
      data: updated,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "Insufficient leave balance") {
      return sendError(res, { status: 400, message: error.message });
    }
    return sendError(res, { message: "Failed to decide leave request", error });
  }
};

export const runLeaveCarryForward = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) return sendError(res, { status: 401, message: "Unauthorized" });

    const fromYear = Number(req.body?.fromYear ?? new Date().getUTCFullYear() - 1);
    const toYear = fromYear + 1;

    const balances = await prisma.leaveBalance.findMany({
      where: {
        organizationId: user.orgId,
        year: fromYear,
      },
      include: {
        leaveType: {
          select: {
            id: true,
            annualQuotaDays: true,
            carryForwardLimit: true,
          },
        },
      },
    });

    let processed = 0;
    await prisma.$transaction(async (tx) => {
      for (const balance of balances) {
        const carry = Math.min(
          Math.max(balance.remainingDays, 0),
          balance.leaveType.carryForwardLimit,
        );

        await tx.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: balance.employeeId,
              leaveTypeId: balance.leaveTypeId,
              year: toYear,
            },
          },
          update: {
            entitledDays: balance.leaveType.annualQuotaDays,
            carriedDays: carry,
            usedDays: 0,
            remainingDays: balance.leaveType.annualQuotaDays + carry,
          },
          create: {
            organizationId: user.orgId,
            employeeId: balance.employeeId,
            leaveTypeId: balance.leaveTypeId,
            year: toYear,
            entitledDays: balance.leaveType.annualQuotaDays,
            carriedDays: carry,
            usedDays: 0,
            remainingDays: balance.leaveType.annualQuotaDays + carry,
          },
        });
        processed += 1;
      }
    });

    return sendSuccess(res, {
      message: "Leave carry-forward completed",
      data: {
        fromYear,
        toYear,
        processed,
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to run carry-forward", error });
  }
};
