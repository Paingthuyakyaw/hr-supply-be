import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { PlatformPermission } from "../generated/prisma/enums";

type JwtUser = {
  sub: number;
  clientType?: "admin" | "mobile";
  adminScope?: "OWN_ADMIN" | "SUPERADMIN";
  actorType?: "employee" | "platform";
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

export const requirePlatformPermission = (permission: PlatformPermission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as RequestWithUser).user;
      if (
        !user?.sub ||
        user.clientType !== "admin" ||
        user.adminScope !== "SUPERADMIN" ||
        user.actorType !== "platform"
      ) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const platformUser = await prisma.platformUser.findUnique({
        where: { id: user.sub },
        select: {
          isActive: true,
          permissions: true,
        },
      });
      if (!platformUser || !platformUser.isActive) {
        return res.status(403).json({ message: "Superadmin account is inactive" });
      }
      if (!platformUser.permissions.includes(permission)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
};

export const requirePlatformPermissionIfSuperadmin = (
  permission: PlatformPermission,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as RequestWithUser).user;
    if (
      user?.clientType === "admin" &&
      user.adminScope === "SUPERADMIN" &&
      user.actorType === "platform"
    ) {
      return requirePlatformPermission(permission)(req, res, next);
    }
    return next();
  };
};
