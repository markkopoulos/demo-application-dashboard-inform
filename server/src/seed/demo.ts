/**
 * Demo seed — "Φροντιστήριο Ακαδημία" (fictional).
 * All people, emails and data are invented. Emails use the reserved
 * `.example` TLD so nothing can ever be delivered to a real inbox.
 *
 * Two modes (see src/seed/cli.ts):
 *   - `--if-empty`: inserts demo data only when there are no users yet.
 *     Safe to run on every start; used by `npm run start:prod` when DEMO_SEED=true.
 *   - default: WIPES THE DATABASE and reseeds. Refuses in production unless
 *     SEED_ALLOW_PRODUCTION=true is set explicitly.
 */
import { PrismaClient, type EducationLevel, type TeacherProfile } from "@prisma/client";
import argon2 from "argon2";

let prisma: PrismaClient;

export const DEMO_PASSWORD = "EduCore2026!";

const SUBJECTS = [
  { name: "Μαθηματικά", code: "MATH", color: "#2563eb" },
  { name: "Φυσική", code: "PHYS", color: "#7c3aed" },
  { name: "Χημεία", code: "CHEM", color: "#059669" },
  { name: "Αρχαία Ελληνικά", code: "ANC", color: "#b45309" },
  { name: "Νέα Ελληνικά", code: "MGR", color: "#db2777" },
  { name: "Έκθεση", code: "ESS", color: "#0891b2" },
  { name: "Αγγλικά", code: "ENG", color: "#dc2626" },
  { name: "Γαλλικά", code: "FRA", color: "#4f46e5" },
] as const;

const TEACHERS = [
  { firstName: "Γιώργος", lastName: "Παπαδόπουλος", title: "Μαθηματικός", subjects: ["Μαθηματικά"] },
  { firstName: "Ελένη", lastName: "Κωνσταντίνου", title: "Φυσικός", subjects: ["Φυσική", "Χημεία"] },
  { firstName: "Δημήτρης", lastName: "Αλεξίου", title: "Φιλόλογος", subjects: ["Αρχαία Ελληνικά", "Νέα Ελληνικά"] },
  { firstName: "Μαρία", lastName: "Νικολάου", title: "Φιλόλογος", subjects: ["Έκθεση", "Νέα Ελληνικά"] },
  { firstName: "Κατερίνα", lastName: "Βασιλείου", title: "Καθηγήτρια Ξένων Γλωσσών", subjects: ["Αγγλικά", "Γαλλικά"] },
];

const STUDENT_FIRST_M = ["Νίκος", "Γιάννης", "Κώστας", "Αλέξανδρος", "Παναγιώτης", "Βασίλης", "Στέφανος", "Θοδωρής", "Άγγελος", "Μιχάλης", "Χρήστος", "Λευτέρης", "Σπύρος", "Ηλίας", "Φίλιππος"];
const STUDENT_FIRST_F = ["Σοφία", "Αθηνά", "Δέσποινα", "Ιωάννα", "Χριστίνα", "Αναστασία", "Ευαγγελία", "Ζωή", "Μυρτώ", "Δανάη", "Φωτεινή", "Κωνσταντίνα", "Ραφαέλα", "Ειρήνη", "Βασιλική"];
// Family names in [masculine, feminine] form so siblings/parents match grammatically.
const FAMILIES: [string, string][] = [
  ["Γεωργίου", "Γεωργίου"],
  ["Ιωάννου", "Ιωάννου"],
  ["Δημητρίου", "Δημητρίου"],
  ["Μαυρίδης", "Μαυρίδου"],
  ["Οικονόμου", "Οικονόμου"],
  ["Καραγιάννης", "Καραγιάννη"],
  ["Πετρόπουλος", "Πετροπούλου"],
  ["Σταματόπουλος", "Σταματοπούλου"],
  ["Χατζηδάκης", "Χατζηδάκη"],
  ["Λαμπράκης", "Λαμπράκη"],
];
const PARENT_FIRST: [string, "M" | "F"][] = [
  ["Αντώνης", "M"], ["Βασιλική", "F"], ["Σταύρος", "M"], ["Παρασκευή", "F"], ["Ευάγγελος", "M"],
  ["Αικατερίνη", "F"], ["Θανάσης", "M"], ["Γεωργία", "F"], ["Μανώλης", "M"], ["Αλεξάνδρα", "F"],
];

const translit: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z", η: "i", ή: "i", θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y",
  φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
};
const latin = (s: string) => [...s.toLowerCase()].map((c) => translit[c] ?? c).join("").replace(/[^a-z]/g, "");

// Deterministic PRNG so the demo looks the same after every reseed.
let rngState = 20262026;
const rand = () => ((rngState = (rngState * 1664525 + 1013904223) % 4294967296) / 4294967296);


