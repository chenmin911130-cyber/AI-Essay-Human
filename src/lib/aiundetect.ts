import type { HumanizeIntensity } from "@/lib/humanize-rules";

/** Official API: https://www.aiundetect.com/api */
const REWRITE_URL = "https://aiundetect.com/api/v1/rewrite";
const DETECTION_URL = "https://aiundetect.com/api/v1/detection";
const SURPLUS_URL = "https://aiundetect.com/api/v1/surplus";

/** Official limit: 100 to 10000 characters per request */
export const AIUNDETECT_MIN_CHARS = 100;
export const AIUNDETECT_MAX_CHARS = 10000;
export const AIUNDETECT_DETECTION_MIN_CHARS = 100;
export const DEFAULT_OFFICIAL_AI_TARGET = 30;
export const MAX_VERIFY_ATTEMPTS = 5;

const ERROR_MESSAGES: Record<number, string> = {
  1001: "缺少 API Key（错误码 1001）",
  1002: "请求过于频繁，请稍后重试（错误码 1002）",
  1003: "API Key 无效，请检查 Key 与注册邮箱是否匹配（错误码 1003）",
  1004: "请求参数错误，文本需 100-10000 字符（错误码 1004）",
  1005: "不支持该文本语言（错误码 1005）",
  1006: "改写额度不足（错误码 1006）",
  1007: "AIUndetect 服务器错误（错误码 1007）",
  1008: "检测文本过短（错误码 1008）",
};

const DETECTION_ERROR_MESSAGES: Record<number, string> = {
  ...ERROR_MESSAGES,
  1006: "官网检测额度不足（检测次数与改写额度分开，API 套餐可能不含检测）",
};

export interface AiUndetectResult {
  text: string;
  wordsUsed?: number;
  remainingWords?: number;
}

export interface AiUndetectDetectionResult {
  available: boolean;
  passed?: boolean;
  aiPercent?: number;
  raw?: unknown;
  error?: string;
  errorCode?: number;
}

export interface AiUndetectVerifyResult extends AiUndetectResult {
  attempts: number;
  detectionAvailable: boolean;
  detectionPassed?: boolean;
  detectionAiPercent?: number;
  detectionMessage?: string;
}

export function getAiUndetectCredentials() {
  return {
    apiKey: process.env.AIUNDETECT_API_KEY?.trim() ?? "",
    email: process.env.AIUNDETECT_EMAIL?.trim().toLowerCase() ?? "",
  };
}

export function hasAiUndetect(): boolean {
  const { apiKey, email } = getAiUndetectCredentials();
  if (!apiKey || !email) return false;
  if (email.includes("example.com") || email.startsWith("your-")) return false;
  return true;
}

/** model: 0=more quality, 1=balance, 2=more human */
export function intensityToModel(intensity: HumanizeIntensity): "0" | "1" | "2" {
  if (intensity === "light") return "0";
  if (intensity === "standard") return "1";
  return "2";
}

/** Website Auto-Perfect mode — auto: "1" (costs 2x words). Default on. */
export function isAiUndetectAutoEnabled(): boolean {
  const value = process.env.AIUNDETECT_AUTO?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") return false;
  return true;
}

/** Rewrite → official detect → rewrite again until pass. Default on. */
export function isAiUndetectVerifyEnabled(): boolean {
  const value = process.env.AIUNDETECT_VERIFY?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") return false;
  return true;
}

function escalateIntensity(intensity: HumanizeIntensity): HumanizeIntensity {
  if (intensity === "light") return "standard";
  if (intensity === "standard") return "aggressive";
  return "aggressive";
}

