import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <div className="min-w-0 lg:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <ErrorBoundary inline>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
