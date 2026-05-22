import type { NextFunction, Request, Response } from "express";

type JwtUser = {
  adminScope?: "OWN_ADMIN" | "SUPERADMIN";
  actorType?: "employee" | "platform";
};

type RequestWithUser = Request & {
  user?: JwtUser;
};

export const requireOwnAdminScope = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = (req as RequestWithUser).user;
  const isReadOnlyMethod = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  if (isReadOnlyMethod) {
    return next();
  }
  const isSuperadmin = user?.adminScope === "SUPERADMIN" && user.actorType === "platform";
  const isOrganizationCreateEndpoint =
    req.method === "POST" && req.baseUrl === "/api/admin/organization" && req.path === "/";
  if (isSuperadmin && isOrganizationCreateEndpoint) {
    return next();
  }
  if (isSuperadmin) {
    return res.status(403).json({
      message: "Forbidden: write actions are limited to organization admins",
    });
  }
  return next();
};
