import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Building2, GraduationCap, ShieldCheck, UserRound, Users } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { AuthLayout } from "./AuthLayout";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import type { Role } from "@/lib/types";

// Demo accounts from the seed script. Shown only in development or when the
// deployment explicitly opts in with VITE_DEMO_MODE=true.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_PASSWORD = "EduCore2026!";
const DEMO: { role: Role; email: string; icon: typeof Users }[] = [
  { role: "CENTER_ADMIN", email: "admin@akadimia.example", icon: Building2 },
  { role: "TEACHER", email: "teacher@akadimia.example", icon: UserRound },
  { role: "STUDENT", email: "student@akadimia.example", icon: GraduationCap },
  { role: "PARENT", email: "parent@akadimia.example", icon: Users },
  { role: "SUPER_ADMIN", email: "superadmin@educore.example", icon: ShieldCheck },
];

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem("educore-expired")) {
      sessionStorage.removeItem("educore-expired");
      setNotice(t("auth.sessionExpired"));
    }
  }, [t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const me = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : me.role === "SUPER_ADMIN" && !me.center ? "/platform" : "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t("auth.rateLimited"));
      else if (err instanceof ApiError && err.status === 403) setError(err.body.message);
      else if (err instanceof ApiError && (err.status === 401 || err.status === 400)) setError(t("auth.invalid"));
      else setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t("auth.signInTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
      </div>

      {notice && <div className="mt-6 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning">{notice}</div>}

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <FormField label={t("auth.email")} htmlFor="email">
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </FormField>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              {t("auth.password")}
            </label>
            <Link to="/forgot-password" className="text-xs font-medium text-accent hover:underline">
              {t("auth.forgot")}
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <Button type="submit" className="w-full" size="lg" loading={pending} disabled={!email || !password}>
          {pending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>

      {SHOW_DEMO && (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">{t("auth.demoAccounts")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                }}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-xs font-medium transition hover:border-accent/40 hover:bg-accent-soft last:col-span-2"
              >
                <d.icon className="h-4 w-4 text-accent" />
                {t(`roles.${d.role}`)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("auth.demoHint")}</p>
        </div>
      )}
    </AuthLayout>
  );
}
