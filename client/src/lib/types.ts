export type Role = "SUPER_ADMIN" | "CENTER_ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
export type EducationLevel = "GYM_A" | "GYM_B" | "GYM_C" | "LYK_A" | "LYK_B" | "LYK_C";

export interface CenterSummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
}

export interface Me {
  user: { id: string; email: string; firstName: string; lastName: string; locale: "el" | "en"; avatarUrl: string | null };
  role: Role | null;
  center: (CenterSummary & { status?: string; defaultGradeScale?: string }) | null;
  centers: (CenterSummary & { role: Role })[];
  csrfToken: string;
  sessionExpiresAt: string;
}

export interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
}

export interface ClassSummary {
  id: string;
  name: string;
  level: EducationLevel;
  room: string | null;
  color: string | null;
  subject: { id: string; name: string; color: string | null };
  schedule: ScheduleSlot[];
  teachers: string[];
  studentCount: number;
}

export type Overview =
  | { kind: "admin"; academicYear: string | null; counts: { students: number; teachers: number; parents: number; classes: number; subjects: number }; classes: ClassSummary[] }
  | { kind: "teacher"; counts: { classes: number; students: number }; classes: ClassSummary[] }
  | { kind: "student"; classes: ClassSummary[] }
  | {
      kind: "parent";
      children: { id: string; firstName: string; lastName: string; studentCode: string; level: EducationLevel | null; classes: ClassSummary[] }[];
    };
