import express, { type Request, type Response } from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { openApiSpec } from "./swagger";
import { getSwaggerUiHtml } from "./swaggerUiHtml";
import deptRouter from "./router/department";
import posRouter from "./router/position";
import emRouter from "./router/employee";
import authRouter from "./router/auth";
import orgRouter from "./router/organization";
import { authVerify } from "./middleware/auth";
import planRouter from "./router/plan";

const app = express();
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.set("trust proxy", 1);
app.use(compression());
// Vercel/Swagger UI မှာ CSP ကြောင့် script/style မတက်တာတွေ ဖြစ်နိုင်လို့ CSP ကိုပိတ်ထားပါတယ်
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OpenAPI spec (Swagger UI က browser ကနေ fetch လုပ်မယ်) — extension မသုံးပါ (routing/proxy မှာ .json ကြောင့် 404 ဖြစ်တတ်ပါတယ်)
app.get("/api/openapi", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(openApiSpec);
});

// Swagger UI — CDN assets (Vercel serverless မှာ swagger-ui-express local dist မအလုပ်ဖြစ်တာကိုရှောင်ပါတယ်)
const sendSwaggerUi = (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(getSwaggerUiHtml());
};
app.get("/api/docs", sendSwaggerUi);
app.get("/api/docs/", sendSwaggerUi);

app.use("/api/auth", authRouter);
app.use("/api/employees", authVerify, emRouter);
app.use("/api/departments", deptRouter);
app.use("/api/positions", posRouter);
app.use("/api/organization", orgRouter);
app.use("/api/plan", planRouter);

app.get("/", (req, res) =>
  res.json({
    message: "HELLO WORLD",
  }),
);

export default app;
