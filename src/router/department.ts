import { Router } from "express";
import {
  createDepartment,
  deleteDepartment,
  getDepartmentById,
  getDepartments,
  updateDepartment,
} from "../controller/department";

const deptRouter = Router();

deptRouter.get("/", getDepartments);
deptRouter.get("/:id", getDepartmentById);
deptRouter.post("/", createDepartment);
deptRouter.put("/:id", updateDepartment);
deptRouter.delete("/:id", deleteDepartment);

export default deptRouter;
