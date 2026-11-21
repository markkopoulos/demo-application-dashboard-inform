import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.isTest ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "req.headers['x-csrf-token']", "*.password", "*.passwordHash"],
    censor: "[redacted]",
  },
});
