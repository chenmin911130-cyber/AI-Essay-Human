import { estimateAiScore, findAiPhrases, type DetectionResult } from "@/lib/detection";
import { humanizeWithRules, type HumanizeIntensity } from "@/lib/humanize-rules";
import {
  humanizeWithAiUndetect,
  humanizeWithVerifyLoop,
  hasAiUndetect,
  isAiUndetectAutoEnabled,
  isAiUndetectVerifyEnabled,
} from "@/lib/aiundetect";
import { getAiModel, getAiProviderName, hasAiProvider } from "@/lib/ai-provider";
import { buildHumanizePrompt } from "@/lib/prompts";
import { detectLanguage, isNearlySameText } from "@/lib/utils";
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

export type PipelineProvider = "aiundetect" | "openrouter" | "openai" | "rules";

export interface OfficialDetectionReport {
  available: boolean;
  passed?: boolean;
  aiPercent?: number;
  attempts: number;
  message?: string;
}

export interface StrictPipelineResult {
  text: string;
  beforeScore: DetectionResult;
  afterScore: DetectionResult;
  qa: QaReport;
  provider: PipelineProvider;
  wordsUsed?: number;
  remainingWords?: number;
  officialDetection?: OfficialDetectionReport;
}

const DEFAULT_TARGET_SCORE = 30;
const MAX_PASSES = 3;
const MIN_IMPROVEMENT = 10;

interface PipelineOptions {
  text: string;
  intensity: HumanizeIntensity;
  targetScore?: number;
  strict?: boolean;
  verifyLoop?: boolean;
}

export function hasAnyAiHumanizer(): boolean {
  return hasAiUndetect() || hasAiProvider();
}

