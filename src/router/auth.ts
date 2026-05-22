import { Router } from "express";
import {
  adminLogin,
  adminRefresh,
  mobileLogin,
  mobileRefresh,
} from "../controller/auth";
import { validate } from "../validator";
import {
  adminLoginSchema,
  mobileLoginSchema,
  refreshTokenSchema,
} from "../validator/auth";

const authRouter = Router();

authRouter.post("/admin/login", validate(adminLoginSchema), adminLogin);
authRouter.post("/admin/refresh", validate(refreshTokenSchema), adminRefresh);
authRouter.post("/mobile/login", validate(mobileLoginSchema), mobileLogin);
authRouter.post("/mobile/refresh", validate(refreshTokenSchema), mobileRefresh);

export default authRouter;
