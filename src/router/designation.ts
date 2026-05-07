import { Router } from "express";
import { getDesignation } from "../controller/designation";

const designationRouter = Router();

designationRouter.get(`/`, getDesignation);

export default designationRouter;
