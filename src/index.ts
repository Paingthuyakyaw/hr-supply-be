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
import { authVerify } from "./middleware/auth";

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
app.use(helmet());
app.use(morgan("dev"));
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Swagger UI under /api/docs (so its assets resolve correctly on Vercel)
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  }),
);

app.use("/api/auth", authRouter);
app.use("/api/employees", authVerify, emRouter);
app.use("/api/departments", deptRouter);
app.use("/api/positions", posRouter);
app.use("/api/organization", orgRouter);

app.get("/", (req, res) =>
  res.json({
    message: "HELLO WORLD",
  }),
);

export default app;
