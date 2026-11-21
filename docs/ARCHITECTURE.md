# EduCore — Architecture

EduCore is a role-based management and learning portal for Greek tutoring centers (φροντιστήρια). This document covers the architecture, the data model, the API and application routes, the security model, and the delivery plan.

## 1. System overview

```
┌────────────────────────── single Node.js process ──────────────────────────┐
│                                                                            │
│  Express                                                                   │
│  ├── /api/*           JSON API (helmet, rate limit, session, CSRF, zod)    │
│  │     └── Prisma ──────────────────────────────▶ PostgreSQL (external)    │
│  │     └── Storage adapter (Phase 3) ───────────▶ S3-compatible bucket     │
│  ├── /assets/*        hashed Vite build output (immutable cache)           │
│  └── /*               SPA fallback → client/dist/index.html                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

* **Monorepo** with npm workspaces: `client/` (React + Vite) and `server/` (Express + Prisma).
* **One deployable process.** `npm run build` compiles the client into `client/dist` and the server into `server/dist`. `npm start` runs Express, which serves the API and the compiled SPA. This matches Hostinger's Node.js hosting, which runs one Node app on a single `PORT`.
* **Stateless app tier.** Sessions live in PostgreSQL and files live in object storage, so the process keeps nothing on local disk.

### Technology

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router 7, TanStack Query |
| UI | Tailwind CSS, shadcn/ui components (Radix primitives), Lucide icons, Recharts, sonner toasts |
| i18n | i18next. Greek is the default and English is secondary. Dictionaries are typed (`client/src/locales`) |
| Backend | Node ≥ 20, Express 5, TypeScript (ESM) |
| Validation | Zod on every request body and query |
| Database | PostgreSQL via Prisma ORM, with versioned SQL migrations |
| Auth | Argon2id passwords and server-side sessions in HTTP-only cookies |
| Files | Private S3-compatible storage with short-lived signed URLs (Phase 3) |
| Tests | Vitest and Supertest against a real PostgreSQL test database |

## 2. Repository layout

```
├── package.json              workspace scripts (dev / build / start / test / db:*)
├── docs/ARCHITECTURE.md
├── client/
│   ├── index.html, vite.config.ts, tailwind.config.ts, components.json
│   └── src/
│       ├── main.tsx, App.tsx       providers + routes
│       ├── lib/                    api client, i18n, nav config, types, Greek helpers
│       ├── locales/                el.ts (source of truth), en.ts (typed against el)
│       ├── components/ui/          shadcn/ui components
│       ├── components/layout/      AppShell, Sidebar, Topbar
│       └── features/<module>/      auth, dashboard, platform, profile, … (one folder per module)
└── server/
    ├── prisma/schema.prisma        data model
    ├── prisma/migrations/          SQL migrations (committed)
    ├── prisma/seed.ts              demo data ("Φροντιστήριο Ακαδημία")
    ├── src/
    │   ├── index.ts                process entry (listen, graceful shutdown, housekeeping)
    │   ├── app.ts                  Express app factory (used by tests too)
    │   ├── config/env.ts           zod-validated environment
    │   ├── lib/                    prisma, session, password, crypto, access (ownership), audit, errors
    │   ├── middleware/             auth guards, CSRF, rate limits, error handler
    │   └── modules/<module>/       routes.ts (+ service.ts) per module
    └── tests/                      integration tests + fixtures
```

## 3. Tenancy and authorization model

### Identity vs. membership

* `User` is a **global identity**: email, password hash, name and status.
* `CenterMembership(userId, centerId, role)` gives a user a role **inside one center**. A user has at most one membership per center.
* `SUPER_ADMIN` is a **platform role** stored on `User.platformRole`. It is not tied to a center.
* Each session has an `activeCenterId`. The server resolves the effective role on **every request** from the database (`middleware/auth.ts → loadSession`). The client never sends its role, so it cannot influence it.

### Center isolation

Every center-owned table has a `centerId` column with a foreign key to `TutoringCenter`. Handlers obtain `centerId` from `req.auth`, never from the request, and put it in every `where` clause. Lookups by id therefore use `findFirst({ where: { id, centerId } })`, which returns nothing when the record belongs to another center. Such lookups return **404 (not 403)** so the response doesn't reveal that the record exists.

### Ownership checks (`server/src/lib/access.ts`)

| Role | Classes visible | Student records visible |
|---|---|---|
| SUPER_ADMIN | any, in the active center | any, in the active center |
| CENTER_ADMIN | all classes of their center | all students of their center |
| TEACHER | classes they are assigned to (`ClassTeacherAssignment`) | students actively enrolled in those classes |
| STUDENT | classes they are actively enrolled in | only their own `StudentProfile` |
| PARENT | classes their linked children attend | only explicitly linked children (`ParentStudentLink`) |

`canAccessClass(ctx, classId)` and `canAccessStudent(ctx, studentId)` implement this table. Each later module composes them with role guards (`requireRole`, `requireCenter`).

## 4. Data model

Defined in `server/prisma/schema.prisma`. Relationships:

```
TutoringCenter 1─* CenterMembership *─1 User 1─* Session
      │                                   │
      ├─* AcademicYear 1─* ClassGroup     ├─* StudentProfile (per center)
      ├─* Subject      1─* ClassGroup     ├─* TeacherProfile (per center) *─* Subject
      │                                   └─* ParentStudentLink *─1 StudentProfile
      │
