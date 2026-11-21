import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { setLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#0b1430] p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        />
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[26rem] w-[26rem] rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#fff" fillOpacity="0.1" />
            <path d="M16 7 5 12.5 16 18l9-4.5V20h2v-7.5L16 7Z" fill="#a5b4fc" />
            <path d="M9.5 16.2v4.3c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-4.3L16 19.4l-6.5-3.2Z" fill="#fff" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">EduCore</span>
        </div>
        <div className="relative mt-auto max-w-lg space-y-6">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">{t("auth.heroTitle")}</h1>
          <p className="text-base leading-relaxed text-indigo-100/80">{t("auth.heroBody")}</p>
          <ul className="space-y-3 pt-2">
            {(["heroPoint1", "heroPoint2", "heroPoint3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-3 text-sm text-indigo-50">
                <CheckCircle2 className="h-5 w-5 text-indigo-300" /> {t(`auth.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-indigo-200/50">© {new Date().getFullYear()} EduCore</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <Logo className="h-8 w-8" />
            <span className="font-semibold tracking-tight">EduCore</span>
          </div>
          <div className="flex rounded-lg border bg-card p-0.5 text-xs font-medium">
            {(["el", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={cn("rounded-md px-2.5 py-1 transition", i18n.language === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {l === "el" ? "ΕΛ" : "EN"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}
