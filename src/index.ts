import express from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import deptRouter from "./router/department";
import posRouter from "./router/position";
import emRouter from "./router/employee";

const app = express();
const port = 3000;
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.set("trust proxy", 1);
app.use(compression());
app.use(helmet());
app.use(morgan("dev"));
app.use(limiter);

app.use("/employees", emRouter);
app.use("/departments", deptRouter);
app.use("/positions", posRouter);

app.get("/", (req, res) =>
  res.json({
    message: "HELLO WORLD",
  }),
);
app.listen(port, () => console.log(`Example app listening on port ${port}!`));

export default app;
