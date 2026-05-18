import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeForPrompt(input: string): string {
  if (!input) return "";
  return input
    .slice(0, 2000)
    .replace(/`/g, "\\`")
    .replace(/<\//g, "<\\/");
}
