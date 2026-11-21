import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const initials = (first?: string, last?: string) => `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
