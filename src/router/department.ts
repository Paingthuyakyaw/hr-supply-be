import { Router } from "express";
import { getDepartmentById, getDepartments } from "../controller/department";

const deptRouter = Router();

deptRouter.get("/", getDepartments);
deptRouter.get("/:id", getDepartmentById);

export default deptRouter;
