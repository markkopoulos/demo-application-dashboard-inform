import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 10 || password !== confirm) return;
    setPending(true);
    setError(null);
    try {
      await api.post("/auth/password/reset", { token, password });
      toast.success(t("auth.resetDone"));
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("auth.resetInvalid") : err instanceof ApiError && err.status === 429 ? t("auth.rateLimited") : t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold tracking-tight">{t("auth.resetTitle")}</h2>
      {!token ? (
        <p className="mt-4 text-sm text-destructive">{t("auth.resetInvalid")}</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <FormField label={t("auth.newPassword")} htmlFor="password" error={tooShort ? t("auth.passwordRule") : undefined} hint={t("auth.passwordRule")}>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={tooShort} autoFocus />
          </FormField>
          <FormField label={t("auth.confirmPassword")} htmlFor="confirm" error={mismatch ? t("auth.mismatch") : undefined}>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
          </FormField>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" size="lg" loading={pending} disabled={password.length < 10 || password !== confirm}>
            {t("auth.setPassword")}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
        {t("auth.backToLogin")}
      </Link>
    </AuthLayout>
  );
}
