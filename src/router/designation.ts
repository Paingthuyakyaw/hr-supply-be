import { Router } from "express";
import {
  createDesignation,
  getDesignationDetail,
  getDesignation,
  updateDesignation,
} from "../controller/designation";

const designationRouter = Router();

designationRouter.get(`/`, getDesignation);
designationRouter.get(`/:id`, getDesignationDetail);
designationRouter.post(`/`, createDesignation);
designationRouter.put(`/:id`, updateDesignation);

export default designationRouter;
