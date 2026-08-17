import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function toTitleCase(str: string): string {
  const exceptions = ["van", "de", "der", "von", "la", "le", "du", "des"];
  return str
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      // Always capitalize first word
      if (index === 0) return capitalizeWord(word);
      // Keep exceptions lowercase (unless first word)
      if (exceptions.includes(word)) return word;
      return capitalizeWord(word);
    })
    .join(" ");
}

function capitalizeWord(word: string): string {
  // Handle Mc/Mac prefixes
  if (word.startsWith("mc") && word.length > 2) {
    return "Mc" + word.charAt(2).toUpperCase() + word.slice(3);
  }
  if (word.startsWith("mac") && word.length > 3 && word !== "mace") {
    return "Mac" + word.charAt(3).toUpperCase() + word.slice(4);
  }
  // Handle O' prefix
  if (word.startsWith("o'") && word.length > 2) {
    return "O'" + word.charAt(2).toUpperCase() + word.slice(3);
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous: 0/O, 1/I/L
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// `hashIP` used to live here. It moved to `lib/hash.ts` because it needs
// node:crypto, and this module exports `cn` — imported by nearly every client
// component, which dragged a Node builtin toward the client bundle.
