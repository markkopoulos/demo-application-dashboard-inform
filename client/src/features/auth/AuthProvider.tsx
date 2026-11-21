import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, setCsrfToken } from "@/lib/api";
import { setLanguage } from "@/lib/i18n";
import type { Me } from "@/lib/types";

interface AuthValue {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  switchCenter: (centerId: string) => Promise<void>;
  setMe: (me: Me) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
export const ME_KEY = ["auth", "me"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.get<Me>("/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const setMe = useCallback(
    (me: Me) => {
      setCsrfToken(me.csrfToken);
      qc.setQueryData(ME_KEY, me);
    },
    [qc],
  );

  /** Removes every cached query except the session itself (user/center-scoped data). */
  const clearScopedData = useCallback(() => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" }), [qc]);

  useEffect(() => {
    setCsrfToken(data?.csrfToken ?? null);
    if (data?.user.locale) setLanguage(data.user.locale);
  }, [data]);

  // Any 401 from the API means the session is gone (expired / revoked).
  useEffect(() => {
    const onUnauthorized = () => {
      setCsrfToken(null);
      qc.setQueryData(ME_KEY, null);
      sessionStorage.setItem("educore-expired", "1");
    };
    window.addEventListener("educore:unauthorized", onUnauthorized);
    return () => window.removeEventListener("educore:unauthorized", onUnauthorized);
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await api.post<Me>("/auth/login", { email, password });
      // Never qc.clear() here: it would detach the mounted "me" observer.
      clearScopedData();
      setMe(me);
      return me;
    },
    [clearScopedData, setMe],
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setCsrfToken(null);
    qc.setQueryData(ME_KEY, null);
    clearScopedData();
  }, [qc, clearScopedData]);

  const switchCenter = useCallback(
    async (centerId: string) => {
      const me = await api.post<Me>("/auth/switch-center", { centerId });
      // Drop all center-scoped cached data before showing the new center.
      clearScopedData();
      setMe(me);
    },
    [clearScopedData, setMe],
  );

  const value = useMemo(() => ({ me: data ?? null, loading: isPending, login, logout, switchCenter, setMe }), [data, isPending, login, logout, switchCenter, setMe]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Narrowed hook for pages rendered inside RequireAuth. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("useMe used outside an authenticated route");
  return me;
}
