import type { HumanizeIntensity } from "@/lib/humanize-rules";

const REWRITE_URL = "https://aiundetect.com/api/v1/rewrite";
const MIN_CHARS = 100;
const MAX_CHARS = 10000;

const ERROR_MESSAGES: Record<number, string> = {
  1001: "缺少 API Key",
  1002: "请求过于频繁，请稍后重试",
  1003: "API Key 无效，请检查 Key 和注册邮箱是否匹配",
  1004: "请求参数错误",
  1005: "不支持该文本语言",
  1006: "改写额度不足",
  1007: "AIUndetect 服务器错误",
};

export interface AiUndetectResult {
  text: string;
  wordsUsed?: number;
  remainingWords?: number;
}

export function hasAiUndetect(): boolean {
  const key = process.env.AIUNDETECT_API_KEY?.trim();
  const email = process.env.AIUNDETECT_EMAIL?.trim();
  if (!key || !email) return false;
  if (email.includes("example.com") || email.startsWith("your-")) return false;
  return true;
}

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

async function rewriteChunk(
  text: string,
  intensity: HumanizeIntensity
): Promise<AiUndetectResult> {
  const apiKey = process.env.AIUNDETECT_API_KEY;
  const email = process.env.AIUNDETECT_EMAIL;

  if (!apiKey || !email) {
    throw new Error("AIUNDETECT_API_KEY 或 AIUNDETECT_EMAIL 未配置");
  }

  if (text.length < MIN_CHARS) {
    throw new Error(`AIUNDETECT_TOO_SHORT:${text.length}`);
  }

  const response = await fetch(REWRITE_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: intensityToModel(intensity),
      mail: email,
      auto: "0",
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
  intensity: HumanizeIntensity
): Promise<AiUndetectResult> {
  const chunks = splitIntoChunks(text, MAX_CHARS);
  const results: string[] = [];
  let totalWordsUsed = 0;
  let remainingWords: number | undefined;

  for (const chunk of chunks) {
    let chunkText = chunk;

    if (chunkText.length < MIN_CHARS) {
      chunkText = `${chunkText}\n\nThis additional context helps maintain the original meaning and flow of the rewritten content.`;
      if (chunkText.length < MIN_CHARS) {
        throw new Error(`AIUNDETECT_TOO_SHORT:${chunk.length}`);
      }
    }

    const result = await rewriteChunk(chunkText, intensity);
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

export async function checkAiUndetectBalance(): Promise<number | null> {
  if (!hasAiUndetect()) return null;

  const response = await fetch("https://aiundetect.com/api/v1/surplus", {
    method: "POST",
    headers: {
      Authorization: process.env.AIUNDETECT_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mail: process.env.AIUNDETECT_EMAIL }),
  });

  const payload = (await response.json()) as { code: number; data: number | null };
  return payload.code === 200 ? payload.data : null;
}
