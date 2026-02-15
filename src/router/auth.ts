import { Router } from "express";
import { login } from "../controller/auth";

const authRouter = Router();

authRouter.post("/login", login);

export default authRouter;
