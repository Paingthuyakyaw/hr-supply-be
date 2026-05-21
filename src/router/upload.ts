import { Router } from "express";
import { createUploadPresign } from "../controller/upload";
import { validate } from "../validator";
import { uploadPresignSchema } from "../validator/upload";

const uploadRouter = Router();

uploadRouter.post("/presign", validate(uploadPresignSchema), createUploadPresign);

export default uploadRouter;
