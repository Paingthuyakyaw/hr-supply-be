import { Router } from "express";
import {
  createDesignation,
  getDesignation,
  updateDesignation,
} from "../controller/designation";

const designationRouter = Router();

designationRouter.get(`/`, getDesignation);
designationRouter.post(`/`, createDesignation);
designationRouter.put(`/:id`, updateDesignation);

export default designationRouter;
