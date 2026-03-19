import type { NextFunction, Request, Response } from "express";
import { matchedData, validationResult } from "express-validator";

export function validateRequest(req: Request, res: Response, next: NextFunction) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      message: "Validation Error",
      errors: result.array({ onlyFirstError: true }),
    });
  }

  (req as any).validated = matchedData(req, {
    locations: ["body", "query", "params"],
    includeOptionals: true,
  });

  return next();
}

