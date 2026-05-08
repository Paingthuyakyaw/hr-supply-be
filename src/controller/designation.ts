import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { Action, MenuCode } from "../generated/prisma/enums";

type DesignationPermissionInput = {
  menu: MenuCode;
  actions: Action[];
};

export const getDesignation = async (req: Request, res: Response) => {
  try {
    const { search, page = 1, size = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(size);
    const limit = Number(size);

    const designation = await prisma.designation.findMany({
      where: {
        name: {
          contains: search?.toString(),
          mode: "insensitive",
        },
      },
      include: {
        _count: {
          select: { menuPermission: true },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
      skip,
      take: limit,
    });

    const totalItems = await prisma.designation.count({
      where: {
        name: {
          contains: search?.toString(),
          mode: "insensitive",
        },
      },
    });

    return res.status(200).json({
      message: "Designation Fetch all",
      data: designation.map((da) => ({
        id: da.id,
        name: da.name,
        menuPermission: da._count.menuPermission,
        organization: da.organization,
        organizationId: da.organizationId,
      })),
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        page: Number(page),
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server Error",
      error: err,
    });
  }
};

export const createDesignation = async (req: Request, res: Response) => {
  try {
    const {
      name,
      organizationId,
      permissions = [],
      employeeIds = [],
    } = req.body;

    const menus = await prisma.menu.findMany({
      where: { menu: { in: permissions.map((p: any) => p.menu) } },
      select: {
        id: true,
        menu: true,
      },
    });

    const menuIdByCode = new Map(menus.map((m) => [m.menu, m.id]));

    const created = await prisma.designation.create({
      data: {
        name,
        organizationId: Number(organizationId),
        menuPermission: {
          create: permissions
            .filter((p: any) => menuIdByCode.has(p.menu))
            .map((p: any) => ({
              menuId: menuIdByCode.get(p.menu)!,
              actions: [...new Set(p.actions)],
            })),
        },
        employees: {
          create: Array.from(
            new Set(employeeIds as Array<string | number>),
          ).map((id) => ({
            employeeId: Number(id),
          })),
        },
      },
      include: {
        organization: true,
        menuPermission: { include: { menu: true } },
        employees: { include: { employee: true } },
      },
    });

    return res.status(201).json({ message: "Created", data: created });
  } catch (err) {
    return res.status(500).json({ message: "Server Error", error: err });
  }
};

export const updateDesignation = async (req: Request, res: Response) => {
  try {
    const designationId = Number(req.params.id);
    if (!Number.isFinite(designationId)) {
      return res.status(400).json({ message: "Invalid designation id" });
    }

    const {
      name,
      organizationId,
      permissions = [],
      employeeIds = [],
    } = req.body;

    const existingDesignation = await prisma.designation.findUnique({
      where: { id: designationId },
      select: { id: true, organizationId: true },
    });

    if (!existingDesignation) {
      return res.status(404).json({ message: "Designation not found" });
    }

    const orgId = organizationId
      ? Number(organizationId)
      : existingDesignation.organizationId;

    const menus = await prisma.menu.findMany({
      where: { menu: { in: permissions.map((p: any) => p.menu) } },
      select: {
        id: true,
        menu: true,
      },
    });
    const menuIdByCode = new Map(menus.map((m) => [m.menu, m.id]));

    const normalizedEmployeeIds = Array.from(
      new Set(employeeIds as Array<string | number>),
    ).map((id) => Number(id));

    const updated = await prisma.$transaction(async (tx) => {
      await tx.designation.update({
        where: { id: designationId },
        data: {
          ...(name ? { name } : {}),
          organizationId: orgId,
        },
      });

      await tx.designationOnMenu.deleteMany({
        where: { designationId },
      });
      await tx.designationOnEmployee.deleteMany({
        where: { designationId },
      });

      if (permissions.length) {
        await tx.designationOnMenu.createMany({
          data: permissions
            .filter((p: any) => menuIdByCode.has(p.menu))
            .map((p: any) => ({
              designationId,
              menuId: menuIdByCode.get(p.menu)!,
              actions: [...new Set(p.actions)],
            })),
        });
      }

      if (normalizedEmployeeIds.length) {
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
        include: {
          organization: true,
          menuPermission: { include: { menu: true } },
          employees: { include: { employee: true } },
        },
      });
    });

    return res.status(200).json({ message: "Updated", data: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server Error", error: err });
  }
};
export const updateDesignations = async (req: Request, res: Response) => {
  try {
    const designationId = req.params.id;

    const {
      name,
      organizationId,
      permissions = [],
      employeeIds = [],
    } = req.body;

    const exitDesignation = await prisma.designation.findUnique({
      where: { id: Number(designationId) },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!exitDesignation) {
      return res.status(400).json({ message: "Not Found Designation" });
    }

    const menus = await prisma.menu.findMany({
      where: { menu: { in: permissions.map((p: any) => p.menu) } },
      select: {
        id: true,
        menu: true,
      },
    });

    const menuIdByCode = new Map(menus.map((m) => [m.menu, m.id]));
  } catch (err) {
    return res.status(500).json({
      message: "Server Error",
      error: err,
    });
  }
};

