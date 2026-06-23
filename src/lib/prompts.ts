import type { HumanizeIntensity } from "./humanize-rules";

const INTENSITY_INSTRUCTIONS: Record<HumanizeIntensity, string> = {
  light:
    "Make subtle changes only. Keep the original meaning and structure mostly intact. Replace a few AI-sounding phrases with more natural alternatives.",
  standard:
    "Rewrite to sound naturally human-written. Vary sentence length and structure. Use conversational tone where appropriate. Remove AI clichés. Keep the core arguments and facts intact.",
  aggressive:
    "Heavily rewrite to maximize human-like quality. Use varied rhythm, occasional informal expressions, personal voice, and imperfect but natural phrasing. Break up uniform patterns. Preserve factual content but change expression significantly.",
};

export function buildHumanizePrompt(
  text: string,
  intensity: HumanizeIntensity,
  language: "zh" | "en" | "mixed"
): string {
  const langNote =
    language === "zh"
      ? "The text is primarily in Chinese. Output in Chinese."
      : language === "en"
        ? "The text is primarily in English. Output in English."
        : "Preserve the original language mix.";

  return `You are an expert editor who rewrites AI-generated essays to sound authentically human-written, reducing AI detection scores.

${INTENSITY_INSTRUCTIONS[intensity]}

Guidelines:
- Vary sentence length (mix short punchy sentences with longer ones)
- Avoid AI clichés: "Furthermore", "Moreover", "In conclusion", "It is important to note", "值得注意的是", "综上所述", "赋能", etc.
- Use natural transitions, not formulaic ones
- Add subtle personal voice where fitting (e.g., "I think", "honestly", "我觉得")
- Do NOT add false information or change the core meaning
- Do NOT add meta-commentary — output ONLY the rewritten essay
- ${langNote}

Original text:
"""
${text}
"""

Rewritten text:`;
}
