import { Router } from "express";
import { getAllPlan } from "../controller/plan";

const planRouter = Router();

planRouter.get("/", getAllPlan);

export default planRouter;
