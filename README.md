# EduCore

A management and learning portal for Greek tutoring centers (φροντιστήρια). Administrators, teachers, students and parents sign in to one platform with secure role-based accounts.

> **Status: Phase 1 of 6 complete.** These are built and working: the foundation (database, authentication, permissions, center isolation), platform administration and the application shell. Business modules ship in Phases 2–6. Sidebar entries for later modules carry a `Φn` badge.
> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the architecture, data model, routes and milestones.

**Stack:** React · TypeScript · Vite · Tailwind · shadcn/ui · React Router · TanStack Query · Express · Prisma · MySQL/MariaDB · Zod · Argon2id · Vitest

---

## Local development

**Requirements:** Node.js 20 or newer and MySQL 8 or MariaDB 10.6 or newer (the same database Hostinger provides).

1. Install dependencies:

```bash
npm install
```

2. Create a database user and the databases (dev and test). Run this in a MySQL shell as root (`sudo mysql`):

```sql
CREATE USER 'educore'@'localhost' IDENTIFIED BY 'educore';
CREATE DATABASE educore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE educore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL ON educore.* TO 'educore'@'localhost';
GRANT ALL ON educore_test.* TO 'educore'@'localhost';
-- `prisma migrate dev` creates a temporary "shadow" database:
GRANT CREATE, DROP, ALTER, REFERENCES ON *.* TO 'educore'@'localhost';
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
| `npm run start:prod` | Applies migrations, loads demo data if `DEMO_SEED=true` and the database is empty, then starts |
| `npm test` | Backend integration tests against `educore_test` |
| `npm run typecheck` | TypeScript checks for both workspaces |
| `npm run db:migrate` | Creates and applies a migration (development) |
| `npm run db:deploy` | Applies pending migrations (production, non-destructive) |
| `npm run db:seed` | Wipes the database and loads demo data |

### Tests

```bash
npm test
```

The tests run against a real MySQL/MariaDB database: `educore_test` by default, or set `TEST_DATABASE_URL`. They apply migrations with `prisma migrate deploy` and clear rows between files. A guard refuses to touch any database whose name doesn't contain `test`. They cover login and logout, case-insensitive email, enumeration-safe errors, suspended accounts, idle and absolute session expiry, CSRF (missing token, wrong token, cross-origin), the password reset lifecycle, role-guarded routes, ignored client-supplied role hints, center deactivation, cross-center isolation, and ownership rules for students, parents and teachers.

---

## Environment variables

See [`server/.env.example`](server/.env.example).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `mysql://USER:PASSWORD@HOST:3306/DATABASE`. URL-encode special characters in the password |
| `SESSION_SECRET` | ✅ | At least 32 random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NODE_ENV` | ✅ in prod | `production` |
| `PORT` | | Default 3000. Most hosts inject this |
| `APP_ORIGIN` | ✅ in prod | Public URL(s), comma-separated, e.g. `https://portal.example.gr`. Used for CSRF origin checks and reset links |
| `COOKIE_SECURE` | | Defaults to `true` in production. Requires HTTPS |
| `SESSION_IDLE_MINUTES` / `SESSION_ABSOLUTE_HOURS` | | Default 120 / 72 |
| `S3_*` | Phase 3 | Private S3-compatible bucket for uploads |
| `DEMO_SEED` | | `true` loads the demo center on first start, but only if the database is empty. It never wipes anything |
| `LOG_LEVEL` | | `info` by default |

---

## Deploying to Hostinger (Business / Cloud hosting)

Everything runs on Hostinger: the app is a **Node.js web app** and the data lives in a **Hostinger MySQL database**. You don't need a terminal. Migrations and the optional demo data run automatically when the app starts.

### 1. Create the MySQL database

hPanel → **Databases → MySQL Databases** → create a database and a user. Note these down:
- database name (e.g. `u123456789_educore`)
- username (e.g. `u123456789_educore`)
- password
- host: usually `localhost` for apps on the same hosting account. hPanel shows the exact host next to the database.

Your connection string becomes:

```
mysql://u123456789_educore:YOUR_PASSWORD@localhost:3306/u123456789_educore
```

If the password contains special characters (`@ : / ? # &` …), URL-encode them, e.g. `@` → `%40`. Or choose a password made of only letters and digits.

