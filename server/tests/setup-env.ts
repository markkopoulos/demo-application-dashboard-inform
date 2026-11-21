// Runs in every test worker before any module import.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://educore:educore@localhost:5432/educore_test?schema=public";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
