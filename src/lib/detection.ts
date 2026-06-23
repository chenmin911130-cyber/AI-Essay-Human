/**
 * Heuristic AI detection scoring.
 * Estimates how "AI-like" text appears based on patterns common in LLM output.
 * Score: 0 (very human) → 100 (very AI-like)
 */

const AI_PHRASES_EN = [
  "it is important to note",
  "in conclusion",
  "furthermore",
  "moreover",
  "additionally",
  "in today's world",
  "plays a crucial role",
  "it is worth noting",
  "delve into",
  "landscape of",
  "tapestry of",
  "multifaceted",
  "paradigm",
  "leverage",
  "robust",
  "comprehensive",
  "utilize",
  "facilitate",
  "in the realm of",
  "a testament to",
  "underscores the importance",
  "shed light on",
  "navigate the complexities",
  "at its core",
  "it goes without saying",
  "in summary",
  "to summarize",
  "on the other hand",
  "as a result",
  "in other words",
  "first and foremost",
  "last but not least",
];

const AI_PHRASES_ZH = [
  "值得注意的是",
  "综上所述",
  "总而言之",
  "此外",
  "与此同时",
  "在当今社会",
  "在当今世界",
  "发挥着重要作用",
  "具有重要意义",
  "不可或缺",
  "毋庸置疑",
  "不言而喻",
  "深入探讨",
  "全方位",
  "多维度",
  "多层次",
  "有机结合",
  "有机融合",
  "砥砺前行",
  "赋能",
  "助力",
  "抓手",
  "底层逻辑",
  "顶层设计",
  "综上所述",
  "由此可见",
  "换言之",
  "一方面",
  "另一方面",
  "首先",
  "其次",
  "最后",
  "不仅",
  "而且",
  "随着",
  "的发展",
  "日益",
  "愈发",
  "愈发重要",
  "日益凸显",
  "应运而生",
  "应运而生",
  "应运而生",
];

const FORMAL_WORDS_EN = [
  "therefore",
  "thus",
  "hence",
  "consequently",
  "nevertheless",
  "nonetheless",
  "subsequently",
  "accordingly",
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sentenceLengthVariance(sentences: string[]): number {
  if (sentences.length < 2) return 0;
  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, len) => sum + (len - mean) ** 2, 0) / lengths.length;
  return Math.sqrt(variance);
}

function repetitiveStarters(sentences: string[]): number {
  if (sentences.length < 3) return 0;
  const starters = sentences.map((s) => {
    const words = s.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    const chars = s.slice(0, 4);
    return words.length > 2 ? words : chars;
  });
  const counts = new Map<string, number>();
  for (const s of starters) {
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let maxRepeat = 0;
  for (const count of counts.values()) {
    if (count > maxRepeat) maxRepeat = count;
  }
  return maxRepeat / sentences.length;
}

function phraseDensity(text: string, phrases: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const phrase of phrases) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = lower.match(regex);
    hits += matches?.length ?? 0;
  }
  const wordCount = text.split(/\s+/).filter(Boolean).length || 1;
  return hits / wordCount;
}

export interface DetectionResult {
  score: number;
  level: "low" | "medium" | "high";
  label: string;
  details: {
    phraseScore: number;
    burstinessScore: number;
    repetitionScore: number;
    uniformityScore: number;
  };
}

export function estimateAiScore(text: string): DetectionResult {
  if (!text.trim()) {
    return {
      score: 0,
      level: "low",
      label: "无内容",
      details: {
        phraseScore: 0,
        burstinessScore: 0,
        repetitionScore: 0,
        uniformityScore: 0,
      },
    };
  }

  const sentences = splitSentences(text);
  const variance = sentenceLengthVariance(sentences);
  const repetition = repetitiveStarters(sentences);
  const enPhraseDensity = phraseDensity(text, AI_PHRASES_EN);
  const zhPhraseDensity = phraseDensity(text, AI_PHRASES_ZH);
  const formalDensity = phraseDensity(text, FORMAL_WORDS_EN);

  const phraseScore = Math.min(
    100,
    (enPhraseDensity + zhPhraseDensity * 3 + formalDensity) * 800
  );

  const burstinessScore = Math.max(0, Math.min(100, 100 - variance * 2));

  const repetitionScore = Math.min(100, repetition * 120);

  const avgLen =
    sentences.reduce((sum, s) => sum + s.length, 0) / (sentences.length || 1);
  const uniformityScore = Math.max(
    0,
    Math.min(100, 100 - Math.abs(avgLen - 45) * 1.5)
  );

  const score = Math.round(
    phraseScore * 0.4 +
      burstinessScore * 0.25 +
      repetitionScore * 0.2 +
      uniformityScore * 0.15
  );

  const clamped = Math.max(0, Math.min(100, score));

  let level: DetectionResult["level"];
  let label: string;
  if (clamped < 35) {
    level = "low";
    label = "较低 — 更像人类写作";
  } else if (clamped < 65) {
    level = "medium";
    label = "中等 — 存在一定 AI 特征";
  } else {
    level = "high";
    label = "较高 — 明显 AI 痕迹";
  }

  return {
    score: clamped,
    level,
    label,
    details: {
      phraseScore: Math.round(phraseScore),
      burstinessScore: Math.round(burstinessScore),
      repetitionScore: Math.round(repetitionScore),
      uniformityScore: Math.round(uniformityScore),
    },
  };
}
