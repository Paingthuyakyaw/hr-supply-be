import { Router } from "express";
import { getPositionById, getPositions } from "../controller/position";

const posRouter = Router();

posRouter.get("/", getPositions);
posRouter.get("/:id", getPositionById);

export default posRouter;
