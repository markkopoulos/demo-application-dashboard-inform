import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Calendar, ClipboardList, FileCheck2, FolderOpen, GraduationCap, Megaphone, School, Users, UsersRound, BarChart3, Baby } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/features/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState, EmptyState } from "@/components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassCards, StatCard, StatSkeletons, TodayLessons, WeekSchedule } from "./widgets";
import { timeOfDay, vocative } from "@/lib/greek";
import { cn } from "@/lib/utils";
import type { Overview } from "@/lib/types";

function useGreeting() {
  const me = useMe();
  const { t, i18n } = useTranslation();
  const name = i18n.language === "el" ? vocative(me.user.firstName) : me.user.firstName;
  return `${t(`greeting.${timeOfDay()}`)}, ${name}!`;
}

function Roadmap({ items }: { items: { icon: typeof Megaphone; label: string; phase: number }[] }) {
  const { t } = useTranslation();
  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>{t("dashboard.roadmapTitle")}</CardTitle>
        <CardDescription>{t("dashboard.roadmapBody")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
              <i.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm">{i.label}</span>
              <span className="shrink-0 rounded bg-secondary px-1.5 py-px text-[10px] font-semibold text-muted-foreground">Φ{i.phase}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function LoadingLayout() {
  return (
    <div className="space-y-6">
      <StatSkeletons />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export function HomePage() {
  const me = useMe();
  const { t } = useTranslation();
  const greeting = useGreeting();
  const query = useQuery({ queryKey: ["overview", me.center?.id], queryFn: () => api.get<Overview>("/overview"), enabled: !!me.center });

  if (me.role === "SUPER_ADMIN" && !me.center) return <Navigate to="/platform" replace />;
  if (!me.center || !me.role) {
    return <EmptyState icon={School} title={t("auth.noCenter")} body={t("auth.noCenterBody")} className="mt-10" />;
  }

  const intro = { CENTER_ADMIN: "overview", SUPER_ADMIN: "overview", TEACHER: "teacherIntro", STUDENT: "studentIntro", PARENT: "parentIntro" } as const;
  const isStudent = me.role === "STUDENT";

  return (
    <div className="min-w-0 space-y-6">
      {isStudent ? (
        <div className="relative overflow-hidden rounded-2xl bg-[#0b1430] px-6 py-8 text-white shadow-elevated sm:px-8 sm:py-10 dark:bg-[#111a3a]">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-40 w-40 rounded-full bg-violet-500/20 blur-2xl" />
          <span className="relative inline-flex rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-indigo-100">{me.center.name}</span>
          <h1 className="relative mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}</h1>
          <p className="relative mt-2 max-w-xl text-sm text-indigo-100/80 sm:text-base">{t(`dashboard.${intro[me.role]}`)}</p>
        </div>
      ) : (
        <PageHeader title={greeting} description={t(`dashboard.${intro[me.role]}`)} />
      )}

      {query.isPending ? (
        <LoadingLayout />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : (
        <OverviewBody data={query.data} />
      )}
    </div>
  );
}

function OverviewBody({ data }: { data: Overview }) {
  const { t } = useTranslation();
  switch (data.kind) {
    case "admin":
      return (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("dashboard.activeStudents")} value={data.counts.students} icon={GraduationCap} tone="accent" />
            <StatCard label={t("dashboard.teachers")} value={data.counts.teachers} icon={Users} tone="violet" />
            <StatCard label={t("dashboard.activeClasses")} value={data.counts.classes} icon={School} tone="success" hint={data.academicYear ? `${t("dashboard.academicYear")} ${data.academicYear}` : undefined} />
            <StatCard label={t("dashboard.parents")} value={data.counts.parents} icon={UsersRound} tone="sky" />
          </div>
          <WeekSchedule classes={data.classes} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <h2 className="mb-3 text-base font-semibold">{t("dashboard.classes")}</h2>
              <ClassCards classes={data.classes} />
            </div>
            <Roadmap
              items={[
                { icon: GraduationCap, label: t("nav.students"), phase: 2 },
                { icon: FolderOpen, label: t("nav.materials"), phase: 3 },
                { icon: Megaphone, label: t("nav.announcements"), phase: 3 },
                { icon: FileCheck2, label: t("nav.exams"), phase: 4 },
                { icon: ClipboardList, label: t("nav.assignments"), phase: 4 },
                { icon: Calendar, label: t("nav.calendar"), phase: 5 },
              ]}
            />
          </div>
        </>
      );
    case "teacher":
      return (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t("dashboard.myClasses")} value={data.counts.classes} icon={School} tone="accent" />
            <StatCard label={t("dashboard.myStudents")} value={data.counts.students} icon={GraduationCap} tone="violet" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <WeekSchedule classes={data.classes} />
            </div>
            <TodayLessons classes={data.classes} />
          </div>
          <div>
            <h2 className="mb-3 text-base font-semibold">{t("dashboard.myClasses")}</h2>
            <ClassCards classes={data.classes} />
          </div>
        </>
      );
    case "student":
      return (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <WeekSchedule classes={data.classes} />
            </div>
            <TodayLessons classes={data.classes} />
          </div>
          <div>
            <h2 className="mb-3 text-base font-semibold">{t("nav.myClasses")}</h2>
            <ClassCards classes={data.classes} showStudents={false} />
          </div>
          <Roadmap
            items={[
              { icon: FolderOpen, label: t("nav.materials"), phase: 3 },
              { icon: ClipboardList, label: t("nav.assignments"), phase: 4 },
              { icon: FileCheck2, label: t("nav.exams"), phase: 4 },
              { icon: BarChart3, label: t("nav.grades"), phase: 4 },
            ]}
          />
        </>
      );
    case "parent":
      return <ParentBody children={data.children} />;
  }
}

function ParentBody({ children }: { children: Extract<Overview, { kind: "parent" }>["children"] }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(children[0]?.id);
  if (!children.length) return <EmptyState icon={Baby} title={t("dashboard.noChildren")} body={t("dashboard.noChildrenBody")} />;
  const child = children.find((c) => c.id === selected) ?? children[0]!;
  return (
    <>
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("dashboard.child")}>
          {children.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === child.id}
              onClick={() => setSelected(c.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                c.id === child.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
              )}
            >
              {c.firstName}
            </button>
          ))}
        </div>
      )}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent">
          {child.firstName[0]}
          {child.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {child.firstName} {child.lastName}
          </p>
          <p className="text-sm text-muted-foreground">
            {child.level ? t(`levels.${child.level}`) : ""} · {child.studentCode}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" /> {child.classes.length} {t("nav.classes").toLowerCase()}
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <WeekSchedule classes={child.classes} />
        </div>
        <TodayLessons classes={child.classes} />
      </div>
      <ClassCards classes={child.classes} showStudents={false} />
    </>
  );
}
