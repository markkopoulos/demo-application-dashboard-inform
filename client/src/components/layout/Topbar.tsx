import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Building2, Check, ChevronsUpDown, Languages, LogOut, Menu, Moon, Sun, UserCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, useMe } from "@/features/auth/AuthProvider";
import { useTheme } from "@/hooks/useTheme";
import { setLanguage } from "@/lib/i18n";
import { api } from "@/lib/api";
import { initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, SheetContent, DialogTitle } from "@/components/ui/dialog";
import { SidebarNav } from "./Sidebar";
import { Wordmark } from "@/components/Logo";

function CenterSwitcher() {
  const me = useMe();
  const { switchCenter } = useAuth();
  const { t } = useTranslation();
  const isSuper = me.role === "SUPER_ADMIN";
  const { data: allCenters } = useQuery({
    queryKey: ["platform", "centers"],
    queryFn: () => api.get<{ id: string; name: string; city: string | null; status: string }[]>("/platform/centers"),
    enabled: isSuper,
  });
  const options = isSuper ? (allCenters ?? []).map((c) => ({ id: c.id, name: c.name, city: c.city })) : me.centers;
  if (!isSuper && options.length <= 1) {
    return me.center ? (
      <div className="hidden min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground md:flex">
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate">{me.center.name}</span>
      </div>
    ) : null;
  }

  const onSwitch = async (id: string) => {
    try {
      await switchCenter(id);
    } catch {
      toast.error(t("errors.generic"));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 max-w-[16rem] justify-between gap-2">
          <Building2 className="text-muted-foreground" />
          <span className="truncate">{me.center?.name ?? t("shell.selectCenter")}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("shell.switchCenter")}</DropdownMenuLabel>
        {options.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onSwitch(c.id)}>
            <Building2 />
            <span className="flex-1 truncate">{c.name}</span>
            {me.center?.id === c.id && <Check className="!text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const me = useMe();
  const { logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const changeLanguage = (lng: string) => {
    setLanguage(lng as "el" | "en");
    // Persist the preference on the account too (fire and forget).
    void api.patch("/me/profile", { locale: lng }).catch(() => {});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 rounded-full p-0.5 pr-1 transition hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:rounded-lg sm:pr-2">
          <Avatar>
            <AvatarFallback>{initials(me.user.firstName, me.user.lastName)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <div className="max-w-[10rem] truncate text-sm font-medium">
              {me.user.firstName} {me.user.lastName}
            </div>
            <div className="text-xs text-muted-foreground">{me.role ? t(`roles.${me.role}`) : ""}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium text-foreground">
            {me.user.firstName} {me.user.lastName}
          </div>
          <div className="truncate">{me.user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserCircle /> {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTheme(theme === "dark" ? "light" : "dark"); }}>
          {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? t("shell.light") : t("shell.dark")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages className="h-3.5 w-3.5" /> {t("shell.language")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={i18n.language} onValueChange={changeLanguage}>
          <DropdownMenuRadioItem value="el">Ελληνικά</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate("/login", { replace: true });
          }}
          className="text-destructive focus:text-destructive [&_svg]:!text-destructive"
        >
          <LogOut /> {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();
  const me = useMe();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label={t("shell.openMenu")}>
          <Menu className="!size-5" />
        </Button>
        <SheetContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t("shell.openMenu")}</DialogTitle>
          <div className="flex h-16 items-center px-5">
            <Wordmark subtitle={me.center?.name} />
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Dialog>

      <div className="min-w-0 flex-1">
        <CenterSwitcher />
      </div>

      <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("shell.theme")} className="text-muted-foreground">
        {theme === "dark" ? <Sun className="!size-[18px]" /> : <Moon className="!size-[18px]" />}
      </Button>
      <UserMenu />
    </header>
  );
}
