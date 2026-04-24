import { Router } from "express";
import {
  createPosition,
  deletePosition,
  getPositionById,
  getPositions,
  updatePosition,
} from "../controller/position";
import { requirePermission } from "../middleware/permission";
import { Action, MenuCode } from "../generated/prisma/enums";

const posRouter = Router();

posRouter.get("/", requirePermission(MenuCode.POSITION, Action.VIEW), getPositions);
posRouter.get(
  "/:id",
  requirePermission(MenuCode.POSITION, Action.VIEW),
  getPositionById,
);
posRouter.post(
  "/",
  requirePermission(MenuCode.POSITION, Action.CREATE),
  createPosition,
);
posRouter.put(
  "/:id",
  requirePermission(MenuCode.POSITION, Action.UPDATE),
  updatePosition,
);
posRouter.delete(
  "/:id",
  requirePermission(MenuCode.POSITION, Action.DELETE),
  deletePosition,
);

export default posRouter;
