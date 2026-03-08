import { Router } from "express";
import { login, refresh } from "../controller/auth";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/refresh", refresh);

export default authRouter;
