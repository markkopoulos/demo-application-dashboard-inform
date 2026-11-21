import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { purgeExpiredSessions } from "./lib/session.js";

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`EduCore listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Housekeeping: drop expired sessions and reset tokens hourly.
const purge = setInterval(() => purgeExpiredSessions().catch((err) => logger.error({ err }, "session purge failed")), 3_600_000);
purge.unref();

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));
