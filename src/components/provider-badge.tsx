"use client";

const PROVIDER_LABELS: Record<string, string> = {
  aiundetect: "AIUndetect",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  rules: "规则引擎",
};

interface ProviderBadgeProps {
  provider: string;
  remainingWords?: number;
  aiundetect?: { autoPerfect: boolean; model: string };
}

export function ProviderBadge({ provider, remainingWords, aiundetect }: ProviderBadgeProps) {
  const label = PROVIDER_LABELS[provider] ?? provider;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
        {label}
      </span>
      {aiundetect && (
        <>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Auto-Perfect {aiundetect.autoPerfect ? "ON" : "OFF"}
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            {aiundetect.model}
          </span>
        </>
      )}
      {remainingWords !== undefined && (
        <span className="text-xs text-zinc-400">剩余 {remainingWords.toLocaleString()} 词</span>
      )}
    </div>
  );
}
