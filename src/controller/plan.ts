import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { Action, MenuCode } from "../generated/prisma/enums";

type PlanPermissionInput = {
  menu: MenuCode;
  actions: Action[];
};

type PlanWithPermissions = {
  id: number;
  code: string;
  name: string;
  menuPermission: Array<{
    actions: Action[];
    menu: {
      menu: MenuCode;
    };
  }>;
};

const toUniqueActions = (actions: Action[]) => Array.from(new Set(actions));

const formatPlanResponse = (plan: PlanWithPermissions) => ({
  id: plan.id,
  code: plan.code,
  name: plan.name,
  permissions: plan.menuPermission.map((permission) => ({
    menu: permission.menu.menu,
    actions: permission.actions,
  })),
});

const resolveMenuIdByCode = async (menuCode: MenuCode) => {
  const menu = await prisma.menu.findFirst({
    where: { menu: menuCode },
    select: { id: true },
  });

  return menu?.id;
};

export const getAllPlan = async (req: Request, res: Response) => {
  try {
    const plan = await prisma.plan.findMany({
      include: {
        menuPermission: {
          include: {
            menu: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Fetched Successfully",
      data: plan.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        permissions: item.menuPermission.length,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const rawPermission =
      (req.body as any).permission ?? (req.body as any).permissions;
    const {
      code,
      name,
      permission = Array.isArray(rawPermission) ? rawPermission : [],
    } = req.body as {
      code: string;
      name: string;
      permission?: PlanPermissionInput[];
    };

    const menuPermissionData: Array<{ menuId: number; actions: Action[] }> = [];

    for (const item of permission) {
      const menuId = await resolveMenuIdByCode(item.menu);

      if (!menuId) {
        return res.status(400).json({
          message: `Menu not found for code ${item.menu}`,
        });
      }

      menuPermissionData.push({
        menuId: menuId,
        actions: toUniqueActions(item.actions),
      });
    }

    const data = await prisma.$transaction(async (tx) => {
      const createPlan = await tx.plan.create({
        data: {
          name,
          code,
        },
      });

      if (menuPermissionData.length) {
        await tx.planOnMenu.createMany({
          data: menuPermissionData.map((da) => ({
            planId: createPlan.id,
            menuId: da.menuId,
            actions: da.actions,
          })),
        });
      }

      return tx.plan.findUnique({
        where: {
          id: createPlan.id,
        },
        include: {
          menuPermission: {
            include: {
              menu: true,
            },
          },
        },
      });
    });

    return res.status(200).json({
      message: "Created Successfully",
      data: data ? formatPlanResponse(data as PlanWithPermissions) : null,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const editPlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawPermission =
      (req.body as any).permission ?? (req.body as any).permissions;
    const {
      code,
      name,
      permission = Array.isArray(rawPermission) ? rawPermission : [],
    } = req.body as {
      code: string;
      name: string;
      permission?: PlanPermissionInput[];
    };
    const planId = Number(id);

    const menuPermissionData: Array<{ menuId: number; actions: Action[] }> = [];

    for (const item of permission) {
      const menuId = await resolveMenuIdByCode(item.menu);
      if (!menuId) {
        return res.status(400).json({
          message: `Menu not found for code: ${item.menu}`,
        });
      }

      menuPermissionData.push({
        menuId,
        actions: toUniqueActions(item.actions),
      });
    }

    const data = await prisma.$transaction(async (tx) => {
      const existingPlan = await tx.plan.findUnique({
        where: { id: planId },
        select: { id: true },
      });

      if (!existingPlan) {
        return null;
      }

      await tx.plan.update({
        where: { id: planId },
        data: {
          code,
          name,
        },
      });

      await tx.planOnMenu.deleteMany({
        where: { planId },
      });

      if (menuPermissionData.length) {
        await tx.planOnMenu.createMany({
          data: menuPermissionData.map((item) => ({
            planId,
            menuId: item.menuId,
            actions: item.actions,
          })),
        });
      }

      return tx.plan.findUnique({
        where: { id: planId },
        include: {
          menuPermission: {
            include: {
              menu: true,
            },
          },
        },
      });
    });

    if (!data) {
      return res.status(404).json({
        message: "Plan not found",
      });
    }

    return res.status(201).json({
      message: "Edit Successfully",
      data: formatPlanResponse(data as PlanWithPermissions),
    });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};
