import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { WeekDay, type OrganizationStatus } from "../generated/prisma/enums";
import { formatCode } from "../utils/format";
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

const ALL_WEEK_DAYS: WeekDay[] = [
  WeekDay.MON,
  WeekDay.TUE,
  WeekDay.WED,
  WeekDay.THU,
  WeekDay.FRI,
  WeekDay.SAT,
  WeekDay.SUN,
];

export const getAllOrg = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const page = Number(req.query.page ?? 1);
    const size = Number(req.query.size ?? 20);
    const q = String(req.query.q ?? "").trim();
    const status =
      (req.query.status as OrganizationStatus | undefined) ?? undefined;

    const where = {
      id: user.orgId,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          total_employees: true,
          status: true,
          expire_time: true,
          code: true,
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { id: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
    ]);

    return sendSuccess(res, {
      message: "Organization Fetched",
      data: items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (err) {
    return sendError(res, {
      message: "Something Wrong",
      error: err,
    });
  }
};

export const createOrg = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const v = (req as any).validated ?? req.body;

    const totalEmployees =
      typeof v.total_employees !== "undefined"
        ? Number(v.total_employees)
        : typeof v.total_employment !== "undefined"
          ? Number(v.total_employment)
          : undefined;

    const data = await prisma.$transaction(async (tx) => {
      const counter = await tx.codeCounter.upsert({
        where: { key: "Organization" },
        create: { key: "Organization", value: 1 },
        update: { value: { increment: 1 } },
      });

      return await tx.organization.create({
        data: {
          name: v.name,
          code: formatCode("ORG", counter.value),
          total_employees: totalEmployees ?? 0,
          status: v.status,
          expire_time: v.expire_time ?? undefined,
          planId: v.planId,
        },
      });
    });
    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "organization",
      entityId: data.id,
      action: "CREATE",
      changes: {
        status: data.status,
        planId: data.planId,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Organization Created",
      data,
    });
  } catch (err) {
    return sendError(res, {
      message: "Something Wrong",
      error: err,
    });
  }
};

export const editOrganization = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const { id } = req.params;
    const { name, total_employees, status, expire_time, planId } = req.body;
    const orgId = Number(id);
    if (!Number.isFinite(orgId)) {
      return sendError(res, {
        status: 400,
        message: "Invalid organization id",
      });
    }
    if (orgId !== user.orgId) {
      return sendError(res, {
        status: 404,
        message: "Organization not found",
      });
    }

    const existing = await prisma.organization.findFirst({
      where: { id: orgId },
      select: { id: true, status: true, planId: true },
    });
    if (!existing) {
      return sendError(res, {
        status: 404,
        message: "Organization not found",
      });
    }

    const data = await prisma.organization.update({
      where: {
        id: orgId,
      },
      data: {
        name,
        total_employees: total_employees,
        status,
        expire_time,
        planId,
      },
    });
    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "organization",
      entityId: orgId,
      action: "UPDATE",
      changes: {
        statusBefore: existing.status,
        statusAfter: data.status,
        planIdBefore: existing.planId,
        planIdAfter: data.planId,
      },
    });

    return sendSuccess(res, {
      status: 200,
      message: "Organization Edit Successfully",
      data,
    });
  } catch (err) {
    return sendError(res, {
      message: "Something Wrong",
      error: err,
    });
  }
};

export const getOrganizationSchedule = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const orgId = Number(req.params.id);
    if (!Number.isFinite(orgId)) {
      return sendError(res, {
        status: 400,
        message: "Invalid organization id",
      });
    }
    if (orgId !== user.orgId) {
      return sendError(res, {
        status: 404,
        message: "Organization not found",
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        working_days: true,
        off_days: true,
      },
    });
    if (!org) {
      return sendError(res, {
        status: 404,
        message: "Organization not found",
      });
    }

    return sendSuccess(res, {
      message: "Organization schedule fetched",
      data: {
        organizationId: org.id,
        workingDays: org.working_days,
        offDays: org.off_days,
      },
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to fetch organization schedule",
      error,
    });
  }
};

export const updateOrganizationSchedule = async (req: Request, res: Response) => {
  try {
    const user = getUserContext(req);
    if (!user) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const orgId = Number(req.params.id);
    if (!Number.isFinite(orgId)) {
      return sendError(res, {
        status: 400,
        message: "Invalid organization id",
      });
    }
    if (orgId !== user.orgId) {
      return sendError(res, {
        status: 404,
        message: "Organization not found",
      });
    }

    const { workingDays, offDays } = req.body as {
      workingDays?: WeekDay[];
      offDays?: WeekDay[];
    };

    const resolvedWorkingDays =
      Array.isArray(workingDays) && workingDays.length
        ? workingDays
        : ALL_WEEK_DAYS.filter((day) => !(offDays ?? []).includes(day));
    const resolvedOffDays =
      Array.isArray(offDays) && offDays.length
        ? offDays
        : ALL_WEEK_DAYS.filter((day) => !resolvedWorkingDays.includes(day));

    if (!resolvedWorkingDays.length) {
      return sendError(res, {
        status: 400,
        message: "At least one working day is required",
      });
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        working_days: resolvedWorkingDays,
        off_days: resolvedOffDays,
      },
      select: {
        id: true,
        working_days: true,
        off_days: true,
      },
    });

    logAuditEvent({
      actorId: user.userId,
      actorOrgId: user.orgId,
      entity: "organization_schedule",
      entityId: updated.id,
      action: "UPDATE",
      changes: {
        workingDays: updated.working_days,
        offDays: updated.off_days,
      },
    });

    return sendSuccess(res, {
      message: "Organization schedule updated",
      data: {
        organizationId: updated.id,
        workingDays: updated.working_days,
        offDays: updated.off_days,
      },
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to update organization schedule",
      error,
    });
  }
};
