import { NextResponse } from "next/server";
import { estimateAiScore } from "@/lib/detection";
import { humanizeWithRules, type HumanizeIntensity } from "@/lib/humanize-rules";
import { hasAnyAiHumanizer, runStrictPipeline } from "@/lib/qa-pipeline";

export type HumanizeMode = "rules" | "ai" | "hybrid";

interface HumanizeRequest {
  text: string;
  mode?: HumanizeMode;
  intensity?: HumanizeIntensity;
  strict?: boolean;
  targetScore?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HumanizeRequest;
    const {
      text,
      mode = "hybrid",
      intensity = "standard",
      strict = true,
      targetScore = 30,
    } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "请输入要处理的文本" }, { status: 400 });
    }

    if (text.length > 15000) {
      return NextResponse.json(
        { error: "文本过长，请控制在 15000 字符以内" },
        { status: 400 }
      );
    }

    if (mode === "rules") {
      const beforeScore = estimateAiScore(text);
      const humanized = humanizeWithRules(text, intensity);
      const afterScore = estimateAiScore(humanized);

      return NextResponse.json({
        original: text,
        humanized,
        beforeScore,
        afterScore,
        mode,
        intensity,
        strict: false,
        provider: "rules",
        improvement: beforeScore.score - afterScore.score,
        qa: {
          passed: afterScore.score <= targetScore,
          checks: [
            {
              id: "ai_score",
              name: "AI 率达标",
              passed: afterScore.score <= targetScore,
              message: `AI 率 ${afterScore.score}%`,
            },
          ],
          passes: 1,
          targetScore,
          confidence: afterScore.score <= targetScore ? "medium" : "low",
          warning:
            afterScore.score > targetScore
              ? "规则模式能力有限，建议使用混合/AI 模式并开启严格质检。"
              : undefined,
        },
      });
    }

    if (!hasAnyAiHumanizer()) {
      return NextResponse.json(
        {
          error:
            "AI 模式需要配置 AIUNDETECT_API_KEY + AIUNDETECT_EMAIL，或 OPENROUTER_API_KEY。",
        },
        { status: 503 }
      );
    }

    const result = await runStrictPipeline({
      text,
      intensity,
      targetScore,
      strict,
    });

    return NextResponse.json({
      original: text,
      humanized: result.text,
      beforeScore: result.beforeScore,
      afterScore: result.afterScore,
      mode,
      intensity,
      strict,
      targetScore,
      provider: result.provider,
      improvement: result.beforeScore.score - result.afterScore.score,
      wordsUsed: result.wordsUsed,
      remainingWords: result.remainingWords,
      qa: result.qa,
    });
  } catch (error) {
    console.error("Humanize error:", error);
    const message = error instanceof Error ? error.message : "处理失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
