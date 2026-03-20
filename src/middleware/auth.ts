import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/token";

export const authVerify = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers?.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Invalid Token",
      });
    }

    const parts = authHeader?.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid Token",
      });
    }

    const token = parts[1];

    const decoded = verifyAccessToken(token);

    (req as any).user = decoded;

    next();
  } catch (err) {
    res.status(401).json({
      message: "Unauthorized",
    });
  }
};