async function wipe() {
  // Order matters only for tables without cascading FKs; center deletion cascades the rest.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  // MySQL enforces RESTRICT (ClassGroup → Subject/AcademicYear) mid-cascade,
  // so remove classes (which cascade exams, lessons, …) before their centers.
  await prisma.classGroup.deleteMany();
  await prisma.tutoringCenter.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedDemo(client: PrismaClient, { wipeFirst }: { wipeFirst: boolean }) {
  prisma = client;
  console.log("Seeding EduCore demo data…");
  if (wipeFirst) await wipe();

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const domain = "akadimia.example";

  // ── Platform super admin ──────────────────────────────────────────────────
  await prisma.user.create({
    data: { email: "superadmin@educore.example", firstName: "Πλατφόρμα", lastName: "Διαχειριστής", passwordHash, platformRole: "SUPER_ADMIN" },
  });

  // ── Center ────────────────────────────────────────────────────────────────
  const center = await prisma.tutoringCenter.create({
    data: {
      name: "Φροντιστήριο Ακαδημία",
      slug: "akadimia",
      city: "Αθήνα",
      address: "Λεωφ. Αλεξάνδρας 120, Αθήνα 114 71",
      phone: "210 000 0000",
      email: `info@${domain}`,
    },
  });
  const centerId = center.id;

  const [pastYear, currentYear] = await Promise.all([
    prisma.academicYear.create({
      data: { centerId, label: "2024-2025", startDate: new Date("2024-09-01"), endDate: new Date("2025-06-30") },
    }),
    prisma.academicYear.create({
      data: { centerId, label: "2025-2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isCurrent: true },
    }),
  ]);

  await prisma.user.create({
    data: {
      email: `admin@${domain}`,
      firstName: "Αναστασία",
      lastName: "Ραφαηλίδου",
      phone: "690 000 0001",
      passwordHash,
      memberships: { create: { centerId, role: "CENTER_ADMIN" } },
    },
  });

  const subjects = Object.fromEntries(
    await Promise.all(SUBJECTS.map(async (s) => [s.name, await prisma.subject.create({ data: { centerId, ...s } })] as const)),
  );

  // ── Teachers ─────────────────────────────────────────────────────────────
  const teachers: ((typeof TEACHERS)[number] & { profile: TeacherProfile })[] = [];
  for (const [i, t] of TEACHERS.entries()) {
    const email = i === 0 ? `teacher@${domain}` : `${latin(t.firstName)}.${latin(t.lastName)}@${domain}`;
    const user = await prisma.user.create({
      data: { email, firstName: t.firstName, lastName: t.lastName, passwordHash, memberships: { create: { centerId, role: "TEACHER" } } },
    });
    const profile = await prisma.teacherProfile.create({
      data: {
        centerId,
        userId: user.id,
        title: t.title,
        subjects: { connect: t.subjects.map((n) => ({ id: subjects[n]!.id })) },
      },
    });
    teachers.push({ ...t, profile });
  }
  const teacherFor = (subject: string) => teachers.find((t) => t.subjects.includes(subject))!.profile;

  // ── Classes ──────────────────────────────────────────────────────────────
  const CLASSES: { name: string; subject: string; level: EducationLevel; room: string; slots: [number, string, string][]; teacher?: number }[] = [
    { name: "Μαθηματικά Γ' Λυκείου", subject: "Μαθηματικά", level: "LYK_C", room: "Αίθουσα 1", slots: [[1, "17:00", "19:00"], [4, "17:00", "19:00"]] },
    { name: "Μαθηματικά Β' Λυκείου", subject: "Μαθηματικά", level: "LYK_B", room: "Αίθουσα 1", slots: [[2, "16:00", "17:30"], [5, "16:00", "17:30"]] },
    { name: "Φυσική Γ' Λυκείου", subject: "Φυσική", level: "LYK_C", room: "Αίθουσα 2", slots: [[2, "18:00", "20:00"], [5, "18:00", "20:00"]] },
    { name: "Χημεία Β' Λυκείου", subject: "Χημεία", level: "LYK_B", room: "Εργαστήριο", slots: [[3, "16:00", "17:30"]] },
    { name: "Αρχαία Ελληνικά Γ' Λυκείου", subject: "Αρχαία Ελληνικά", level: "LYK_C", room: "Αίθουσα 3", slots: [[1, "19:15", "21:00"], [3, "19:15", "21:00"]], teacher: 2 },
    { name: "Έκθεση Γ' Γυμνασίου", subject: "Έκθεση", level: "GYM_C", room: "Αίθουσα 3", slots: [[2, "15:00", "16:30"]], teacher: 3 },
    { name: "Αγγλικά B2", subject: "Αγγλικά", level: "GYM_C", room: "Αίθουσα 4", slots: [[1, "15:30", "17:00"], [3, "15:30", "17:00"]] },
    { name: "Γαλλικά DELF B1", subject: "Γαλλικά", level: "LYK_A", room: "Αίθουσα 4", slots: [[4, "15:30", "17:00"]] },
  ];
  const classes = [];
  for (const c of CLASSES) {
    const teacher = c.teacher !== undefined ? teachers[c.teacher]!.profile : teacherFor(c.subject);
    const cls = await prisma.classGroup.create({
      data: {
        centerId,
        academicYearId: currentYear.id,
        subjectId: subjects[c.subject]!.id,
        name: c.name,
        level: c.level,
        room: c.room,
        capacity: 12,
        color: subjects[c.subject]!.color,
        scheduleSlots: { create: c.slots.map(([dayOfWeek, startTime, endTime]) => ({ centerId, dayOfWeek, startTime, endTime, room: c.room })) },
        teachers: { create: { centerId, teacherId: teacher.id, isPrimary: true } },
      },
    });
    classes.push({ ...c, cls });
  }
  // A class from last year (archived) so history views have something to show.
  await prisma.classGroup.create({
    data: {
      centerId,
      academicYearId: pastYear.id,
      subjectId: subjects["Μαθηματικά"]!.id,
      name: "Μαθηματικά Β' Λυκείου",
      level: "LYK_B",
      room: "Αίθουσα 1",
      archivedAt: new Date("2025-06-30"),
      teachers: { create: { centerId, teacherId: teachers[0]!.profile.id } },
    },
  });

  // ── Students & parents ───────────────────────────────────────────────────
  const levelsByIndex: EducationLevel[] = ["LYK_C", "LYK_C", "LYK_B", "LYK_B", "LYK_A", "GYM_C"];
  const students = [];
  for (let i = 0; i < 30; i++) {
    const female = i % 2 === 1;
    const family = FAMILIES[i % FAMILIES.length]!;
    const firstName = female ? STUDENT_FIRST_F[Math.floor(i / 2)]! : STUDENT_FIRST_M[Math.floor(i / 2)]!;
    const lastName = female ? family[1] : family[0];
    const email = i === 0 ? `student@${domain}` : `${latin(firstName)}.${latin(lastName)}${i}@students.${domain}`;
    const level = levelsByIndex[i % levelsByIndex.length]!;
    const user = await prisma.user.create({
      data: { email, firstName, lastName, passwordHash, memberships: { create: { centerId, role: "STUDENT" } } },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        centerId,
        userId: user.id,
        studentCode: `AK-${String(2500 + i + 1)}`,
        level,
        academicYearId: currentYear.id,
        enrollmentDate: new Date(2025, 8, 1 + (i % 20)),
      },
    });
    students.push({ profile, level, familyIndex: i % FAMILIES.length });
  }

  // Enroll by level: each student takes 2–4 classes matching their level (+ a language).
  const levelMatch: Record<EducationLevel, EducationLevel[]> = {
    LYK_C: ["LYK_C"], LYK_B: ["LYK_B"], LYK_A: ["LYK_A", "LYK_B"], GYM_C: ["GYM_C"], GYM_B: ["GYM_C"], GYM_A: ["GYM_C"],
  };
  for (const s of students) {
    const eligible = classes.filter((c) => levelMatch[s.level].includes(c.level) && !["Αγγλικά", "Γαλλικά"].includes(c.subject));
    const language = rand() < 0.6 ? classes.find((c) => c.subject === "Αγγλικά")! : classes.find((c) => c.subject === "Γαλλικά")!;
    const chosen = new Set([...eligible.slice(0, 3), language]);
    for (const c of chosen) {
      await prisma.enrollment.create({ data: { centerId, classGroupId: c.cls.id, studentId: s.profile.id, enrolledAt: s.profile.enrollmentDate } });
    }
  }

  // 10 parents; each family's parent is linked to all students of that family (siblings → multi-child selector).
  for (let f = 0; f < 10; f++) {
    const [firstName, gender] = PARENT_FIRST[f]!;
    const family = FAMILIES[f]!;
    const lastName = gender === "F" ? family[1] : family[0];
    const email = f === 0 ? `parent@${domain}` : `${latin(firstName)}.${latin(lastName)}@parents.${domain}`;
    const user = await prisma.user.create({
      data: { email, firstName, lastName, passwordHash, memberships: { create: { centerId, role: "PARENT" } } },
    });
    for (const s of students.filter((st) => st.familyIndex === f)) {
      await prisma.parentStudentLink.create({
        data: { centerId, parentUserId: user.id, studentId: s.profile.id, relationship: gender === "F" ? "Μητέρα" : "Πατέρας" },
      });
    }
  }

  // ── Second, small center (demonstrates multi-tenant isolation) ───────────
  const other = await prisma.tutoringCenter.create({
    data: { name: "Φροντιστήριο Πρόοδος", slug: "proodos", city: "Θεσσαλονίκη", email: "info@proodos.example" },
  });
  await prisma.academicYear.create({
    data: { centerId: other.id, label: "2025-2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isCurrent: true },
  });
  await prisma.user.create({
    data: {
      email: "admin@proodos.example",
      firstName: "Λάμπρος",
      lastName: "Τσακίρης",
      passwordHash,
      memberships: { create: { centerId: other.id, role: "CENTER_ADMIN" } },
    },
  });


  const counts = {
    users: await prisma.user.count(),
    students: await prisma.studentProfile.count({ where: { centerId } }),
    teachers: await prisma.teacherProfile.count({ where: { centerId } }),
    classes: await prisma.classGroup.count({ where: { centerId } }),
    enrollments: await prisma.enrollment.count({ where: { centerId } }),
  };
  console.log("Done.", counts);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

