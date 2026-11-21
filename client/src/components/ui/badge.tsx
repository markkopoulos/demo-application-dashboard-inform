import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", {
  variants: {
    variant: {
      default: "bg-secondary text-secondary-foreground ring-border",
      accent: "bg-accent-soft text-accent ring-accent/20",
      success: "bg-success-soft text-success ring-success/20",
      warning: "bg-warning-soft text-warning ring-warning/20",
      destructive: "bg-destructive/10 text-destructive ring-destructive/20",
      outline: "text-foreground ring-border",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
