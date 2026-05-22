import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/token";

type AuthClientType = "admin" | "mobile";

const createAuthVerify = (allowedClientTypes?: AuthClientType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers?.authorization;

      if (!authHeader) {
        return res.status(401).json({
          message: "Invalid Token",
        });
      }

      const parts = authHeader.split(" ");

      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
          message: "Invalid Token",
        });
      }

      const token = parts[1];
      const decoded = verifyAccessToken(token);

      if (
        allowedClientTypes &&
        (!decoded.clientType || !allowedClientTypes.includes(decoded.clientType))
      ) {
        return res.status(403).json({
          message: "Forbidden: invalid auth flow for this endpoint",
        });
      }

      (req as any).user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }
  };
};

export const authVerify = createAuthVerify();
export const authVerifyAdmin = createAuthVerify(["admin"]);
export const authVerifyMobile = createAuthVerify(["mobile"]);
