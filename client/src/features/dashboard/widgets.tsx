import { useTranslation } from "react-i18next";
import { Clock, MapPin, School, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";
import { isoWeekday } from "@/lib/greek";
import { cn } from "@/lib/utils";
import type { ClassSummary } from "@/lib/types";

export function StatCard({ label, value, icon: Icon, tone = "accent", hint }: { label: string; value: number | string; icon: LucideIcon; tone?: "accent" | "success" | "warning" | "violet" | "sky"; hint?: string }) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  };
  return (
    <Card className="animate-fade-up p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight tabular">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function StatSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}

interface Lesson {
  cls: ClassSummary;
  startTime: string;
  endTime: string;
  room: string | null;
}

const lessonsForDay = (classes: ClassSummary[], day: number): Lesson[] =>
  classes
    .flatMap((cls) => cls.schedule.filter((s) => s.dayOfWeek === day).map((s) => ({ cls, startTime: s.startTime, endTime: s.endTime, room: s.room ?? cls.room })))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

export function TodayLessons({ classes }: { classes: ClassSummary[] }) {
  const { t } = useTranslation();
  const today = isoWeekday();
  const lessons = lessonsForDay(classes, today);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("dashboard.todayLessons")}</CardTitle>
        <span className="text-xs font-medium text-muted-foreground">{t(`days.${today}` as "days.1")}</span>
      </CardHeader>
      <CardContent>
        {lessons.length === 0 ? (
          <EmptyState icon={Clock} title={t("dashboard.noLessonsToday")} className="py-8" />
        ) : (
          <ul className="space-y-2.5">
            {lessons.map((l, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="h-10 w-1 shrink-0 rounded-full" style={{ background: l.cls.color ?? "hsl(var(--accent))" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.cls.name}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular">
                      <Clock className="h-3 w-3" /> {l.startTime}–{l.endTime}
                    </span>
                    {l.room && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {l.room}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Weekly timetable built from each class's recurring schedule slots. */
export function WeekSchedule({ classes }: { classes: ClassSummary[] }) {
  const { t } = useTranslation();
  const today = isoWeekday();
  const days = [1, 2, 3, 4, 5, 6].filter((d) => d <= 5 || classes.some((c) => c.schedule.some((s) => s.dayOfWeek === d)));
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("dashboard.weekSchedule")}</CardTitle>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <EmptyState icon={School} title={t("dashboard.noClasses")} className="py-8" />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="grid min-w-[640px] gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => {
                const lessons = lessonsForDay(classes, d);
                return (
                  <div key={d} className={cn("rounded-lg p-2", d === today ? "bg-accent-soft ring-1 ring-accent/20" : "bg-surface")}>
                    <div className={cn("mb-2 px-1 text-xs font-semibold", d === today ? "text-accent" : "text-muted-foreground")}>{t(`daysShort.${d}` as "daysShort.1")}</div>
                    <div className="space-y-1.5">
                      {lessons.length === 0 && <div className="px-1 py-3 text-center text-xs text-muted-foreground/60">—</div>}
                      {lessons.map((l, i) => (
                        <div key={i} className="rounded-md border-l-[3px] bg-card p-2 shadow-card" style={{ borderLeftColor: l.cls.color ?? undefined }}>
                          <p className="text-[11px] font-medium text-muted-foreground tabular">
                            {l.startTime}–{l.endTime}
                          </p>
                          <p className="line-clamp-2 text-xs font-medium leading-snug">{l.cls.subject.name}</p>
                          {l.room && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{l.room}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClassCards({ classes, showStudents = true }: { classes: ClassSummary[]; showStudents?: boolean }) {
  const { t } = useTranslation();
  if (!classes.length) return <EmptyState icon={School} title={t("dashboard.noClasses")} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((c) => (
        <Card key={c.id} className="overflow-hidden">
          <div className="h-1" style={{ background: c.color ?? "hsl(var(--accent))" }} />
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-2 font-semibold leading-snug">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">{c.teachers.join(", ") || "—"}</p>
              </div>
              <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t(`levels.${c.level}`)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {c.schedule.map((s, i) => (
                <span key={i} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground tabular">
                  {t(`daysShort.${s.dayOfWeek}` as "daysShort.1")} {s.startTime}
                </span>
              ))}
            </div>
            {showStudents && (
              <p className="text-xs text-muted-foreground">
                {c.studentCount} {t("common.students")}
                {c.room ? ` · ${c.room}` : ""}
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
