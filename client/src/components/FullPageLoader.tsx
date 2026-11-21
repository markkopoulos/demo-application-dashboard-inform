import { Logo } from "./Logo";

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <Logo className="h-11 w-11" />
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
