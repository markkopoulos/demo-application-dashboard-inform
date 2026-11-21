import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RedirectIfAuthed, RequireAuth, RequireRole } from "@/features/auth/guards";
import { useAuth } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { HomePage } from "@/features/dashboard/HomePage";
import { PlatformPage } from "@/features/platform/PlatformPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { phasedRoutes } from "@/lib/nav";

export default function App() {
  const { me } = useAuth();
  const upcoming = phasedRoutes(me?.role ?? null, !!me?.center);

  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPasswordPage /></RedirectIfAuthed>} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="platform" element={<RequireRole roles={["SUPER_ADMIN"]}><PlatformPage /></RequireRole>} />
        {upcoming.map((item) => (
          <Route key={item.path} path={item.path.slice(1)} element={<ComingSoonPage item={item} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
