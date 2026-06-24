import { NextResponse } from "next/server";
import { estimateAiScore } from "@/lib/detection";
import { humanizeWithRules, type HumanizeIntensity } from "@/lib/humanize-rules";
import {
  AIUNDETECT_MIN_CHARS,
  getAiUndetectModelLabel,
  isAiUndetectAutoEnabled,
  isAiUndetectVerifyEnabled,
} from "@/lib/aiundetect";
import { getAiConfigError } from "@/lib/ai-config";
import { hasAnyAiHumanizer, runStrictPipeline } from "@/lib/qa-pipeline";
import { isNearlySameText } from "@/lib/utils";

export type HumanizeMode = "rules" | "ai" | "hybrid";

interface HumanizeRequest {
  text: string;
  mode?: HumanizeMode;
  intensity?: HumanizeIntensity;
  strict?: boolean;
  verifyLoop?: boolean;
  targetScore?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HumanizeRequest;
    const {
      text,
      mode = "hybrid",
      intensity = "standard",
      strict = false,
      verifyLoop = isAiUndetectVerifyEnabled(),
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

    if (text.length < AIUNDETECT_MIN_CHARS && hasAnyAiHumanizer()) {
      return NextResponse.json(
        {
          error: `AIUndetect 官方要求每次改写至少 ${AIUNDETECT_MIN_CHARS} 字符，当前 ${text.length} 字符。请补充内容后再试。`,
        },
        { status: 400 }
      );
    }

    if (!hasAnyAiHumanizer()) {
      return NextResponse.json(
        { error: getAiConfigError() ?? "AI 模式环境变量未配置。" },
        { status: 503 }
      );
    }

    const result = await runStrictPipeline({
      text,
      intensity,
      targetScore,
      strict,
      verifyLoop,
    });

    return NextResponse.json({
      original: text,
      humanized: result.text,
      beforeScore: result.beforeScore,
      afterScore: result.afterScore,
      mode,
      intensity,
      strict,
      verifyLoop,
      targetScore,
      provider: result.provider,
      aiundetect: result.provider === "aiundetect"
        ? {
            autoPerfect: isAiUndetectAutoEnabled(),
            verifyLoop,
            model: getAiUndetectModelLabel(intensity),
          }
        : undefined,
      officialDetection: result.officialDetection,
      improvement: result.beforeScore.score - result.afterScore.score,
      wordsUsed: result.wordsUsed,
      remainingWords: result.remainingWords,
      unchanged: isNearlySameText(text, result.text),
      qa: result.qa,
    });
  } catch (error) {
    console.error("Humanize error:", error);
    const message = error instanceof Error ? error.message : "处理失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
