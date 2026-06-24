"use client";

import { estimateAiScore, type DetectionResult } from "@/lib/detection";

interface ScoreBadgeProps {
  result: DetectionResult;
  label: string;
}

function getScoreColor(level: DetectionResult["level"]) {
  switch (level) {
    case "low":
      return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-800";
    case "medium":
      return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800";
    case "high":
      return "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950 dark:border-rose-800";
  }
}

function getBarColor(level: DetectionResult["level"]) {
  switch (level) {
    case "low":
      return "bg-emerald-500";
    case "medium":
      return "bg-amber-500";
    case "high":
      return "bg-rose-500";
  }
}

export function ScoreBadge({ result, label }: ScoreBadgeProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreColor(result.level)}`}
        >
          {result.score}%
        </span>
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(result.level)}`}
          style={{ width: `${result.score}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{result.label}</p>
    </div>
  );
}

interface ScoreComparisonProps {
  before: DetectionResult;
  after: DetectionResult;
}

export function ScoreComparison({ before, after }: ScoreComparisonProps) {
  const improvement = before.score - after.score;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ScoreBadge result={before} label="处理前 AI 率" />
        <ScoreBadge result={after} label="处理后 AI 率" />
      </div>
      {improvement > 0 && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          AI 率降低 {improvement}% ↓
        </div>
      )}
      {improvement <= 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-center text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          处理后 AI 率未明显下降。若用 GPTZero/Turnitin 检测仍为 100%，属正常现象——本站评分仅为内部估算，与第三方检测器不同。
        </div>
      )}
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        本站 AI 率为启发式估算，不代表 GPTZero、Turnitin 等官方结果。
      </p>
    </div>
  );
}

export function LiveScore({ text }: { text: string }) {
  const result = estimateAiScore(text);
  return <ScoreBadge result={result} label="当前 AI 率估算" />;
}
