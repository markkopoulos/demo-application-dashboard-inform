import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AlertTriangle, Lock, type LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, body, action, className }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-medium">{title}</p>
        {body && <p className="text-sm text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={message ?? t("errors.generic")}
      body={t("errors.genericBody")}
      action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t("common.retry")}</Button>}
    />
  );
}

export function ForbiddenState() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Lock}
      title={t("errors.forbidden")}
      action={<Button asChild variant="outline" size="sm"><Link to="/">{t("comingSoon.back")}</Link></Button>}
      className="mt-6"
    />
  );
}
