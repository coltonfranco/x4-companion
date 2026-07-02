import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize a caught `unknown` into a display string — `Error#message` when
 *  it is one, otherwise its string coercion. */
export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
