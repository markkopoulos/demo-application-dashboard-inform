import {
  LayoutDashboard, Users, GraduationCap, UsersRound, School, BookOpen, FolderOpen, ClipboardList, FileCheck2, BarChart3,
  CalendarCheck, CalendarDays, Megaphone, UserCircle, Building2, Baby, LineChart, type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/locales/el";
import type { Role } from "./types";

export type NavKey = keyof Dictionary["nav"];

export interface NavItem {
  key: NavKey;
  path: string;
  icon: LucideIcon;
  /** Project phase in which the module ships. Undefined = available now. */
  phase?: number;
}
export interface NavSection {
  key: NavKey;
  items: NavItem[];
}

const home: NavItem = { key: "home", path: "/", icon: LayoutDashboard };
const profile: NavItem = { key: "profile", path: "/profile", icon: UserCircle };

const ADMIN: NavSection[] = [
  { key: "sectionMain", items: [{ ...home, key: "dashboard" }] },
  {
    key: "sectionAdmin",
    items: [
      { key: "students", path: "/students", icon: GraduationCap, phase: 2 },
      { key: "teachers", path: "/teachers", icon: Users, phase: 2 },
      { key: "parents", path: "/parents", icon: UsersRound, phase: 2 },
      { key: "classes", path: "/classes", icon: School, phase: 2 },
      { key: "subjects", path: "/subjects", icon: BookOpen, phase: 2 },
    ],
  },
  {
    key: "sectionAcademic",
    items: [
      { key: "materials", path: "/materials", icon: FolderOpen, phase: 3 },
      { key: "exams", path: "/exams", icon: FileCheck2, phase: 4 },
      { key: "assignments", path: "/assignments", icon: ClipboardList, phase: 4 },
      { key: "attendance", path: "/attendance", icon: CalendarCheck, phase: 4 },
      { key: "calendar", path: "/calendar", icon: CalendarDays, phase: 5 },
      { key: "announcements", path: "/announcements", icon: Megaphone, phase: 3 },
      { key: "reports", path: "/reports", icon: LineChart, phase: 5 },
    ],
  },
  { key: "sectionAccount", items: [profile] },
];

const TEACHER: NavSection[] = [
  { key: "sectionMain", items: [home, { key: "myClasses", path: "/classes", icon: School, phase: 2 }] },
  {
    key: "sectionAcademic",
    items: [
      { key: "materials", path: "/materials", icon: FolderOpen, phase: 3 },
      { key: "assignments", path: "/assignments", icon: ClipboardList, phase: 4 },
      { key: "exams", path: "/exams", icon: FileCheck2, phase: 4 },
      { key: "attendance", path: "/attendance", icon: CalendarCheck, phase: 4 },
      { key: "calendar", path: "/calendar", icon: CalendarDays, phase: 5 },
      { key: "announcements", path: "/announcements", icon: Megaphone, phase: 3 },
    ],
  },
  { key: "sectionAccount", items: [profile] },
];

// Order follows the student navigation in the product brief.
const STUDENT: NavSection[] = [
  {
    key: "sectionMain",
    items: [
      home,
      { key: "myClasses", path: "/courses", icon: School, phase: 3 },
      { key: "materials", path: "/materials", icon: FolderOpen, phase: 3 },
      { key: "assignments", path: "/assignments", icon: ClipboardList, phase: 4 },
      { key: "exams", path: "/exams", icon: FileCheck2, phase: 4 },
      { key: "grades", path: "/grades", icon: BarChart3, phase: 4 },
      { key: "attendance", path: "/attendance", icon: CalendarCheck, phase: 4 },
      { key: "calendar", path: "/calendar", icon: CalendarDays, phase: 5 },
      { key: "announcements", path: "/announcements", icon: Megaphone, phase: 3 },
    ],
  },
  { key: "sectionAccount", items: [profile] },
];

const PARENT: NavSection[] = [
  {
    key: "sectionMain",
    items: [
      home,
      { key: "children", path: "/children", icon: Baby, phase: 5 },
      { key: "grades", path: "/grades", icon: BarChart3, phase: 5 },
      { key: "exams", path: "/exams", icon: FileCheck2, phase: 5 },
      { key: "attendance", path: "/attendance", icon: CalendarCheck, phase: 5 },
      { key: "calendar", path: "/calendar", icon: CalendarDays, phase: 5 },
      { key: "announcements", path: "/announcements", icon: Megaphone, phase: 3 },
    ],
  },
  { key: "sectionAccount", items: [profile] },
];

const PLATFORM: NavSection = { key: "sectionAdmin", items: [{ key: "centers", path: "/platform", icon: Building2 }] };

export function navFor(role: Role | null, hasCenter: boolean): NavSection[] {
  switch (role) {
    case "SUPER_ADMIN":
      // A super admin inside a center gets the center-admin tools as well.
      return hasCenter ? [{ ...PLATFORM, key: "sectionMain" }, ...ADMIN] : [PLATFORM, { key: "sectionAccount", items: [profile] }];
    case "CENTER_ADMIN":
      return ADMIN;
    case "TEACHER":
      return TEACHER;
    case "STUDENT":
      return STUDENT;
    case "PARENT":
      return PARENT;
    default:
      return [{ key: "sectionAccount", items: [profile] }];
  }
}

/** All not-yet-built routes across roles, so the router can render a clear "in development" page. */
export function phasedRoutes(role: Role | null, hasCenter: boolean): NavItem[] {
  return navFor(role, hasCenter)
    .flatMap((s) => s.items)
    .filter((i) => i.phase);
}
