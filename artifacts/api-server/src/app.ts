import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { DailyError, databaseErrorCode, databaseUnavailable } from "./lib/daily-errors";
import { pool } from "@workspace/db";

const app: Express = express();

pool.on("error", () => {
  // An idle connection failure must not crash the process or leak driver text.
  logger.error({ category: "database_connection_lost" }, "An idle database connection was lost");
});
// Do not trust arbitrary forwarded headers. An operator may explicitly configure
// the known proxy hop count; default to the socket peer.
const proxyHops = process.env.TRUST_PROXY_HOPS;
if (proxyHops && /^[0-2]$/.test(proxyHops)) app.set("trust proxy", Number(proxyHops));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use("/api/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "8mb" }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof DailyError) {
    if (error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
    res.status(error.status).json({ error: error.message });
    return;
  }
  const bodyError = error as { type?: string };
  if (bodyError?.type === "entity.parse.failed" || bodyError?.type === "entity.too.large") {
    res.status(400).json({ error: bodyError.type === "entity.too.large" ? "Workspace is too large (maximum 8 MB)." : "Request must contain valid JSON." });
    return;
  }
  const unavailable = databaseUnavailable(error);
  // Never log error objects, SQL, bodies, hashes, or headers: drivers can embed
  // parameter values and stored credentials in error messages.
  const code = databaseErrorCode(error);
  req.log.error({ category: unavailable ? "database_unavailable" : "internal_error", code: code && /^[A-Z0-9_]{2,24}$/.test(code) ? code : undefined }, "Daily request failed");
  res.status(unavailable ? 503 : 500).json({ error: unavailable ? "Database is temporarily unavailable. Please retry; your local draft is safe." : "Unable to complete this request. Please try again." });
};
app.use(errorHandler);

export default app;
