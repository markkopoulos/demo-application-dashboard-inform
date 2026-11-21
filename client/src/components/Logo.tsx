import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-9 w-9 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-[#0f1b3d] dark:fill-[#c7d2fe]" />
      <path d="M16 7 5 12.5 16 18l9-4.5V20h2v-7.5L16 7Z" className="fill-[#a5b4fc] dark:fill-[#4338ca]" />
      <path d="M9.5 16.2v4.3c0 1.9 2.9 3.5 6.5 3.5s6.5-1.6 6.5-3.5v-4.3L16 19.4l-6.5-3.2Z" className="fill-white dark:fill-[#0f1b3d]" />
    </svg>
  );
}

export function Wordmark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <div className="min-w-0 leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-foreground">EduCore</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