export function getAiUndetectModelLabel(intensity: HumanizeIntensity): string {
  const model = intensityToModel(intensity);
  if (model === "0") return "Quality";
  if (model === "1") return "Balance";
  return "More Human";
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const block = current ? `${current}\n\n${para}` : para;
    if (block.length <= maxLen) {
      current = block;
      continue;
    }

    if (current) chunks.push(current);
    current = "";

    if (para.length <= maxLen) {
      current = para;
      continue;
    }

    const sentences = para.split(/(?<=[.!?。！？])\s+/);
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length <= maxLen) {
        current = next;
      } else {
        if (current) chunks.push(current);
        current = sentence;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

function validateChunkLength(text: string): void {
  if (text.length < AIUNDETECT_MIN_CHARS) {
    throw new Error(
      `AIUndetect 要求每次请求 100-10000 字符，当前仅 ${text.length} 字符。请补充内容或合并段落。`
    );
  }
  if (text.length > AIUNDETECT_MAX_CHARS) {
    throw new Error(`单段文本不能超过 ${AIUNDETECT_MAX_CHARS} 字符`);
  }
}

/**
 * Official rewrite API call — matches docs exactly:
 * POST /api/v1/rewrite
 * Authorization: API_KEY (no Bearer prefix)
 * body: { model, mail, auto, data }
 */
async function rewriteChunk(
  text: string,
  intensity: HumanizeIntensity,
  auto = isAiUndetectAutoEnabled()
): Promise<AiUndetectResult> {
  const { apiKey, email } = getAiUndetectCredentials();

  if (!apiKey || !email) {
    throw new Error("AIUNDETECT_API_KEY 或 AIUNDETECT_EMAIL 未配置");
  }

  validateChunkLength(text);

  const response = await fetch(REWRITE_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: intensityToModel(intensity),
      mail: email,
      auto: auto ? "1" : "0",
      data: text,
    }),
  });

  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data: string | null;
    words_used?: number;
    remaining_words?: number;
  };

  if (payload.code !== 200 || !payload.data?.trim()) {
    const message = ERROR_MESSAGES[payload.code] ?? payload.msg ?? "AIUndetect 改写失败";
    throw new Error(message);
  }

  return {
    text: payload.data.trim(),
    wordsUsed: payload.words_used,
    remainingWords: payload.remaining_words,
  };
}

export async function humanizeWithAiUndetect(
  text: string,
  intensity: HumanizeIntensity,
  options?: { auto?: boolean }
): Promise<AiUndetectResult> {
  const chunks = splitIntoChunks(text, AIUNDETECT_MAX_CHARS);
  const results: string[] = [];
  let totalWordsUsed = 0;
  let remainingWords: number | undefined;

  for (const chunk of chunks) {
    const result = await rewriteChunk(chunk, intensity, options?.auto);
    results.push(result.text);
    if (result.wordsUsed) totalWordsUsed += result.wordsUsed;
    if (result.remainingWords !== undefined) remainingWords = result.remainingWords;
  }

  return {
    text: results.join("\n\n"),
    wordsUsed: totalWordsUsed || undefined,
    remainingWords,
  };
}

function parseDetectionAiPercent(data: unknown): number | null {
  if (data === null || data === undefined) return null;
  if (typeof data === "number" && Number.isFinite(data)) return Math.round(data);
  if (typeof data === "string") {
    const parsed = parseFloat(data);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  if (typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  const preferredKeys = [
    "ai",
    "ai_rate",
    "aiRate",
    "rate",
    "score",
    "overall",
    "total",
    "average",
    "gptzero",
    "GPTZero",
  ];

  for (const key of preferredKeys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value);
    }
  }

  const numbers = Object.values(obj).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (numbers.length === 0) return null;
  return Math.round(Math.max(...numbers));
}

/**
 * Undocumented but live endpoint: POST /api/v1/detection
 * body: { mail, data }
 */
export async function detectWithAiUndetect(text: string): Promise<AiUndetectDetectionResult> {
  const { apiKey, email } = getAiUndetectCredentials();
  if (!apiKey || !email) {
    return { available: false, error: "AIUndetect 未配置" };
  }

  if (text.length < AIUNDETECT_DETECTION_MIN_CHARS) {
    return {
      available: false,
      error: `检测文本至少 ${AIUNDETECT_DETECTION_MIN_CHARS} 字符`,
    };
  }

  const response = await fetch(DETECTION_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mail: email, data: text }),
  });

  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data: unknown;
  };

  if (payload.code !== 200) {
    return {
      available: false,
      error: DETECTION_ERROR_MESSAGES[payload.code] ?? payload.msg,
      errorCode: payload.code,
    };
  }

  const aiPercent = parseDetectionAiPercent(payload.data);
  return {
    available: true,
    aiPercent: aiPercent ?? undefined,
    raw: payload.data,
  };
}

