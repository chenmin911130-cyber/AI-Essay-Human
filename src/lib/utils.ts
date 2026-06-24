import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isNearlySameText(a: string, b: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, "").trim().toLowerCase();
  return normalize(a) === normalize(b);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const chineseChars = trimmed.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const englishWords = trimmed
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return chineseChars + englishWords;
}

export function detectLanguage(text: string): "zh" | "en" | "mixed" {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const english = (text.match(/[a-zA-Z]/g) ?? []).length;
  const total = chinese + english;
  if (total === 0) return "en";
  if (chinese / total > 0.6) return "zh";
  if (english / total > 0.6) return "en";
  return "mixed";
}
