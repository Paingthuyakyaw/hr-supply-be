import { Router } from "express";
import { createOrg, getAllOrg } from "../controller/organization";
import { payloadSchema } from "../validator/organization";
import { validateRequest } from "../middleware/validate";

const orgRouter = Router();

orgRouter.get("/", getAllOrg);
orgRouter.post("/", payloadSchema, validateRequest, createOrg);

export default orgRouter;
