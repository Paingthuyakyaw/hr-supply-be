import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { Action, type MenuCode } from "../generated/prisma/enums";

type JwtUser = {
  sub: number;
  orgId: number;
  email: string;
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

const hasAction = (actions: string[], action: string) => actions.includes(action);

export const requirePermission = (menu: MenuCode, action: Action) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as RequestWithUser).user;
      if (!user?.sub || !user?.orgId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: user.sub },
        select: {
          organization: {
            select: {
              plan: {
                select: {
                  menuPermission: {
                    where: { menu: { menu } },
                    select: { actions: true },
                  },
                },
              },
            },
          },
          designations: {
            select: {
              designation: {
                select: {
                  menuPermission: {
                    where: { menu: { menu } },
                    select: { actions: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const planActions = employee.organization.plan.menuPermission.flatMap(
        (permission) => permission.actions,
      );
      const designationActions = employee.designations.flatMap((item) =>
        item.designation.menuPermission.flatMap((permission) => permission.actions),
      );

      const effectiveActions = new Set([...planActions, ...designationActions]);
      if (!hasAction(Array.from(effectiveActions), action)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
};
