// Runs in every test worker before any module import.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "mysql://educore:educore@localhost:3306/educore_test";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.APP_ORIGIN = "http://localhost:5173";
process.env.COOKIE_SECURE = "false";
