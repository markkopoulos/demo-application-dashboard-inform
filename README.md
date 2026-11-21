# EduCore

A management and learning portal for Greek tutoring centers (φροντιστήρια). Administrators, teachers, students and parents sign in to one platform with secure role-based accounts.

> **Status: Phase 1 of 6 complete.** These are built and working: the foundation (database, authentication, permissions, center isolation), platform administration and the application shell. Business modules ship in Phases 2–6. Sidebar entries for later modules carry a `Φn` badge.
> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture, data model, routes and milestones.

**Stack:** React · TypeScript · Vite · Tailwind · shadcn/ui · React Router · TanStack Query · Express · Prisma · PostgreSQL · Zod · Argon2id · Vitest

---

## Local development

**Requirements:** Node.js 20 or newer and PostgreSQL 14 or newer.

1. Install dependencies:

```bash
npm install
```

2. Create a database user and the databases (dev and test):

```bash
psql -U postgres -c "CREATE USER educore WITH PASSWORD 'educore' CREATEDB;"
```

```bash
psql -U postgres -c "CREATE DATABASE educore OWNER educore;"
```

```bash
psql -U postgres -c "CREATE DATABASE educore_test OWNER educore;"
```

3. Configure the environment, then edit `server/.env` and set `SESSION_SECRET` to a long random string:

```bash
cp server/.env.example server/.env
```

4. Apply the migrations and load the demo data:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

5. Start the API (port 3000) and Vite (port 5173):

```bash
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Express, so cookies behave as they do in production.

### Demo accounts (local development only)

`npm run db:seed` creates the fictional center **Φροντιστήριο Ακαδημία**. Every account uses the password **`EduCore2026!`**.

| Role | Email |
|---|---|
| Super admin | `superadmin@educore.example` |
| Center admin | `admin@akadimia.example` |
| Teacher | `teacher@akadimia.example` |
| Student | `student@akadimia.example` |
| Parent (3 linked children) | `parent@akadimia.example` |
| Admin of a 2nd center (isolation demo) | `admin@proodos.example` |

The seed also creates 4 more teachers, 29 more students, 9 more parents, 8 subjects, 8 active classes with weekly timetables, and 2 academic years. All names are invented, and every email uses the reserved `.example` domain. **The seed wipes the database.** It refuses to run when `NODE_ENV=production` unless you set `SEED_ALLOW_PRODUCTION=true`. Never use these credentials in a real deployment.

The login page shows one-click demo buttons in development, or when the client is built with `VITE_DEMO_MODE=true`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) and client (Vite) together |
| `npm run build` | Production build of the client (`client/dist`) and server (`server/dist`) |
| `npm start` | Runs the production server (API and SPA in one process) |
| `npm run start:prod` | `prisma migrate deploy`, then `npm start` |
| `npm test` | Backend integration tests against `educore_test` |
| `npm run typecheck` | TypeScript checks for both workspaces |
| `npm run db:migrate` | Creates and applies a migration (development) |
| `npm run db:deploy` | Applies pending migrations (production, non-destructive) |
| `npm run db:seed` | Wipes the database and loads demo data |

### Tests

```bash
npm test
```

The tests run against a real PostgreSQL database: `educore_test` by default, or set `TEST_DATABASE_URL`. They apply migrations with `prisma migrate deploy` and clear rows between files. A guard refuses to touch any database whose name doesn't contain `test`. They cover login and logout, case-insensitive email, enumeration-safe errors, suspended accounts, idle and absolute session expiry, CSRF (missing token, wrong token, cross-origin), the password reset lifecycle, role-guarded routes, ignored client-supplied role hints, center deactivation, cross-center isolation, and ownership rules for students, parents and teachers.

---

## Environment variables

See [`server/.env.example`](server/.env.example).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Add `?sslmode=require` for managed databases |
| `SESSION_SECRET` | ✅ | At least 32 random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NODE_ENV` | ✅ in prod | `production` |
| `PORT` | | Default 3000. Most hosts inject this |
| `APP_ORIGIN` | ✅ in prod | Public URL(s), comma-separated, e.g. `https://portal.example.gr`. Used for CSRF origin checks and reset links |
| `COOKIE_SECURE` | | Defaults to `true` in production. Requires HTTPS |
| `SESSION_IDLE_MINUTES` / `SESSION_ABSOLUTE_HOURS` | | Default 120 / 72 |
| `S3_*` | Phase 3 | Private S3-compatible bucket for uploads |
| `LOG_LEVEL` | | `info` by default |

