import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/lib/nav";

export function ComingSoonPage({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const name = t(`nav.${item.key}`);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <item.icon className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Construction className="h-3.5 w-3.5" /> {t("comingSoon.title")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground">{t("comingSoon.body", { name, phase: item.phase })}</p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">{t("comingSoon.back")}</Link>
      </Button>
    </div>
  );
}
