import "dotenv/config"; // loads server/.env when present; real env vars always win
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://localhost:3000")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim().replace(/\/$/, ""))
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(72),
  COOKIE_SECURE: bool.optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool.optional(),
  LOCAL_STORAGE_DIR: z.string().default("./uploads"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message; never print secret values.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  isProd: data.NODE_ENV === "production",
  isTest: data.NODE_ENV === "test",
  // Secure cookies default to on in production unless explicitly disabled.
  cookieSecure: data.COOKIE_SECURE ?? data.NODE_ENV === "production",
};

if (env.isProd && !env.cookieSecure) {
  console.warn("[educore] WARNING: COOKIE_SECURE=false in production. Serve over HTTPS and enable it.");
}
