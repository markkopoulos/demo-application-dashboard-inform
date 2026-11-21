import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { el as elLocale, enUS } from "date-fns/locale";
import { Activity, Building2, GraduationCap, LogIn, MapPin, Plus, ShieldCheck, UserPlus, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { StatCard, StatSkeletons } from "@/features/dashboard/widgets";

interface Center {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: "ACTIVE" | "INACTIVE";
  defaultGradeScale: "SCALE_20" | "PERCENT";
  counts: { admins: number; teachers: number; students: number; parents: number };
}
interface Stats { centers: number; activeCenters: number; users: number; students: number; teachers: number; loginsLast7Days: number }
interface AdminRow { id: string; email: string; firstName: string; lastName: string; status: "ACTIVE" | "SUSPENDED"; membershipId: string; lastLoginAt: string | null }
interface AuditRow { id: string; action: string; createdAt: string; actor: { firstName: string; lastName: string } | null; center: { name: string } | null }

type FieldErrors = Record<string, string>;
const fieldErrors = (err: unknown): FieldErrors =>
  err instanceof ApiError && err.body.details ? Object.fromEntries(err.body.details.map((d) => [d.path, d.message])) : {};

export function PlatformPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { switchCenter } = useAuth();
  const stats = useQuery({ queryKey: ["platform", "stats"], queryFn: () => api.get<Stats>("/platform/centers/stats") });
  const centers = useQuery({ queryKey: ["platform", "centers"], queryFn: () => api.get<Center[]>("/platform/centers") });
  const activity = useQuery({ queryKey: ["platform", "activity"], queryFn: () => api.get<AuditRow[]>("/platform/centers/activity") });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [confirming, setConfirming] = useState<Center | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["platform"] });

  const toggleStatus = useMutation({
    mutationFn: (c: Center) => api.patch(`/platform/centers/${c.id}`, { status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    onSuccess: () => {
      toast.success(t("platform.updated"));
      setConfirming(null);
      void invalidate();
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const enter = async (c: Center) => {
    await switchCenter(c.id);
    navigate("/");
  };

  const dfLocale = i18n.language === "el" ? elLocale : enUS;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("platform.title")}
        description={t("platform.subtitle")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t("platform.newCenter")}
          </Button>
        }
      />

      {stats.isPending ? (
        <StatSkeletons />
      ) : stats.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t("platform.activeCenters")} value={`${stats.data.activeCenters}/${stats.data.centers}`} icon={Building2} />
          <StatCard label={t("platform.users")} value={stats.data.users} icon={Users} tone="violet" />
          <StatCard label={t("platform.students")} value={stats.data.students} icon={GraduationCap} tone="success" />
          <StatCard label={t("platform.logins7d")} value={stats.data.loginsLast7Days} icon={LogIn} tone="sky" />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <h2 className="text-base font-semibold">{t("platform.centers")}</h2>
          {centers.isPending ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
          ) : centers.isError ? (
            <ErrorState onRetry={() => centers.refetch()} />
          ) : centers.data.length === 0 ? (
            <EmptyState icon={Building2} title={t("platform.centers")} />
          ) : (
            centers.data.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{c.name}</p>
                      <Badge variant={c.status === "ACTIVE" ? "success" : "default"}>{c.status === "ACTIVE" ? t("common.active") : t("common.inactive")}</Badge>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{c.slug}</span>
                      {c.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {c.city}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground tabular">
                      <span>{t("platform.admins")}: <b className="text-foreground">{c.counts.admins}</b></span>
                      <span>{t("platform.teachers")}: <b className="text-foreground">{c.counts.teachers}</b></span>
                      <span>{t("platform.students")}: <b className="text-foreground">{c.counts.students}</b></span>
                      <span>{t("nav.parents")}: <b className="text-foreground">{c.counts.parents}</b></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                    <Button size="sm" variant="accent" onClick={() => enter(c)} disabled={c.status !== "ACTIVE"}>
                      {t("platform.openCenter")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                      {t("common.edit")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => (c.status === "ACTIVE" ? setConfirming(c) : toggleStatus.mutate(c))}>
                      {c.status === "ACTIVE" ? t("common.deactivate") : t("common.activate")}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" /> {t("platform.recentActivity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.isPending ? (
              <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : !activity.data?.length ? (
              <p className="text-sm text-muted-foreground">{t("platform.noActivity")}</p>
            ) : (
              <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                {activity.data.slice(0, 25).map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : "—"}</span>{" "}
                        <code className="rounded bg-secondary px-1 py-px text-[11px]">{a.action}</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.center?.name ? `${a.center.name} · ` : ""}
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true, locale: dfLocale })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CenterDialog open={creating} onOpenChange={setCreating} onDone={invalidate} />
      {editing && <CenterDialog open center={editing} onOpenChange={(o) => !o && setEditing(null)} onDone={invalidate} />}

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("platform.confirmDeactivate")}</DialogTitle>
            <DialogDescription>{t("platform.confirmDeactivateBody", { name: confirming?.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" loading={toggleStatus.isPending} onClick={() => confirming && toggleStatus.mutate(confirming)}>
              {t("common.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CenterDialog({ open, onOpenChange, center, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; center?: Center; onDone: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: center?.name ?? "",
    slug: center?.slug ?? "",
    city: center?.city ?? "",
    email: center?.email ?? "",
    phone: center?.phone ?? "",
    address: center?.address ?? "",
    defaultGradeScale: center?.defaultGradeScale ?? "SCALE_20",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      // Drop empty optional fields so the server's validators don't see "".
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      return center ? api.patch(`/platform/centers/${center.id}`, body) : api.post("/platform/centers", body);
    },
    onSuccess: () => {
      toast.success(center ? t("platform.updated") : t("platform.created"));
      onDone();
      onOpenChange(false);
      if (!center) setForm({ name: "", slug: "", city: "", email: "", phone: "", address: "", defaultGradeScale: "SCALE_20" });
    },
    onError: (err) => {
      setErrors(fieldErrors(err));
      toast.error(err instanceof ApiError && err.status === 409 ? err.body.message : t("errors.validation"));
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{center ? center.name : t("platform.newCenter")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("platform.name")} htmlFor="c-name" error={errors.name}>
            <Input id="c-name" value={form.name} onChange={set("name")} required />
          </FormField>
          <FormField label={t("platform.slug")} htmlFor="c-slug" error={errors.slug} hint="akadimia-athinas">
            <Input id="c-slug" value={form.slug} onChange={set("slug")} required pattern="[a-z0-9-]+" />
          </FormField>
          <FormField label={t("platform.city")} htmlFor="c-city" error={errors.city}>
            <Input id="c-city" value={form.city} onChange={set("city")} />
          </FormField>
          <FormField label={t("platform.gradeScale")} htmlFor="c-scale">
            <NativeSelect id="c-scale" value={form.defaultGradeScale} onChange={set("defaultGradeScale")}>
              <option value="SCALE_20">{t("platform.scale20")}</option>
              <option value="PERCENT">{t("platform.percent")}</option>
            </NativeSelect>
          </FormField>
          <FormField label={t("platform.email")} htmlFor="c-email" error={errors.email}>
            <Input id="c-email" type="email" value={form.email} onChange={set("email")} />
          </FormField>
          <FormField label={t("platform.phone")} htmlFor="c-phone" error={errors.phone}>
            <Input id="c-phone" value={form.phone} onChange={set("phone")} />
          </FormField>
          <FormField label={t("platform.address")} htmlFor="c-address" error={errors.address} className="sm:col-span-2">
            <Input id="c-address" value={form.address} onChange={set("address")} />
          </FormField>
          {center && <AdminsSection centerId={center.id} />}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={save.isPending}>{center ? t("common.save") : t("common.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminsSection({ centerId }: { centerId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["platform", "admins", centerId];
  const admins = useQuery({ queryKey: key, queryFn: () => api.get<AdminRow[]>(`/platform/centers/${centerId}/admins`) });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  const create = useMutation({
    mutationFn: () => api.post(`/platform/centers/${centerId}/admins`, form),
    onSuccess: () => {
      toast.success(t("platform.adminCreated"));
      setAdding(false);
      setForm({ firstName: "", lastName: "", email: "", password: "" });
      void qc.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (err) => {
      setErrors(fieldErrors(err));
      toast.error(err instanceof ApiError && err.status === 409 ? err.body.message : t("errors.validation"));
    },
  });
  const setStatus = useMutation({
    mutationFn: (a: AdminRow) => api.patch(`/platform/centers/${centerId}/admins/${a.membershipId}`, { status: a.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="space-y-3 rounded-xl border bg-surface p-4 sm:col-span-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> {t("platform.admins")}
        </p>
        {!adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus /> {t("platform.addAdmin")}
          </Button>
        )}
      </div>
      {admins.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("platform.noAdmins")}</p>}
      <ul className="space-y-2">
        {admins.data?.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-card p-3 text-sm shadow-card">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{a.firstName} {a.lastName}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <Badge variant={a.status === "ACTIVE" ? "success" : "warning"}>{a.status === "ACTIVE" ? t("common.active") : t("common.suspended")}</Badge>
            <Button type="button" size="sm" variant="ghost" onClick={() => setStatus.mutate(a)}>
              {a.status === "ACTIVE" ? t("common.deactivate") : t("common.activate")}
            </Button>
          </li>
        ))}
      </ul>
      {adding && (
        <div className="grid gap-3 rounded-lg bg-card p-3 shadow-card sm:grid-cols-2">
          <FormField label={t("platform.firstName")} htmlFor="a-first" error={errors.firstName}>
            <Input id="a-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </FormField>
          <FormField label={t("platform.lastName")} htmlFor="a-last" error={errors.lastName}>
            <Input id="a-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </FormField>
          <FormField label="Email" htmlFor="a-email" error={errors.email}>
            <Input id="a-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <FormField label={t("platform.initialPassword")} htmlFor="a-pass" error={errors.password} hint={t("auth.passwordRule")}>
            <Input id="a-pass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            <Button type="button" size="sm" loading={create.isPending} onClick={() => { setErrors({}); create.mutate(); }}>{t("common.create")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
