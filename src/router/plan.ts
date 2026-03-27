import { Router } from "express";
import { createPlan, getAllPlan } from "../controller/plan";

const planRouter = Router();

planRouter.get("/", getAllPlan);
planRouter.post("/", createPlan);

export default planRouter;
