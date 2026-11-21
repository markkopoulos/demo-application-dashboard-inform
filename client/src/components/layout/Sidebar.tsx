import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { navFor } from "@/lib/nav";
import { useMe } from "@/features/auth/AuthProvider";
import { Wordmark } from "@/components/Logo";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  const { t } = useTranslation();
  const sections = navFor(me.role, !!me.center);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label={t("nav.sectionMain")}>
      {sections.map((section) => (
        <div key={section.key}>
          <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t(`nav.${section.key}`)}</div>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.path + item.key}>
                <NavLink
                  to={item.path}
                  end={item.path === "/" || item.path === "/platform"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className="flex-1 truncate">{t(`nav.${item.key}`)}</span>
                      {item.phase && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-px text-[10px] font-semibold tabular",
                            isActive ? "bg-white/15 text-primary-foreground" : "bg-secondary text-muted-foreground",
                          )}
                          title={t("comingSoon.title")}
                        >
                          Φ{item.phase}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const me = useMe();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Wordmark subtitle={me.center?.name} />
      </div>
      <SidebarNav />
    </aside>
  );
}
