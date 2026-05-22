import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { Action, MenuCode } from "../generated/prisma/enums";
import { sendError, sendSuccess } from "../utils/httpResponse";

type JwtUser = {
  sub: number;
  orgId: number;
  email: string;
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const getUserOrgId = (req: Request): number | null => {
  const orgId = (req as RequestWithUser).user?.orgId;
  if (!Number.isFinite(orgId)) {
    return null;
  }
  return Number(orgId);
};

const toUniqueActions = (actions: Action[]) => Array.from(new Set(actions));

const parsePageValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const formatDesignationPermissions = (
  permissions: Array<{
    actions: Action[];
    menu: {
      menu: MenuCode;
    };
  }>,
) =>
  permissions.map((item) => ({
    menu: item.menu.menu,
    actions: item.actions,
  }));

export const getDesignation = async (req: Request, res: Response) => {
  try {
    const userOrgId = getUserOrgId(req);
    if (userOrgId === null) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const search = String(req.query.search ?? "").trim();
    const page = parsePageValue(req.query.page, DEFAULT_PAGE);
    const size = Math.min(
      parsePageValue(req.query.size, DEFAULT_SIZE),
      MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * size;

    const where = {
      organizationId: userOrgId,
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const [designation, totalItems] = await Promise.all([
      prisma.designation.findMany({
        where,
        select: {
          id: true,
          name: true,
          organizationId: true,
          _count: {
            select: { menuPermission: true },
          },
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { id: "desc" },
        skip,
        take: size,
      }),
      prisma.designation.count({ where }),
    ]);

    return sendSuccess(res, {
      message: "Designation fetched",
      data: designation.map((da) => ({
        id: da.id,
        name: da.name,
        organizationId: da.organizationId,
        menuPermission: da._count.menuPermission,
        organization: da.organization,
      })),
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / size),
        page,
        size,
      },
    });
  } catch (err) {
    return sendError(res, {
      message: "Server Error",
      error: err,
    });
  }
};

export const getDesignationDetail = async (req: Request, res: Response) => {
  try {
    const designationId = Number(req.params.id);
    const userOrgId = getUserOrgId(req);
    if (userOrgId === null) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    if (!Number.isFinite(designationId)) {
      return sendError(res, { status: 400, message: "Invalid designation id" });
    }

    const designation = await prisma.designation.findFirst({
      where: {
        id: designationId,
        organizationId: userOrgId,
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        menuPermission: {
          select: {
            actions: true,
            menu: {
              select: {
                menu: true,
              },
            },
          },
        },
      },
    });

    if (!designation) {
      return sendError(res, { status: 404, message: "Designation not found" });
    }

    return sendSuccess(res, {
      message: "Designation detail",
      data: {
        id: designation.id,
        name: designation.name,
        organizationId: designation.organizationId,
        permissions: formatDesignationPermissions(designation.menuPermission),
      },
    });
  } catch (err) {
    return sendError(res, {
      message: "Server Error",
      error: err,
    });
  }
};

export const createDesignation = async (req: Request, res: Response) => {
  try {
    const userOrgId = getUserOrgId(req);
    if (userOrgId === null) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    const { name, permissions = [], employeeIds = [] } = req.body as {
      name: string;
      permissions?: Array<{ menu: MenuCode; actions: Action[] }>;
      employeeIds?: Array<string | number>;
    };
    const normalizedEmployeeIds = Array.from(
      new Set(employeeIds as Array<string | number>),
    ).map((id) => Number(id));

    const menus = await prisma.menu.findMany({
      where: { menu: { in: permissions.map((p) => p.menu) } },
      select: {
        id: true,
        menu: true,
      },
    });
    if (menus.length !== permissions.length) {
      return sendError(res, {
        status: 400,
        message: "Some permissions contain invalid menu code",
      });
    }

    const menuIdByCode = new Map(menus.map((m) => [m.menu, m.id]));

    if (normalizedEmployeeIds.length) {
      const validEmployees = await prisma.employee.findMany({
        where: {
          id: { in: normalizedEmployeeIds },
          organizationId: userOrgId,
        },
        select: { id: true },
      });

      if (validEmployees.length !== normalizedEmployeeIds.length) {
        return sendError(res, {
          status: 400,
          message: "Some employees do not belong to your organization",
        });
      }
    }

    const created = await prisma.designation.create({
      data: {
        name,
        organizationId: userOrgId,
        menuPermission: {
          create: permissions
            .filter((p) => menuIdByCode.has(p.menu))
            .map((p) => ({
              menuId: menuIdByCode.get(p.menu)!,
              actions: toUniqueActions(p.actions),
            })),
        },
        employees: {
          create: normalizedEmployeeIds.map((id) => ({
            employeeId: id,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        menuPermission: {
          select: {
            actions: true,
            menu: { select: { menu: true } },
          },
        },
      },
    });

    return sendSuccess(res, {
      status: 201,
      message: "Designation created",
      data: {
        id: created.id,
        name: created.name,
        organizationId: created.organizationId,
        permissions: formatDesignationPermissions(created.menuPermission),
      },
    });
  } catch (err) {
    return sendError(res, { message: "Server Error", error: err });
  }
};

export const updateDesignation = async (req: Request, res: Response) => {
  try {
    const designationId = Number(req.params.id);
    const userOrgId = getUserOrgId(req);
    if (userOrgId === null) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }

    if (!Number.isFinite(designationId)) {
      return sendError(res, { status: 400, message: "Invalid designation id" });
    }

    const { name, permissions, employeeIds } = req.body as {
      name?: string;
      permissions?: Array<{ menu: MenuCode; actions: Action[] }>;
      employeeIds?: Array<string | number>;
    };
    const shouldReplacePermissions = Array.isArray(permissions);
    const shouldReplaceEmployees = Array.isArray(employeeIds);
    const normalizedPermissions = shouldReplacePermissions ? permissions : [];
    const normalizedEmployeeIds = Array.from(
      new Set((employeeIds ?? []) as Array<string | number>),
    ).map((id) => Number(id));

    const existingDesignation = await prisma.designation.findFirst({
      where: {
        id: designationId,
        organizationId: userOrgId,
      },
      select: { id: true },
    });

    if (!existingDesignation) {
      return sendError(res, { status: 404, message: "Designation not found" });
    }

    const menus = shouldReplacePermissions
      ? await prisma.menu.findMany({
          where: { menu: { in: normalizedPermissions.map((p) => p.menu) } },
          select: {
            id: true,
            menu: true,
          },
        })
      : [];
    if (shouldReplacePermissions && menus.length !== normalizedPermissions.length) {
      return sendError(res, {
        status: 400,
        message: "Some permissions contain invalid menu code",
      });
    }
    const menuIdByCode = new Map(menus.map((m) => [m.menu, m.id]));

    if (shouldReplaceEmployees && normalizedEmployeeIds.length) {
      const validEmployees = await prisma.employee.findMany({
        where: {
          id: { in: normalizedEmployeeIds },
          organizationId: userOrgId,
        },
        select: { id: true },
      });

      if (validEmployees.length !== normalizedEmployeeIds.length) {
        return sendError(res, {
          status: 400,
          message: "Some employees do not belong to your organization",
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.designation.update({
        where: { id: designationId },
        data: {
          ...(typeof name === "string" ? { name } : {}),
        },
      });

      if (shouldReplacePermissions) {
        await tx.designationOnMenu.deleteMany({
          where: { designationId },
        });
        await tx.designationOnMenu.createMany({
          data: normalizedPermissions
            .filter((p) => menuIdByCode.has(p.menu))
            .map((p) => ({
              designationId,
              menuId: menuIdByCode.get(p.menu)!,
              actions: toUniqueActions(p.actions),
            })),
        });
      }

      if (shouldReplaceEmployees) {
        await tx.designationOnEmployee.deleteMany({
          where: { designationId },
        });
        await tx.designationOnEmployee.createMany({
          data: normalizedEmployeeIds.map((employeeId) => ({
            designationId,
            employeeId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.designation.findUnique({
        where: { id: designationId },
        select: {
          id: true,
          name: true,
          organizationId: true,
          menuPermission: {
            select: {
              actions: true,
              menu: {
                select: {
                  menu: true,
                },
              },
            },
          },
        },
      });
    });

    if (!updated || updated.organizationId !== userOrgId) {
      return sendError(res, { status: 404, message: "Designation not found" });
    }

    return sendSuccess(res, {
      message: "Designation updated",
      data: {
        id: updated.id,
        name: updated.name,
        organizationId: updated.organizationId,
        permissions: formatDesignationPermissions(updated.menuPermission),
      },
    });
  } catch (err) {
    return sendError(res, { message: "Server Error", error: err });
  }
};

export const deleteDesignation = async (req: Request, res: Response) => {
  try {
    const designationId = Number(req.params.id);
    const userOrgId = getUserOrgId(req);
    if (userOrgId === null) {
      return sendError(res, { status: 401, message: "Unauthorized" });
    }
    if (!Number.isFinite(designationId)) {
      return sendError(res, { status: 400, message: "Invalid designation id" });
    }

    const existing = await prisma.designation.findFirst({
      where: {
        id: designationId,
        organizationId: userOrgId,
      },
      select: { id: true },
    });
    if (!existing) {
      return sendError(res, { status: 404, message: "Designation not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.designationOnEmployee.deleteMany({
        where: { designationId },
      });
      await tx.designationOnMenu.deleteMany({
        where: { designationId },
      });
      await tx.designation.delete({
        where: { id: designationId },
      });
    });

    return sendSuccess(res, {
      message: "Designation deleted",
      data: { id: designationId },
    });
  } catch (err) {
    return sendError(res, { message: "Server Error", error: err });
  }
};

