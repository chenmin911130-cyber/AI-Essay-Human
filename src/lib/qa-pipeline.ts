/**
 * Strict quality-assurance pipeline for humanization output.
 * Iterates, validates, and picks the best candidate until checks pass or max passes reached.
 */

import { estimateAiScore, findAiPhrases, type DetectionResult } from "@/lib/detection";
import { humanizeWithRules, type HumanizeIntensity } from "@/lib/humanize-rules";
import { hasRewriteAiKey, humanizeWithRewriteAi } from "@/lib/rewriteai";
import { getAiModel, hasAiProvider } from "@/lib/ai-provider";
import { buildHumanizePrompt } from "@/lib/prompts";
import { detectLanguage } from "@/lib/utils";
import { generateText } from "ai";

export interface QaCheck {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

export interface QaReport {
  passed: boolean;
  checks: QaCheck[];
  passes: number;
  targetScore: number;
  confidence: "high" | "medium" | "low";
  warning?: string;
}

export interface StrictPipelineResult {
  text: string;
  beforeScore: DetectionResult;
  afterScore: DetectionResult;
  qa: QaReport;
  provider: "rewriteai" | "llm" | "rules";
  wordsUsed?: number;
}

const DEFAULT_TARGET_SCORE = 30;
const MAX_PASSES = 3;
const MIN_IMPROVEMENT = 10;

interface PipelineOptions {
  text: string;
  intensity: HumanizeIntensity;
  targetScore?: number;
  strict?: boolean;
}

async function humanizeWithLlm(
  text: string,
  intensity: HumanizeIntensity,
  language: ReturnType<typeof detectLanguage>
): Promise<string> {
  const model = getAiModel();
  if (!model) throw new Error("未配置 LLM API Key");

  const { text: aiResult } = await generateText({
    model,
    prompt: buildHumanizePrompt(text, intensity, language),
    temperature: intensity === "light" ? 0.5 : intensity === "standard" ? 0.7 : 0.85,
    maxOutputTokens: Math.min(4096, Math.ceil(text.length * 1.5)),
  });

  return aiResult.trim();
}

function pickBestCandidate(candidates: string[]): { text: string; score: DetectionResult } {
  let best = { text: candidates[0] ?? "", score: estimateAiScore(candidates[0] ?? "") };

  for (const candidate of candidates.slice(1)) {
    if (!candidate.trim()) continue;
    const score = estimateAiScore(candidate);
    if (score.score < best.score.score) {
      best = { text: candidate, score };
    }
  }

  return best;
}

async function humanizeOnce(
  text: string,
  intensity: HumanizeIntensity,
  language: ReturnType<typeof detectLanguage>
): Promise<{ text: string; provider: "rewriteai" | "llm" | "rules"; wordsUsed?: number }> {
  const candidates: string[] = [];

  if (hasRewriteAiKey()) {
    const result = await humanizeWithRewriteAi(text);
    candidates.push(result.text, ...result.alternatives);
    const best = pickBestCandidate(candidates);
    const polished = humanizeWithRules(best.text, "aggressive");
    return { text: polished, provider: "rewriteai", wordsUsed: result.wordsUsed };
  }

  if (hasAiProvider()) {
    const aiText = await humanizeWithLlm(text, intensity, language);
    const polished = humanizeWithRules(aiText, "aggressive");
    return { text: polished, provider: "llm" };
  }

  return { text: humanizeWithRules(text, "aggressive"), provider: "rules" };
}

function runValidationChecks(
  original: string,
  output: string,
  beforeScore: DetectionResult,
  afterScore: DetectionResult,
  targetScore: number
): QaCheck[] {
  const phrases = findAiPhrases(output);
  const lengthRatio = output.length / (original.length || 1);
  const improvement = beforeScore.score - afterScore.score;

  return [
    {
      id: "ai_score",
      name: "AI 率达标",
      passed: afterScore.score <= targetScore,
      message: afterScore.score <= targetScore
        ? `AI 率 ${afterScore.score}% ≤ 目标 ${targetScore}%`
        : `AI 率 ${afterScore.score}% 仍高于目标 ${targetScore}%`,
    },
    {
      id: "improvement",
      name: "有效降 AI",
      passed: improvement >= MIN_IMPROVEMENT,
      message:
        improvement >= MIN_IMPROVEMENT
          ? `降低了 ${improvement}%`
          : `仅降低 ${improvement}%，降幅不足 ${MIN_IMPROVEMENT}%`,
    },
    {
      id: "phrases",
      name: "无高风险 AI 用语",
      passed: phrases.length === 0,
      message:
        phrases.length === 0
          ? "未检测到典型 AI 套话"
          : `仍含 ${phrases.length} 处高风险用语：${phrases.slice(0, 3).join("、")}${phrases.length > 3 ? "…" : ""}`,
    },
    {
      id: "phrase_score",
      name: "套话密度合格",
      passed: afterScore.details.phraseScore <= 25,
      message:
        afterScore.details.phraseScore <= 25
          ? `套话密度 ${afterScore.details.phraseScore}%`
          : `套话密度 ${afterScore.details.phraseScore}% 偏高`,
    },
    {
      id: "variety",
      name: "句式有变化",
      passed: afterScore.details.burstinessScore <= 60,
      message:
        afterScore.details.burstinessScore <= 60
          ? "句式长短有变化"
          : "句式过于均匀，缺乏人类写作节奏",
    },
    {
      id: "length",
      name: "篇幅合理",
      passed: lengthRatio >= 0.65 && lengthRatio <= 1.6,
      message:
        lengthRatio >= 0.65 && lengthRatio <= 1.6
          ? `篇幅比 ${Math.round(lengthRatio * 100)}%`
          : `篇幅变化过大（${Math.round(lengthRatio * 100)}%）`,
    },
  ];
}

function buildQaReport(
  checks: QaCheck[],
  passes: number,
  targetScore: number
): QaReport {
  const criticalIds = new Set(["ai_score", "phrases", "improvement"]);
  const criticalPassed = checks.filter((c) => criticalIds.has(c.id)).every((c) => c.passed);
  const allPassed = checks.every((c) => c.passed);
  const passedCount = checks.filter((c) => c.passed).length;

  let confidence: QaReport["confidence"];
  if (allPassed) confidence = "high";
  else if (criticalPassed && passedCount >= checks.length - 1) confidence = "medium";
  else confidence = "low";

  let warning: string | undefined;
  if (!checks.find((c) => c.id === "ai_score")?.passed) {
    warning = `经过 ${passes} 轮处理，AI 率仍未降至 ${targetScore}% 以下。建议手动微调或分段处理。`;
  } else if (!allPassed) {
    warning = "部分质检项未通过，建议检查结果后再使用。";
  }

  return {
    passed: allPassed,
    checks,
    passes,
    targetScore,
    confidence,
    warning,
  };
}

export async function runStrictPipeline(
  options: PipelineOptions
): Promise<StrictPipelineResult> {
  const { text, intensity, targetScore = DEFAULT_TARGET_SCORE, strict = true } = options;
  const language = detectLanguage(text);
  const beforeScore = estimateAiScore(text);

  if (!strict) {
    const result = await humanizeOnce(text, intensity, language);
    const afterScore = estimateAiScore(result.text);
    const checks = runValidationChecks(text, result.text, beforeScore, afterScore, targetScore);
    return {
      text: result.text,
      beforeScore,
      afterScore,
      qa: buildQaReport(checks, 1, targetScore),
      provider: result.provider,
      wordsUsed: result.wordsUsed,
    };
  }

  let current = text;
  let bestText = text;
  let bestAfterScore = beforeScore;
  let provider: "rewriteai" | "llm" | "rules" = "rules";
  let totalWordsUsed = 0;
  let passCount = 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    passCount = pass;
    const result = await humanizeOnce(current, intensity, language);
    provider = result.provider;
    if (result.wordsUsed) totalWordsUsed += result.wordsUsed;

    const afterScore = estimateAiScore(result.text);
    if (afterScore.score < bestAfterScore.score) {
      bestText = result.text;
      bestAfterScore = afterScore;
    }

    const checks = runValidationChecks(text, result.text, beforeScore, afterScore, targetScore);
    const criticalPassed = checks
      .filter((c) => ["ai_score", "phrases", "improvement"].includes(c.id))
      .every((c) => c.passed);

    if (checks.every((c) => c.passed)) {
      return {
        text: result.text,
        beforeScore,
        afterScore,
        qa: buildQaReport(checks, pass, targetScore),
        provider,
        wordsUsed: totalWordsUsed || undefined,
      };
    }

    if (!criticalPassed && pass < MAX_PASSES) {
      current = humanizeWithRules(result.text, "aggressive");
      continue;
    }

    if (afterScore.score <= targetScore && pass < MAX_PASSES) {
      current = humanizeWithRules(result.text, "light");
      continue;
    }

    if (pass < MAX_PASSES && hasRewriteAiKey()) {
      current = result.text;
      continue;
    }

    break;
  }

  const finalChecks = runValidationChecks(
    text,
    bestText,
    beforeScore,
    bestAfterScore,
    targetScore
  );

  return {
    text: bestText,
    beforeScore,
    afterScore: bestAfterScore,
    qa: buildQaReport(finalChecks, passCount, targetScore),
    provider,
    wordsUsed: totalWordsUsed || undefined,
  };
}
