import { Router } from "express";
import { createPlan, editPlan, getAllPlan } from "../controller/plan";
import { validate } from "../validator/index";
import { createPlanSchema, editPlanSchema } from "../validator/plan";

const planRouter = Router();

planRouter.get("/", getAllPlan);
planRouter.post("/", validate(createPlanSchema), createPlan);
planRouter.put("/:id", validate(editPlanSchema), editPlan);

export default planRouter;
