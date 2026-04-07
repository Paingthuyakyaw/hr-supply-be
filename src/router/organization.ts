import { Router } from "express";
import {
  createOrg,
  editOrganization,
  getAllOrg,
} from "../controller/organization";
import { payloadSchema } from "../validator/organization";
import { validateRequest } from "../middleware/validate";

const orgRouter = Router();

orgRouter.get("/", getAllOrg);
orgRouter.post("/", payloadSchema, validateRequest, createOrg);
orgRouter.put("/:id", editOrganization);

export default orgRouter;
