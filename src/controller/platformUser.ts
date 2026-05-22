import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../lib/prisma";
import { sendError, sendSuccess } from "../utils/httpResponse";
import { logAuditEvent } from "../utils/audit";

type JwtUser = {
  sub: number;
  orgId: number;
  adminScope?: "OWN_ADMIN" | "SUPERADMIN";
  actorType?: "employee" | "platform";
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

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

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const toSafePlatformUser = (row: {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: row.id,
  email: row.email,
  fullName: row.fullName,
  isActive: row.isActive,
  permissions: row.permissions,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const listPlatformUsers = async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    if (!actor) return sendError(res, { status: 401, message: "Unauthorized" });

    const page = parsePage(req.query.page, 1);
    const size = Math.min(parsePage(req.query.size, 20), 100);
    const q = String(req.query.q ?? "").trim();
    const isActiveRaw = req.query.isActive;
    const isActive =
      typeof isActiveRaw !== "undefined" ? String(isActiveRaw) === "true" : undefined;

    const where = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { fullName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.platformUser.count({ where }),
      prisma.platformUser.findMany({
        where,
        orderBy: [{ id: "desc" }],
        skip: (page - 1) * size,
        take: size,
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return sendSuccess(res, {
      message: "Platform users fetched",
      data: rows.map(toSafePlatformUser),
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to fetch platform users", error });
  }
};

export const createPlatformUser = async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    if (!actor) return sendError(res, { status: 401, message: "Unauthorized" });

    const { email, fullName, password, isActive, permissions } = req.body as {
      email: string;
      fullName: string;
      password: string;
      isActive?: boolean;
      permissions: string[];
    };

    const exists = await prisma.platformUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) {
      return sendError(res, { status: 409, message: "Platform user email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.platformUser.create({
      data: {
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        password: passwordHash,
        isActive: typeof isActive === "boolean" ? isActive : true,
        permissions: permissions as any,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logAuditEvent({
      actorId: actor.userId,
      actorOrgId: actor.orgId,
      actorType: actor.actorType,
      entity: "platform_user",
      entityId: created.id,
      action: "CREATE",
      changes: {
        email: created.email,
        isActive: created.isActive,
        permissions: created.permissions,
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Platform user created",
      data: toSafePlatformUser(created),
    });
  } catch (error) {
    return sendError(res, { message: "Failed to create platform user", error });
  }
};

export const updatePlatformUser = async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    if (!actor) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid platform user id" });
    }

    const existing = await prisma.platformUser.findUnique({
      where: { id },
      select: { id: true, isActive: true, permissions: true },
    });
    if (!existing) {
      return sendError(res, { status: 404, message: "Platform user not found" });
    }

    const { fullName, password, isActive, permissions } = req.body as {
      fullName?: string;
      password?: string;
      isActive?: boolean;
      permissions?: string[];
    };

    const nextData: Record<string, unknown> = {};
    if (typeof fullName !== "undefined") nextData.fullName = fullName.trim();
    if (typeof isActive !== "undefined") nextData.isActive = isActive;
    if (typeof permissions !== "undefined") nextData.permissions = permissions as any;
    if (typeof password !== "undefined") {
      nextData.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.platformUser.update({
      where: { id },
      data: nextData,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logAuditEvent({
      actorId: actor.userId,
      actorOrgId: actor.orgId,
      actorType: actor.actorType,
      entity: "platform_user",
      entityId: updated.id,
      action: "UPDATE",
      changes: {
        isActiveBefore: existing.isActive,
        isActiveAfter: updated.isActive,
        permissionsBefore: existing.permissions,
        permissionsAfter: updated.permissions,
      },
    });

    return sendSuccess(res, {
      message: "Platform user updated",
      data: toSafePlatformUser(updated),
    });
  } catch (error) {
    return sendError(res, { message: "Failed to update platform user", error });
  }
};

export const deletePlatformUser = async (req: Request, res: Response) => {
  try {
    const actor = getActor(req);
    if (!actor) return sendError(res, { status: 401, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return sendError(res, { status: 400, message: "Invalid platform user id" });
    }

    const existing = await prisma.platformUser.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!existing) {
      return sendError(res, { status: 404, message: "Platform user not found" });
    }

    await prisma.platformUser.delete({ where: { id } });

    logAuditEvent({
      actorId: actor.userId,
      actorOrgId: actor.orgId,
      actorType: actor.actorType,
      entity: "platform_user",
      entityId: id,
      action: "DELETE",
      changes: {
        email: existing.email,
      },
    });

    return sendSuccess(res, {
      message: "Platform user deleted",
      data: { id },
    });
  } catch (error) {
    return sendError(res, { message: "Failed to delete platform user", error });
  }
};
