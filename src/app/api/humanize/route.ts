import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { estimateAiScore } from "@/lib/detection";
import { humanizeWithRules, type HumanizeIntensity } from "@/lib/humanize-rules";
import { buildHumanizePrompt } from "@/lib/prompts";
import { detectLanguage } from "@/lib/utils";

export type HumanizeMode = "rules" | "ai" | "hybrid";

interface HumanizeRequest {
  text: string;
  mode?: HumanizeMode;
  intensity?: HumanizeIntensity;
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

    if (mode === "rules" || mode === "hybrid") {
      humanized = humanizeWithRules(humanized, intensity);
    }

    if (mode === "ai" || mode === "hybrid") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        if (mode === "ai") {
          return NextResponse.json(
            {
              error:
                "AI 模式需要配置 OPENAI_API_KEY 环境变量。请使用「规则模式」或配置 API Key。",
            },
            { status: 503 }
          );
        }
      } else {
        const openai = createOpenAI({ apiKey });
        const { text: aiResult } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: buildHumanizePrompt(humanized, intensity, language),
          temperature: intensity === "light" ? 0.5 : intensity === "standard" ? 0.7 : 0.85,
          maxOutputTokens: Math.min(4096, Math.ceil(text.length * 1.5)),
        });
        humanized = aiResult.trim();
      }
    }

    if (mode === "hybrid" && process.env.OPENAI_API_KEY) {
      humanized = humanizeWithRules(humanized, "light");
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
      improvement: beforeScore.score - afterScore.score,
    });
  } catch (error) {
    console.error("Humanize error:", error);
    return NextResponse.json(
      { error: "处理失败，请稍后重试" },
      { status: 500 }
    );
  }
}
