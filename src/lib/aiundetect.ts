import type { HumanizeIntensity } from "@/lib/humanize-rules";

/** Official API: https://www.aiundetect.com/api */
const REWRITE_URL = "https://aiundetect.com/api/v1/rewrite";
const SURPLUS_URL = "https://aiundetect.com/api/v1/surplus";

/** Official limit: 100 to 10000 characters per request */
export const AIUNDETECT_MIN_CHARS = 100;
export const AIUNDETECT_MAX_CHARS = 10000;

const ERROR_MESSAGES: Record<number, string> = {
  1001: "缺少 API Key（错误码 1001）",
  1002: "请求过于频繁，请稍后重试（错误码 1002）",
  1003: "API Key 无效，请检查 Key 与注册邮箱是否匹配（错误码 1003）",
  1004: "请求参数错误，文本需 100-10000 字符（错误码 1004）",
  1005: "不支持该文本语言（错误码 1005）",
  1006: "改写额度不足（错误码 1006）",
  1007: "AIUndetect 服务器错误（错误码 1007）",
};

export interface AiUndetectResult {
  text: string;
  wordsUsed?: number;
  remainingWords?: number;
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
function intensityToModel(intensity: HumanizeIntensity): "0" | "1" | "2" {
  if (intensity === "light") return "0";
  if (intensity === "standard") return "1";
  return "2";
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
  auto = false
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