### 2. Create the Node.js web app

hPanel → **Websites → Add website → Node.js app** (the wording may differ slightly), then connect your GitHub account and pick this repository.

| Setting | Value |
|---|---|
| Repository / branch | `markkopoulos/demo-application-dashboard-inform` · `educore-phase-1` (or `main` once merged) |
| Framework / preset | Express, or "Other" |
| Node.js version | 20 or 22 |
| Root directory | `/` (repository root) |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Start command | `npm run start:prod` |

### 3. Add environment variables (same screen)

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the `mysql://…` string from step 1 |
| `SESSION_SECRET` | 48+ random characters. Generate at a terminal with `openssl rand -base64 48`, or use any password generator set to 64 characters |
| `APP_ORIGIN` | your site's exact address, e.g. `https://portal.example.gr`. For both www and non-www, list both, comma-separated |
| `DEMO_SEED` | `true` to load the demo center on first start. Remove it later if you don't want it |
| `VITE_DEMO_MODE` | `true` to show one-click demo login buttons (optional; must be set **before** building) |

### 4. Deploy and check

1. Make sure the domain has **SSL** enabled (hPanel → Security → SSL). Logins need HTTPS in production.
2. Click **Deploy**. The first start applies the database migration, loads the demo data (if `DEMO_SEED=true`) and starts the server.
3. Open `https://your-domain/api/health`. You should see `{"status":"ok","db":"ok"}`.
4. Open `https://your-domain` and log in, e.g. as `admin@akadimia.example` / `EduCore2026!`.

Redeploying later is safe. Pending migrations are applied, and demo data is skipped because the database is no longer empty.

> ⚠️ The demo accounts share a public password. They're fine for a demonstration. Before real people use the system, change those passwords (profile page) or start with a fresh database without `DEMO_SEED`.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| App exits right after start | A missing or invalid environment variable. The runtime log names it, e.g. `SESSION_SECRET` shorter than 32 characters |
| Health check shows `"db":"error"`, or a migrate error mentions `P1001` / `P1000` | Wrong host, user or password in `DATABASE_URL`, or a password with unencoded special characters |
| Login succeeds but you bounce back to the login page | The site isn't on `https://`, or `APP_ORIGIN` doesn't exactly match the address in the browser |
| "Cross-origin request blocked" | `APP_ORIGIN` mismatch (www vs non-www, http vs https) |
| Build fails with an out-of-memory error | The build exceeded the plan's limits. Retry, or upgrade to Cloud hosting |

### Operational notes

- **Health check:** `GET /api/health` returns 200 when the database is reachable and 503 when it isn't.
- **Logging:** structured JSON (pino) on stdout. Cookies, auth headers and passwords are redacted.
- **Shutdown:** SIGTERM/SIGINT close the HTTP server and the DB pool gracefully.
- **Housekeeping:** expired sessions and reset tokens are purged hourly.

### Backup and recovery

- Hostinger Business and Cloud plans include **automatic backups** (hPanel → Files → Backups), including databases. Check the retention period for your plan.
- Before big updates, download a manual backup: hPanel → Databases → **phpMyAdmin** → Export, or Backups → Database backups.
- From any machine that can reach the database:

```bash
mysqldump --single-transaction --default-character-set=utf8mb4 -h HOST -u USER -p DATABASE > educore-$(date +%F).sql
```

- Restore into an empty database:

```bash
mysql --default-character-set=utf8mb4 -h HOST -u USER -p DATABASE < educore-YYYY-MM-DD.sql
```

- Uploaded files (from Phase 3) go to a private bucket. Enable versioning there.
- Test a restore into a spare database at least once a quarter.

---

## Security and privacy summary

Argon2id password hashing · server-side sessions (only the token's HMAC is stored) · HTTP-only, Secure, SameSite cookies · CSRF origin check and per-session token · rate limiting on login and reset · server-side role and ownership checks on every request · `centerId` scoping on every center-owned record · strict CSP and Helmet headers · Zod input validation · audit log · safe error responses.

The system is designed with GDPR principles in mind (data minimization, access control, archive-before-delete, planned export and retention workflows). This does **not** constitute a claim of legal compliance, which requires a separate assessment.