ClassGroup 1─* ClassScheduleSlot   (weekly recurring timetable)
           1─* Enrollment *─1 StudentProfile            unique(classGroupId, studentId)
           1─* ClassTeacherAssignment *─1 TeacherProfile unique(classGroupId, teacherId)
           1─* Lesson 1─* Attendance *─1 StudentProfile   unique(lessonId, studentId)
           1─* Exam   1─* ExamGrade  *─1 StudentProfile   unique(examId, studentId)
           1─* Assignment 1─* AssignmentSubmission *─1 StudentProfile unique(assignmentId, studentId)
           1─* EducationalMaterial 1─1 FileAsset
           1─* Announcement 1─* AnnouncementStudentTarget
           1─* CalendarEvent

FileAsset ── referenced by EducationalMaterial, AssignmentAttachment, SubmissionFile
Notification *─1 User          AuditLog *─1 User (actor), *─1 TutoringCenter
PasswordResetToken *─1 User
```

Design notes:

* **Draft grades:** `Exam.resultsPublishedAt = null` means the grades are drafts. Student and parent queries must filter on `resultsPublishedAt IS NOT NULL`. Submission feedback follows the same rule through `feedbackPublishedAt`.
* **Grading scales:** `GradeScale` is either `SCALE_20` (the Greek 0–20 scale) or `PERCENT`. Each exam stores its own `maxScore` and scale. Each center has a default scale.
* **Files:** every stored object goes through `FileAsset`. Its `storageKey` is generated by the server, and the original filename is kept only as metadata. Authorization for a file comes from the record that owns it (a material, assignment or submission).
* **Deletion policies:** deleting a center cascades to all of its data. Actor references (`uploadedById`, `authorId`, `AuditLog.actorId`) use `SET NULL`, so history survives when a user is deleted. `ClassGroup → Subject/AcademicYear` uses `RESTRICT`, so subjects and years can't be deleted while classes use them. Students and teachers are **archived** (`archivedAt`) rather than deleted.
* **Indexes:** each center-scoped table has a composite index that leads with `centerId`. Hot lookups are covered: `(userId, readAt)` for unread notifications, `(classGroupId, startsAt)` for lessons, and so on.

## 5. API routes

All routes live under `/api`. JSON in and out. Errors use the shape `{ error: { code, message, details? } }`.

### Implemented (Phase 1)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | public | Liveness and DB check (200, or 503 when degraded) |
| POST | `/auth/login` | public, rate-limited | Email and password login. Sets the session cookie and returns `me` |
| POST | `/auth/logout` | session | Deletes the session server-side and clears the cookie |
| GET | `/auth/me` | session | User, effective role, active center, centers list, CSRF token |
| POST | `/auth/switch-center` | session | Changes the active center (memberships only; any center for a super admin) |
| POST | `/auth/password/forgot` | public, rate-limited | Creates a 30-minute reset token. Always returns 202 |
| POST | `/auth/password/reset` | public, rate-limited | Consumes the token, sets the password and revokes all sessions |
| POST | `/auth/password/change` | session | Verifies the current password and revokes the user's other sessions |
| PATCH | `/me/profile` | session | Name, phone, locale |
| GET | `/overview` | any center role | Role-aware home summary (counts, classes, timetable, children) |
| GET | `/platform/centers/stats` | SUPER_ADMIN | Platform aggregates |
| GET/POST | `/platform/centers` | SUPER_ADMIN | List and create centers |
| PATCH | `/platform/centers/:id` | SUPER_ADMIN | Edit, activate or deactivate a center |
| GET/POST | `/platform/centers/:id/admins` | SUPER_ADMIN | List and create center administrators |
| PATCH | `/platform/centers/:id/admins/:membershipId` | SUPER_ADMIN | Suspend or reactivate an administrator |
| GET | `/platform/centers/activity` | SUPER_ADMIN | Latest 50 audit events |

### Planned

| Phase | Endpoints |
|---|---|
| 2 | `/dashboard/admin`, `/students` (CRUD, archive, search, pagination), `/students/:id/history`, `/teachers`, `/parents` + links, `/subjects`, `/academic-years`, `/classes` (+ enrollments, teachers, schedule) |
| 3 | `/materials` (upload, list, signed download), `/announcements`, `/dashboard/student` |
| 4 | `/exams` (+ grades, publish), `/assignments` (+ submissions, review, publish feedback), `/lessons`, `/attendance` |
| 5 | `/parent/children/:id/*`, `/calendar/events`, `/notifications` (list, unread count, mark read), `/reports` |
| 6 | `/me/export` (GDPR data export), retention jobs |

## 6. Application routes (SPA)

| Path | Roles | Status |
|---|---|---|
| `/login`, `/forgot-password`, `/reset-password` | public | ✅ |
| `/` | all (role-specific dashboard) | ✅ Phase 1 summary. Full dashboards in Phases 2–5 |
| `/profile` | all | ✅ |
| `/platform` | SUPER_ADMIN | ✅ |
| `/students`, `/teachers`, `/parents`, `/subjects` | CENTER_ADMIN | Phase 2 |
| `/classes` | CENTER_ADMIN, TEACHER | Phase 2 |
| `/courses`, `/materials`, `/announcements` | all center roles | Phase 3 |
| `/exams`, `/assignments`, `/attendance`, `/grades` | role-dependent | Phase 4 |
| `/children`, `/calendar`, `/reports` | role-dependent | Phase 5 |

Sidebar entries for modules that don't exist yet carry a `Φn` badge and open a page that says which phase delivers them. They don't pretend to work.

## 7. Security model

| Concern | Implementation |
|---|---|
| Passwords | Argon2id (m = 19 MiB, t = 2, p = 1). Minimum 10 characters |
| User enumeration | Same 401 message for an unknown email and a wrong password. A dummy hash check equalizes timing. Forgot-password always returns 202 |
| Sessions | 256-bit random token in an HTTP-only, `SameSite=Lax` cookie (`Secure` and the `__Host-` prefix in production). The DB stores only an HMAC-SHA256 of the token. 2-hour sliding idle timeout and a 72-hour absolute cap (configurable) |
| Session revocation | Logout deletes the row. Password reset revokes all sessions. Password change revokes all others. Suspending a user or membership, or deactivating a center, cuts access on the next request |
| CSRF | (1) Origin/Referer allow-list on every mutation. (2) Synchronizer token: each session has a `csrfToken`, which the SPA sends as `X-CSRF-Token`. (3) `SameSite=Lax` cookies |
| Rate limiting | Login: 10 per 15 min per IP+email. Password reset: 5 per hour. API: 300 per minute per IP |
| Authorization | Server-side only: `requireRole`, `requireCenter`, centerId scoping and ownership helpers |
| Input | Zod schemas. JSON bodies are capped at 1 MB |
| Headers | Helmet with a strict CSP (`script-src 'self'`, no inline scripts) |
| Errors | Internal details are logged with pino and secrets redacted. Clients receive generic messages |
| Audit | `AuditLog` records logins, failed logins, password events, center and admin changes. Phases 2–4 add grade publication, archiving and permission changes |
| Secrets | Read from the environment and validated at boot. The process refuses to start with a missing or weak `SESSION_SECRET` |

GDPR-oriented design: data minimization (student profiles hold only what's needed), role-scoped access, archive-before-delete, audit trail, and planned export and retention workflows. This is not a claim of legal compliance, which needs a separate assessment.

## 8. Milestones

| Phase | Scope | Status |
|---|---|---|
| **1** | Monorepo, full Prisma schema and migration, env validation, auth (login/logout/me, reset, change, center switch), sessions, CSRF, rate limits, audit, access helpers, platform admin (centers and admins), app shell (sidebar, mobile drawer, dark mode, el/en), role-aware home pages, structural seed, integration tests | ✅ |
| 2 | Admin dashboard (metrics and charts), student CRUD with search, filter, pagination, archive and history; teachers, parents and links, subjects, academic years, classes with enrollment, teachers and weekly schedule | |
| 3 | Student dashboard, storage adapter (S3 and local dev), educational materials with preview and signed download, announcements with targeting | |
| 4 | Exams and grades (0–20 / %, drafts and publishing, feedback), assignments and submissions (statuses, late rules, review), lessons and attendance | |
| 5 | Parent portal with child selector, calendar (month/week/day), notification center, reporting | |
| 6 | Full demo data (lessons, grades, attendance, materials and PDFs, notifications), expanded tests, responsive polish, security review, deployment hardening | |

Every phase ends with a green `npm run typecheck`, `npm test` and `npm run build`, plus a smoke test of the built app.
