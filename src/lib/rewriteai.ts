const REWRITEAI_API_URL = "https://rewriteai.com/api/v1/humanize";

export interface RewriteAiResult {
  text: string;
  alternatives: string[];
  wordsUsed: number;
}

export function hasRewriteAiKey(): boolean {
  return Boolean(process.env.REWRITEAI_API_KEY);
}

export async function humanizeWithRewriteAi(text: string): Promise<RewriteAiResult> {
  const apiKey = process.env.REWRITEAI_API_KEY;
  if (!apiKey) {
    throw new Error("REWRITEAI_API_KEY 未配置");
  }

  const response = await fetch(REWRITEAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 401) {
      throw new Error("RewriteAI API Key 无效或已过期");
    }
    if (response.status === 402 || response.status === 429) {
      throw new Error("RewriteAI 额度不足或请求过于频繁，请稍后重试");
    }
    throw new Error(`RewriteAI 请求失败 (${response.status}): ${errorBody.slice(0, 120)}`);
  }

  const data = (await response.json()) as {
    results?: { text: string }[];
    wordsUsed?: number;
  };

  const results = data.results ?? [];
  if (!results.length || !results[0]?.text?.trim()) {
    throw new Error("RewriteAI 返回结果为空");
  }

  return {
    text: results[0].text.trim(),
    alternatives: results.slice(1).map((r) => r.text.trim()).filter(Boolean),
    wordsUsed: data.wordsUsed ?? 0,
  };
}