---

## Deploying to Hostinger (Node.js hosting)

EduCore builds to **one Node.js process**: Express serves `/api` and the compiled SPA, with fallback routing for client-side paths. It doesn't depend on serverless or platform-specific services. Two things must live **outside** the Node.js app:

1. **PostgreSQL.** Don't assume your hosting plan includes it. Use a managed PostgreSQL provider (for example Neon, Supabase, Aiven, DigitalOcean or AWS RDS) or a Hostinger VPS running PostgreSQL. Copy its connection string, including `sslmode=require`, into `DATABASE_URL`.
2. **File storage (from Phase 3).** Use a private S3-compatible bucket (for example Cloudflare R2, Backblaze B2, Wasabi or AWS S3). Don't rely on the app's local disk: it may not be persistent.

### Steps (managed Node.js app)

1. Push this repository to GitHub, or upload it.
2. In Hostinger's Node.js application settings, choose **Node.js 20 or 22**, set the application root to the repository root, and configure:
   - **Install command:** `npm ci --include=dev` (the build needs Vite and TypeScript)
   - **Build command:** `npm run build`
   - **Start command:** `npm run start:prod` (applies pending migrations, then starts)
3. Add the environment variables from the table above: `NODE_ENV=production`, `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN=https://your-domain`, and later the `S3_*` values.
4. Enable HTTPS (SSL) for the domain. Cookies are `Secure` in production and won't be sent over plain HTTP.
5. Deploy, then open `https://your-domain/api/health`. It should return `{"status":"ok","db":"ok"}`.
6. Create your first super admin. Either run the seed once against a **fresh, empty** database (`SEED_ALLOW_PRODUCTION=true npm run db:seed`), then **immediately change every demo password or delete the demo accounts**, or insert a user with a hashed password through a one-off script. A dedicated `create-admin` CLI is planned for Phase 6.

### Steps (Hostinger VPS)

```bash
git clone <repo> educore && cd educore
```

```bash
npm ci --include=dev && npm run build
```

```bash
NODE_ENV=production npm run start:prod
```

Keep the process alive with a supervisor such as `pm2` or systemd. Put nginx in front for TLS, and proxy to `PORT`. Express already trusts one proxy hop, so client IPs and HTTPS detection work correctly.

### Operational notes

- **Health check:** `GET /api/health` returns 200 when the database is reachable and 503 when it isn't.
- **Logging:** structured JSON (pino) on stdout. Cookies, auth headers and passwords are redacted.
- **Shutdown:** SIGTERM/SIGINT close the HTTP server and the DB pool gracefully.
- **Housekeeping:** expired sessions and reset tokens are purged hourly.

### Backup and recovery

- Turn on your managed PostgreSQL provider's **automated daily backups and point-in-time recovery**, with at least 7 days of retention, more for production.
- Also take your own logical backups:

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" > educore-$(date +%F).dump
```

- Restore into an empty database:

```bash
pg_restore --no-owner --dbname "$TARGET_DATABASE_URL" educore-YYYY-MM-DD.dump
```

- Enable **versioning** on the object-storage bucket, so a deleted or overwritten file can be recovered.
- Test a restore into a staging database at least once a quarter.

---

## Security and privacy summary

Argon2id password hashing · server-side sessions (only the token's HMAC is stored) · HTTP-only, Secure, SameSite cookies · CSRF origin check and per-session token · rate limiting on login and reset · server-side role and ownership checks on every request · `centerId` scoping on every center-owned record · strict CSP and Helmet headers · Zod input validation · audit log · safe error responses.

The system is designed with GDPR principles in mind (data minimization, access control, archive-before-delete, planned export and retention workflows). This does **not** constitute a claim of legal compliance, which requires a separate assessment.
