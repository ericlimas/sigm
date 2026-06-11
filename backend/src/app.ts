import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "@/config/env";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import routes from "@/routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origem nao permitida pelo CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "sigm-backend", timestamp: new Date().toISOString() });
});

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);
