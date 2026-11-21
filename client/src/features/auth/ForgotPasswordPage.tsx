import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api.post<{ ok: true; devResetUrl?: string }>("/auth/password/forgot", { email });
      setSent(true);
      setDevUrl(res.devResetUrl ?? null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t("auth.rateLimited") : err instanceof ApiError && err.status === 400 ? t("errors.validation") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <Link to="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("auth.backToLogin")}
      </Link>
      <h2 className="text-2xl font-semibold tracking-tight">{t("auth.forgotTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.forgotSubtitle")}</p>
      {sent ? (
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border bg-success-soft p-4 text-sm text-success">
            <MailCheck className="h-5 w-5 shrink-0" /> {t("auth.linkSent")}
          </div>
          {devUrl && (
            <div className="rounded-xl border border-dashed p-4 text-xs">
              <p className="mb-2 text-muted-foreground">{t("auth.devLink")}</p>
              <a href={devUrl.replace(/^https?:\/\/[^/]+/, "")} className="break-all font-medium text-accent hover:underline">
                {devUrl}
              </a>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <FormField label={t("auth.email")} htmlFor="email" error={error ?? undefined}>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={pending} disabled={!email}>
            {t("auth.sendLink")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
