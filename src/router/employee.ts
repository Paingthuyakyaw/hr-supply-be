import { Router } from "express";
import { getEmployeeById, getEmployees } from "../controller/employee";

const emRouter = Router();

emRouter.get("/", getEmployees);
emRouter.get("/:id", getEmployeeById);

export default emRouter;
