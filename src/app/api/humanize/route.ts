import { generateText } from "ai";
import { NextResponse } from "next/server";
import { getAiModel, hasAiProvider } from "@/lib/ai-provider";
import { estimateAiScore } from "@/lib/detection";
import { humanizeWithRules, type HumanizeIntensity } from "@/lib/humanize-rules";
import { buildHumanizePrompt } from "@/lib/prompts";
import { hasRewriteAiKey, humanizeWithRewriteAi } from "@/lib/rewriteai";
import { detectLanguage } from "@/lib/utils";

export type HumanizeMode = "rules" | "ai" | "hybrid";

interface HumanizeRequest {
  text: string;
  mode?: HumanizeMode;
  intensity?: HumanizeIntensity;
}

async function humanizeWithLlm(
  text: string,
  intensity: HumanizeIntensity,
  language: ReturnType<typeof detectLanguage>
): Promise<string> {
  const model = getAiModel();
  if (!model) {
    throw new Error("未配置 LLM API Key");
  }

  const { text: aiResult } = await generateText({
    model,
    prompt: buildHumanizePrompt(text, intensity, language),
    temperature: intensity === "light" ? 0.5 : intensity === "standard" ? 0.7 : 0.85,
    maxOutputTokens: Math.min(4096, Math.ceil(text.length * 1.5)),
  });

  return aiResult.trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HumanizeRequest;
    const { text, mode = "hybrid", intensity = "standard" } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "请输入要处理的文本" }, { status: 400 });
    }

    if (text.length > 15000) {
      return NextResponse.json(
        { error: "文本过长，请控制在 15000 字符以内" },
        { status: 400 }
      );
    }

    const beforeScore = estimateAiScore(text);
    let humanized = text;
    const language = detectLanguage(text);
    let provider: "rewriteai" | "llm" | "rules" = "rules";
    let rewriteMeta: { wordsUsed?: number; alternatives?: string[] } = {};

    if (mode === "rules" || mode === "hybrid") {
      humanized = humanizeWithRules(humanized, intensity);
      provider = "rules";
    }

    if (mode === "ai" || mode === "hybrid") {
      if (hasRewriteAiKey()) {
        const result = await humanizeWithRewriteAi(humanized);
        humanized = result.text;
        provider = "rewriteai";
        rewriteMeta = {
          wordsUsed: result.wordsUsed,
          alternatives: result.alternatives,
        };
      } else if (hasAiProvider()) {
        humanized = await humanizeWithLlm(humanized, intensity, language);
        provider = "llm";

        if (mode === "hybrid") {
          humanized = humanizeWithRules(humanized, "light");
        }
      } else if (mode === "ai") {
        return NextResponse.json(
          {
            error:
              "AI 模式需要配置 REWRITEAI_API_KEY（推荐）或 OPENROUTER_API_KEY / OPENAI_API_KEY。",
          },
          { status: 503 }
        );
      }
    }

    const afterScore = estimateAiScore(humanized);

    return NextResponse.json({
      original: text,
      humanized,
      beforeScore,
      afterScore,
      mode,
      intensity,
      language,
      provider,
      improvement: beforeScore.score - afterScore.score,
      ...rewriteMeta,
    });
  } catch (error) {
    console.error("Humanize error:", error);
    const message = error instanceof Error ? error.message : "处理失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
