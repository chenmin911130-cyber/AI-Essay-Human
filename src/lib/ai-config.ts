import { hasAiUndetect } from "@/lib/aiundetect";
import { hasAiProvider } from "@/lib/ai-provider";

export function getAiConfigStatus() {
  const key = process.env.AIUNDETECT_API_KEY?.trim();
  const email = process.env.AIUNDETECT_EMAIL?.trim().toLowerCase();
  const openRouter = process.env.OPENROUTER_API_KEY?.trim();
  const openAi = process.env.OPENAI_API_KEY?.trim();

  return {
    aiundetect: {
      hasKey: Boolean(key),
      hasEmail: Boolean(email),
      ready: hasAiUndetect(),
    },
    openrouter: Boolean(openRouter),
    openai: Boolean(openAi),
    ready: hasAiUndetect() || hasAiProvider(),
  };
}

export function getAiConfigError(): string | null {
  const status = getAiConfigStatus();
  if (status.ready) return null;

  const missing: string[] = [];

  if (status.aiundetect.hasKey && !status.aiundetect.hasEmail) {
    missing.push("已配置 AIUNDETECT_API_KEY，但缺少 AIUNDETECT_EMAIL（注册邮箱）");
  } else if (!status.aiundetect.hasKey && status.aiundetect.hasEmail) {
    missing.push("已配置 AIUNDETECT_EMAIL，但缺少 AIUNDETECT_API_KEY");
  } else if (!status.aiundetect.hasKey) {
    missing.push("未配置 AIUNDETECT_API_KEY");
    missing.push("未配置 AIUNDETECT_EMAIL");
  }

  if (!status.openrouter && !status.openai) {
    missing.push("未配置 OPENROUTER_API_KEY（备用）");
  }

  return `${missing.join("；")}。请在 Vercel → Settings → Environment Variables 添加后重新部署（Redeploy）。`;
}
