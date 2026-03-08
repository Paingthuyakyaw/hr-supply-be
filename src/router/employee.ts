import { Router } from "express";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  updateEmployee,
} from "../controller/employee";

const emRouter = Router();

emRouter.get("/", getEmployees);
emRouter.get("/:id", getEmployeeById);
emRouter.post("/", createEmployee);
emRouter.put("/:id", updateEmployee);
emRouter.delete("/:id", deleteEmployee);

export default emRouter;
