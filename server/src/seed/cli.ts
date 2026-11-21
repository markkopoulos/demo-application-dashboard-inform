/**
 * Seed CLI.
 *   node dist/seed/cli.js --if-empty   → seed only if the database has no users (non-destructive)
 *   node dist/seed/cli.js              → wipe + reseed (blocked in production unless SEED_ALLOW_PRODUCTION=true)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "./demo.js";

const prisma = new PrismaClient();

async function run() {
  const ifEmpty = process.argv.includes("--if-empty");
  if (ifEmpty) {
    if (process.env.DEMO_SEED !== "true") {
      console.log("[seed] DEMO_SEED is not 'true' — skipping demo data.");
      return;
    }
    const users = await prisma.user.count();
    if (users > 0) {
      console.log(`[seed] Database already has ${users} users — skipping demo data.`);
      return;
    }
    await seedDemo(prisma, { wipeFirst: false });
    return;
  }
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Refusing to wipe and reseed a production database. Set SEED_ALLOW_PRODUCTION=true to override.");
  }
  await seedDemo(prisma, { wipeFirst: true });
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
