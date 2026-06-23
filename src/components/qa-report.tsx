"use client";

import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";

export interface QaCheck {
  id: string;
  name: string;
  passed: boolean;
  message: string;
}

export interface QaReport {
  passed: boolean;
  checks: QaCheck[];
  passes: number;
  targetScore: number;
  confidence: "high" | "medium" | "low";
  warning?: string;
}

interface QaReportPanelProps {
  qa: QaReport;
}

const CONFIDENCE_LABELS = {
  high: { text: "高可信度", color: "text-emerald-600 dark:text-emerald-400" },
  medium: { text: "中等可信度", color: "text-amber-600 dark:text-amber-400" },
  low: { text: "低可信度", color: "text-rose-600 dark:text-rose-400" },
};

export function QaReportPanel({ qa }: QaReportPanelProps) {
  const confidence = CONFIDENCE_LABELS[qa.confidence];
  const passedCount = qa.checks.filter((c) => c.passed).length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">严格质检报告</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={confidence.color}>{confidence.text}</span>
          <span className="text-zinc-400">
            {passedCount}/{qa.checks.length} 项通过 · {qa.passes} 轮处理
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {qa.checks.map((check) => (
          <div
            key={check.id}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
              check.passed
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {check.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <div>
              <span className="font-medium">{check.name}</span>
              <span className="mx-1">—</span>
              <span>{check.message}</span>
            </div>
          </div>
        ))}
      </div>

      {qa.warning && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{qa.warning}</span>
        </div>
      )}
    </div>
  );
}
