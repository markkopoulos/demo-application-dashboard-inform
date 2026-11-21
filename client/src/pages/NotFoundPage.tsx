import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <p className="text-6xl font-semibold tracking-tight text-muted-foreground/40 tabular">404</p>
      <h1 className="text-xl font-semibold">{t("errors.notFound")}</h1>
      <p className="text-sm text-muted-foreground">{t("errors.notFoundBody")}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link to="/">{t("comingSoon.back")}</Link>
      </Button>
    </div>
  );
}
