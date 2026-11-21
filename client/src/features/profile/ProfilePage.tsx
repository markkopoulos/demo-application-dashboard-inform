import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { KeyRound, UserCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { setLanguage } from "@/lib/i18n";
import { useAuth, useMe } from "@/features/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import type { Me } from "@/lib/types";

export function ProfilePage() {
  const me = useMe();
  const { setMe } = useAuth();
  const { t } = useTranslation();
  const [form, setForm] = useState({ firstName: me.user.firstName, lastName: me.user.lastName, locale: me.user.locale });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.patch<Me>("/me/profile", form),
    onSuccess: (data) => {
      setMe(data);
      setLanguage(data.user.locale);
      toast.success(t("profile.saved"));
    },
    onError: () => toast.error(t("errors.validation")),
  });

  const changePw = useMutation({
    mutationFn: () => api.post("/auth/password/change", { currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    onSuccess: () => {
      toast.success(t("profile.passwordChanged"));
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    },
    onError: (err) => setPwError(err instanceof ApiError ? err.body.message : t("errors.generic")),
  });

  const submitPw = (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.newPassword.length < 10) return setPwError(t("auth.passwordRule"));
    if (pw.newPassword !== pw.confirm) return setPwError(t("auth.mismatch"));
    changePw.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />
      <Card className="flex items-center gap-4 p-5">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-base">{initials(me.user.firstName, me.user.lastName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{me.user.firstName} {me.user.lastName}</p>
          <p className="truncate text-sm text-muted-foreground">
            {me.user.email} · {me.role ? t(`roles.${me.role}`) : ""}
            {me.center ? ` · ${me.center.name}` : ""}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCircle className="h-4 w-4 text-muted-foreground" /> {t("profile.details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("profile.firstName")} htmlFor="p-first">
              <Input id="p-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required maxLength={80} />
            </FormField>
            <FormField label={t("profile.lastName")} htmlFor="p-last">
              <Input id="p-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required maxLength={80} />
            </FormField>
            <FormField label={t("profile.language")} htmlFor="p-locale">
              <NativeSelect id="p-locale" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as "el" | "en" })}>
                <option value="el">Ελληνικά</option>
                <option value="en">English</option>
              </NativeSelect>
            </FormField>
            <div className="flex items-end justify-end sm:col-span-1">
              <Button type="submit" loading={save.isPending}>{t("common.save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" /> {t("profile.changePassword")}</CardTitle>
          <CardDescription>{t("auth.passwordRule")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPw} className="grid gap-4 sm:grid-cols-3">
            <FormField label={t("profile.currentPassword")} htmlFor="pw-current">
              <Input id="pw-current" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            </FormField>
            <FormField label={t("auth.newPassword")} htmlFor="pw-new">
              <Input id="pw-new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            </FormField>
            <FormField label={t("auth.confirmPassword")} htmlFor="pw-confirm">
              <Input id="pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </FormField>
            {pwError && <p className="text-sm text-destructive sm:col-span-3" role="alert">{pwError}</p>}
            <div className="flex justify-end sm:col-span-3">
              <Button type="submit" variant="outline" loading={changePw.isPending} disabled={!pw.currentPassword || !pw.newPassword}>
                {t("profile.changePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
