import { execSync } from "node:child_process";

// Apply pending migrations to the dedicated test database (non-destructive).
// Individual test files clear rows via resetDb() in helpers.ts.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "mysql://educore:educore@localhost:3306/educore_test";
  if (!/test/i.test(new URL(url).pathname)) throw new Error(`Refusing to run tests against non-test database: ${new URL(url).pathname}`);
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" } });
}
