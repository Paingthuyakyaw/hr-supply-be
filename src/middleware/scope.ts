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
  if (user?.adminScope === "SUPERADMIN" && user.actorType === "platform") {
    return res.status(403).json({
      message: "Forbidden: this endpoint is limited to organization admins",
    });
  }
  return next();
};