async function humanizeWithLlm(
  text: string,
  intensity: HumanizeIntensity,
  language: ReturnType<typeof detectLanguage>,
  temperature?: number
): Promise<string> {
  const model = getAiModel();
  if (!model) throw new Error("未配置 LLM API Key");

  const temp =
    temperature ??
    (intensity === "light" ? 0.5 : intensity === "standard" ? 0.7 : 0.85);

  const { text: aiResult } = await generateText({
    model,
    prompt: buildHumanizePrompt(text, intensity, language),
    temperature: temp,
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

function shouldUpdateBest(
  original: string,
  candidate: string,
  candidateScore: number,
  bestText: string,
  bestScore: number
): boolean {
  const candidateChanged = !isNearlySameText(original, candidate);
  const bestIsOriginal = isNearlySameText(original, bestText);

  if (candidateScore < bestScore) return true;
  if (bestIsOriginal && candidateChanged) return true;
  return false;
}

async function humanizeOnce(
  text: string,
  intensity: HumanizeIntensity,
  language: ReturnType<typeof detectLanguage>,
  verifyLoop = isAiUndetectVerifyEnabled()
): Promise<{
  text: string;
  provider: PipelineProvider;
  wordsUsed?: number;
  remainingWords?: number;
  officialDetection?: OfficialDetectionReport;
}> {
  if (hasAiUndetect()) {
    try {
      const autoPerfect = isAiUndetectAutoEnabled();

      if (verifyLoop && autoPerfect) {
        const result = await humanizeWithVerifyLoop(text, intensity, { auto: true });
        return {
          text: result.text,
          provider: "aiundetect",
          wordsUsed: result.wordsUsed,
          remainingWords: result.remainingWords,
          officialDetection: {
            available: result.detectionAvailable,
            passed: result.detectionPassed,
            aiPercent: result.detectionAiPercent,
            attempts: result.attempts,
            message: result.detectionMessage,
          },
        };
      }

      let result = await humanizeWithAiUndetect(text, intensity, { auto: autoPerfect });

      if (!autoPerfect && isNearlySameText(text, result.text)) {
        const preprocessed = humanizeWithRules(text, intensity);
        if (!isNearlySameText(text, preprocessed)) {
          result = await humanizeWithAiUndetect(preprocessed, intensity, { auto: autoPerfect });
        }
      }

      if (isNearlySameText(text, result.text) && hasAiProvider()) {
        throw new Error("AIUNDETECT_UNCHANGED");
      }

      return {
        text: result.text,
        provider: "aiundetect",
        wordsUsed: result.wordsUsed,
        remainingWords: result.remainingWords,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        (message.startsWith("AIUNDETECT_TOO_SHORT") ||
          message.includes("100-10000") ||
          message === "AIUNDETECT_UNCHANGED") &&
        hasAiProvider()
      ) {
        console.warn("AIUndetect fallback to OpenRouter:", message);
      } else if (!message.includes("100-10000") && hasAiProvider()) {
        console.warn("AIUndetect failed, falling back to OpenRouter:", message);
      } else if (!hasAiProvider()) {
        throw error;
      }
    }
  }

  if (hasAiProvider()) {
    const providerName = getAiProviderName() ?? "openrouter";
    const candidates = await Promise.all([
      humanizeWithLlm(text, intensity, language, 0.7),
      humanizeWithLlm(text, intensity, language, 0.9),
    ]);
    const best = pickBestCandidate(candidates);
    const polished = humanizeWithRules(best.text, "aggressive");
    return { text: polished, provider: providerName };
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
  const {
    text,
    intensity,
    targetScore = DEFAULT_TARGET_SCORE,
    strict = true,
    verifyLoop = isAiUndetectVerifyEnabled(),
  } = options;
  const language = detectLanguage(text);
  const beforeScore = estimateAiScore(text);
  // Auto-Perfect + verify loop already iterates on AIUndetect's side.
  const effectiveStrict =
    strict && !(hasAiUndetect() && (isAiUndetectAutoEnabled() || verifyLoop));

  if (!effectiveStrict) {
    const result = await humanizeOnce(text, intensity, language, verifyLoop);
    const afterScore = estimateAiScore(result.text);
    const checks = runValidationChecks(text, result.text, beforeScore, afterScore, targetScore);

    if (result.officialDetection) {
      checks.unshift({
        id: "official_detection",
        name: "AIUndetect 官网检测",
        passed: result.officialDetection.available
          ? (result.officialDetection.passed ?? false)
          : true,
        message:
          result.officialDetection.message ??
          (result.officialDetection.available
            ? `官网 AI 率 ${result.officialDetection.aiPercent ?? "?"}%`
            : "官网检测 API 不可用，已多轮 Auto-Perfect 改写"),
      });
    }

    const qa = buildQaReport(checks, result.officialDetection?.attempts ?? 1, targetScore);
    if (result.officialDetection?.passed) {
      qa.confidence = "high";
      qa.passed = checks.every((c) => c.passed);
    } else if (result.officialDetection && !result.officialDetection.available) {
      qa.warning =
        result.officialDetection.message ??
        "API 套餐可能不含官网检测次数。已自动多轮改写，请复制结果到 AIUndetect 官网手动检测。";
    }

    return {
      text: result.text,
      beforeScore,
      afterScore,
      qa,
      provider: result.provider,
      wordsUsed: result.wordsUsed,
      remainingWords: result.remainingWords,
      officialDetection: result.officialDetection,
    };
  }

  let current = text;
  let bestText = text;
  let bestAfterScore = beforeScore;
  let provider: PipelineProvider = "rules";
  let totalWordsUsed = 0;
  let remainingWords: number | undefined;
  let passCount = 0;

  for (let pass = 1; pass <= MAX_PASSES && effectiveStrict; pass++) {
    passCount = pass;
    const result = await humanizeOnce(current, intensity, language, verifyLoop);
    provider = result.provider;
    if (result.wordsUsed) totalWordsUsed += result.wordsUsed;
    if (result.remainingWords !== undefined) remainingWords = result.remainingWords;

    const afterScore = estimateAiScore(result.text);
    if (shouldUpdateBest(text, result.text, afterScore.score, bestText, bestAfterScore.score)) {
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
        remainingWords,
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

    if (pass < MAX_PASSES && hasAnyAiHumanizer()) {
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

  const qa = buildQaReport(finalChecks, passCount, targetScore);
  if (isNearlySameText(text, bestText)) {
    qa.warning =
      "改写结果与原文几乎相同。请尝试「深度」强度、关闭严格质检后重试，或分段处理长文。";
    qa.confidence = "low";
    qa.passed = false;
  }

  return {
    text: bestText,
    beforeScore,
    afterScore: bestAfterScore,
    qa: buildQaReport(finalChecks, passCount, targetScore),
    provider,
    wordsUsed: totalWordsUsed || undefined,
    remainingWords,
  };
}
