import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { Action, OrganizationStatus, WeekDay } from "../generated/prisma/enums";
import { formatCode } from "../utils/format";
import { sendError, sendSuccess } from "../utils/httpResponse";
import { logAuditEvent } from "../utils/audit";

type JwtUser = {
  sub: number;
  orgId?: number;
  adminScope?: "OWN_ADMIN" | "SUPERADMIN";
  actorType?: "employee" | "platform";
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

const SYSTEM_DEFAULT_WORKING_DAYS: WeekDay[] = [
  WeekDay.MON,
  WeekDay.TUE,
  WeekDay.WED,
  WeekDay.THU,
  WeekDay.FRI,
];
const DEFAULT_DEPARTMENT_NAME = "Administration";
const DEFAULT_DESIGNATION_NAME = "Org Admin";

const getActor = (req: Request) => {
  const user = (req as RequestWithUser).user;
  if (!user || !Number.isFinite(user.sub)) return null;
  return {
    userId: Number(user.sub),
    orgId: Number(user.orgId ?? 0),
    actorType:
      user.adminScope === "SUPERADMIN" && user.actorType === "platform"
        ? ("SUPERADMIN" as const)
        : ("ORG_USER" as const),
  };
};

const parseIdParam = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const randomPasswordHash = async () => {
  const raw = randomBytes(16).toString("base64url");
  return bcrypt.hash(raw, 10);
};

export const approveOrganizationAndSendSetup = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = getActor(req);
    if (!actor) return sendError(res, { status: 401, message: "Unauthorized" });

    const organizationId = parseIdParam(req.params.id as any);
    if (!organizationId) {
      return sendError(res, {
        status: 400,
        message: "Invalid organization id",
      });
    }

    const { ownerEmail, ownerName } = req.body as {
      ownerEmail?: string;
      ownerName?: string;
    };

    const existingOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, ownerEmail: true, status: true },
    });
    if (!existingOrg) {
      return sendError(res, { status: 404, message: "Organization not found" });
    }

    const normalizedEmail = (ownerEmail ?? existingOrg.ownerEmail ?? "")
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      return sendError(res, {
        status: 400,
        message: "ownerEmail is required to send setup link",
      });
    }

    const existingEmailInOtherOrg = await prisma.employee.findFirst({
      where: {
        email: normalizedEmail,
        organizationId: { not: organizationId },
      },
      select: { id: true },
    });
    if (existingEmailInOtherOrg) {
      return sendError(res, {
        status: 409,
        message: "ownerEmail is already used by another organization",
      });
    }

    const adminDisplayName = (ownerName ?? "Organization Admin").trim();
    const defaultStartTime = new Date("1970-01-01T09:00:00.000Z");
    const defaultEndTime = new Date("1970-01-01T18:00:00.000Z");

    const { organization, employee } = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: {
          ownerEmail: normalizedEmail,
          status: OrganizationStatus.APPROVED,
        },
        select: { id: true, name: true, ownerEmail: true, status: true },
      });

      const department =
        (await tx.department.findFirst({
          where: { organizationId, name: DEFAULT_DEPARTMENT_NAME },
          select: { id: true },
        })) ??
        (await tx.department.create({
          data: {
            name: DEFAULT_DEPARTMENT_NAME,
            is_active: true,
            employee_count: 0,
            location: "Head Office",
            startTime: defaultStartTime,
            endTime: defaultEndTime,
            working_days: [...SYSTEM_DEFAULT_WORKING_DAYS],
            organizationId,
          },
          select: { id: true },
        }));

      const existingEmployee = await tx.employee.findFirst({
        where: { organizationId, email: normalizedEmail },
        select: { id: true, code: true, email: true, full_name: true },
      });

      const employee =
        existingEmployee ??
        (await (async () => {
          const employeeCounter = await tx.codeCounter.upsert({
            where: { key: "Employee" },
            create: { key: "Employee", value: 1 },
            update: { value: { increment: 1 } },
          });
          return tx.employee.create({
            data: {
              full_name: adminDisplayName,
              code: formatCode("EMP", employeeCounter.value),
              email: normalizedEmail,
              password: await randomPasswordHash(),
              location: "Head Office",
              organizationId,
              department_id: department.id,
            },
            select: { id: true, code: true, email: true, full_name: true },
          });
        })());

      const designation = await tx.designation.upsert({
        where: {
          organizationId_name: {
            organizationId,
            name: DEFAULT_DESIGNATION_NAME,
          },
        },
        update: {},
        create: {
          organizationId,
          name: DEFAULT_DESIGNATION_NAME,
        },
        select: { id: true },
      });

      const menus = await tx.menu.findMany({ select: { id: true } });
      for (const menu of menus) {
        await tx.designationOnMenu.upsert({
          where: {
            designationId_menuId: {
              designationId: designation.id,
              menuId: menu.id,
            },
          },
          update: {
            actions: [Action.CREATE, Action.VIEW, Action.UPDATE, Action.DELETE],
          },
          create: {
            designationId: designation.id,
            menuId: menu.id,
            actions: [Action.CREATE, Action.VIEW, Action.UPDATE, Action.DELETE],
          },
        });
      }

      await tx.designationOnEmployee.upsert({
        where: {
          designationId_employeeId: {
            designationId: designation.id,
            employeeId: employee.id,
          },
        },
        update: {},
        create: {
          designationId: designation.id,
          employeeId: employee.id,
        },
      });

      return { organization, employee };
    });

    logAuditEvent({
      actorId: actor.userId,
      actorOrgId: actor.orgId,
      actorType: actor.actorType,
      targetOrganizationId: organization.id,
      entity: "organization",
      entityId: organization.id,
      action: "UPDATE",
      changes: {
        statusBefore: existingOrg.status,
        statusAfter: organization.status,
        ownerEmail: normalizedEmail,
        bootstrapEmployeeId: employee.id,
      },
    });

    return sendSuccess(res, {
      message: "Organization approved",
      data: {
        organizationId: organization.id,
        status: organization.status,
        ownerEmail: normalizedEmail,
        ownerEmployeeId: employee.id,
      },
    });
  } catch (error) {
    return sendError(res, {
      message: "Failed to approve organization",
      error,
    });
  }
};
