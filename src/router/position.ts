import { Router } from "express";
import {
  createPosition,
  deletePosition,
  getPositionById,
  getPositions,
  updatePosition,
} from "../controller/position";

const posRouter = Router();

posRouter.get("/", getPositions);
posRouter.get("/:id", getPositionById);
posRouter.post("/", createPosition);
posRouter.put("/:id", updatePosition);
posRouter.delete("/:id", deletePosition);

export default posRouter;