/**
 * Website-like loop: Auto-Perfect rewrite → official detect → rewrite again if needed.
 */
export async function humanizeWithVerifyLoop(
  text: string,
  intensity: HumanizeIntensity,
  options?: {
    auto?: boolean;
    maxAttempts?: number;
    targetAiPercent?: number;
  }
): Promise<AiUndetectVerifyResult> {
  const auto = options?.auto ?? isAiUndetectAutoEnabled();
  const maxAttempts = options?.maxAttempts ?? MAX_VERIFY_ATTEMPTS;
  const targetAiPercent = options?.targetAiPercent ?? DEFAULT_OFFICIAL_AI_TARGET;

  let current = text;
  let currentIntensity = intensity;
  let totalWordsUsed = 0;
  let remainingWords: number | undefined;
  let detectionAvailable = false;
  let lastDetection: AiUndetectDetectionResult | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rewritten = await humanizeWithAiUndetect(current, currentIntensity, { auto });
    if (rewritten.wordsUsed) totalWordsUsed += rewritten.wordsUsed;
    if (rewritten.remainingWords !== undefined) remainingWords = rewritten.remainingWords;

    const detection = await detectWithAiUndetect(rewritten.text);
    lastDetection = detection;

    if (detection.available) {
      detectionAvailable = true;
      const aiPercent = detection.aiPercent;
      const passed =
        aiPercent !== undefined && aiPercent !== null
          ? aiPercent <= targetAiPercent
          : false;

      if (passed) {
        return {
          text: rewritten.text,
          wordsUsed: totalWordsUsed || undefined,
          remainingWords,
          attempts: attempt,
          detectionAvailable: true,
          detectionPassed: true,
          detectionAiPercent: aiPercent,
          detectionMessage: `官网检测 AI 率 ${aiPercent}% ≤ 目标 ${targetAiPercent}%`,
        };
      }

      current = rewritten.text;
      currentIntensity = escalateIntensity(currentIntensity);
      continue;
    }

    // Detection API unavailable — keep Auto-Perfect rewriting (like clicking Humanize again).
    if (attempt === maxAttempts) {
      return {
        text: rewritten.text,
        wordsUsed: totalWordsUsed || undefined,
        remainingWords,
        attempts: attempt,
        detectionAvailable: false,
        detectionMessage:
          detection.error ??
          "官网检测 API 不可用，已完成多轮 Auto-Perfect 改写。请在 AIUndetect 官网手动检测验证。",
      };
    }

    current = rewritten.text;
    currentIntensity = escalateIntensity(currentIntensity);
  }

  const aiPercent = lastDetection?.aiPercent;
  return {
    text: current,
    wordsUsed: totalWordsUsed || undefined,
    remainingWords,
    attempts: maxAttempts,
    detectionAvailable,
    detectionPassed: false,
    detectionAiPercent: aiPercent,
    detectionMessage: aiPercent
      ? `经过 ${maxAttempts} 轮改写+检测，官网 AI 率仍为 ${aiPercent}%`
      : `经过 ${maxAttempts} 轮改写，仍未达到官网检测目标`,
  };
}

/**
 * Official balance API:
 * POST /api/v1/surplus
 */
export async function checkAiUndetectBalance(): Promise<{
  balance: number | null;
  error?: string;
}> {
  if (!hasAiUndetect()) {
    return { balance: null, error: "AIUndetect 未配置" };
  }

  const { apiKey, email } = getAiUndetectCredentials();

  const response = await fetch(SURPLUS_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mail: email }),
  });

  const payload = (await response.json()) as {
    code: number;
    msg: string;
    data: number | null;
  };

  if (payload.code !== 200) {
    return {
      balance: null,
      error: ERROR_MESSAGES[payload.code] ?? payload.msg,
    };
  }

  return { balance: payload.data };
}
