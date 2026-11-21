import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { Role } from "@/lib/types";
import { FullPageLoader } from "@/components/FullPageLoader";
import { ForbiddenState } from "@/components/states";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (me) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** UI-level guard for nicer UX. The server enforces the same rule on every request. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { me } = useAuth();
  if (!me?.role || !roles.includes(me.role)) return <ForbiddenState />;
  return <>{children}</>;
}
