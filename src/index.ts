import express from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./swagger";
import deptRouter from "./router/department";
import posRouter from "./router/position";
import emRouter from "./router/employee";
import authRouter from "./router/auth";
import orgRouter from "./router/organization";

const app = express();
const port = 3000;
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.set("trust proxy", 1);
app.use(compression());
app.use(helmet());
app.use(morgan("dev"));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Expose raw OpenAPI spec for debugging / tooling
app.get("/openapi.json", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json(openApiSpec);
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use("/auth", authRouter);
app.use("/employees", emRouter);
app.use("/departments", deptRouter);
app.use("/positions", posRouter);
app.use("/organization", orgRouter);

app.get("/", (req, res) =>
  res.json({
    message: "HELLO WORLD",
  }),
);
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

export default app;
