"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  FileText,
} from "lucide-react";
import { LiveScore, ScoreComparison } from "@/components/score-badge";
import { FileUpload } from "@/components/file-upload";
import { ExportButton } from "@/components/export-button";
import { QaReportPanel, type QaReport } from "@/components/qa-report";
import { ProviderBadge } from "@/components/provider-badge";
import { countWords, isNearlySameText } from "@/lib/utils";
import type { DetectionResult } from "@/lib/detection";
import type { HumanizeIntensity } from "@/lib/humanize-rules";

type HumanizeMode = "rules" | "ai" | "hybrid";

interface HumanizeResult {
  humanized: string;
  beforeScore: DetectionResult;
  afterScore: DetectionResult;
  improvement: number;
  provider?: string;
  remainingWords?: number;
  unchanged?: boolean;
  aiundetect?: { autoPerfect: boolean; model: string };
  qa?: QaReport;
}

const MODE_OPTIONS: { value: HumanizeMode; label: string; desc: string }[] = [
  { value: "rules", label: "规则模式", desc: "无需 API，即时处理" },
  { value: "hybrid", label: "混合模式", desc: "AI + 严格质检（推荐）" },
  { value: "ai", label: "AI 模式", desc: "纯 AI 深度改写" },
];

const INTENSITY_OPTIONS: { value: HumanizeIntensity; label: string; desc?: string }[] = [
  { value: "light", label: "Quality", desc: "model 0" },
  { value: "standard", label: "Balance", desc: "model 1 · 官网默认" },
  { value: "aggressive", label: "More Human", desc: "model 2" },
];

export function HumanizerApp() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [mode, setMode] = useState<HumanizeMode>("hybrid");
  const [intensity, setIntensity] = useState<HumanizeIntensity>("standard");
  const [strict, setStrict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<HumanizeResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleHumanize = async () => {
    if (!input.trim()) {
      setError("请先输入或上传 Essay 内容");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, mode, intensity, strict, targetScore: 30 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "处理失败");
        return;
      }

      setOutput(data.humanized);
      setResult({
        humanized: data.humanized,
        beforeScore: data.beforeScore,
        afterScore: data.afterScore,
        improvement: data.improvement,
        provider: data.provider,
        remainingWords: data.remainingWords,
        unchanged: isNearlySameText(input, data.humanized),
        aiundetect: data.aiundetect,
        qa: data.qa,
      });
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleFileLoaded = (text: string, filename: string) => {
    setInput(text);
    setUploadedFilename(filename);
    setOutput("");
    setResult(null);
    setError("");
  };

  const handleClearFile = () => {
    setUploadedFilename(null);
    setInput("");
    setOutput("");
    setResult(null);
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInput("");
    setOutput("");
    setUploadedFilename(null);
    setResult(null);
    setError("");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            处理模式
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  mode === opt.value
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-zinc-500">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            改写强度
          </label>
          <div className="flex gap-2">
            {INTENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setIntensity(opt.value)}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  intensity === opt.value
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <div>{opt.label}</div>
                {opt.desc && (
                  <div className="text-[10px] font-normal text-zinc-500">{opt.desc}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode !== "rules" && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950">
          <input
            type="checkbox"
            checked={strict}
            onChange={(e) => setStrict(e.target.checked)}
            className="h-4 w-4 rounded border-violet-300 text-violet-600"
          />
          <div>
            <div className="text-sm font-medium text-violet-800 dark:text-violet-200">
              严格质检模式
            </div>
            <div className="text-xs text-violet-600 dark:text-violet-400">
              多轮迭代 + 6 项质检。开启 Auto-Perfect 时由 AIUndetect 自动优化，无需此项。
            </div>
          </div>
        </label>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <FileText className="h-4 w-4" />
              原始 Essay
            </label>
            <span className="text-xs text-zinc-400">
              {countWords(input)} 字 · {input.length} 字符
            </span>
          </div>

          <FileUpload
            onFileLoaded={handleFileLoaded}
            currentFilename={uploadedFilename}
            onClear={handleClearFile}
            disabled={loading}
          />

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (uploadedFilename) setUploadedFilename(null);
            }}
            placeholder="粘贴内容，或使用上方上传 .txt / .md / .docx 文件..."
            className="h-60 w-full resize-none rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-violet-900"
          />
          {input.trim() && !result && <LiveScore text={input} />}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Sparkles className="h-4 w-4" />
              人性化结果
            </label>
            {output && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "已复制" : "复制"}
                </button>
                <ExportButton
                  content={output}
                  originalFilename={uploadedFilename}
                />
              </div>
            )}
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="处理后的内容将显示在这里..."
            className="h-72 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed outline-none dark:border-zinc-700 dark:bg-zinc-900/50"
          />
          {output && (
            <span className="text-xs text-zinc-400">
              {countWords(output)} 字 · {output.length} 字符
            </span>
          )}
        </div>
      </div>

      {result && <ScoreComparison before={result.beforeScore} after={result.afterScore} />}

      {result?.provider && (
        <div className="flex flex-col items-center gap-2">
          <ProviderBadge
            provider={result.provider}
            remainingWords={result.remainingWords}
            aiundetect={result.aiundetect}
          />
          {result.unchanged && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400">
              改写结果与原文几乎相同，请尝试「深度」强度或分段处理。
            </p>
          )}
        </div>
      )}

      {result?.qa && <QaReportPanel qa={result.qa} />}

      {output && result && (
        <div className="flex justify-center">
          <ExportButton
            content={output}
            originalFilename={uploadedFilename}
            size="lg"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <RotateCcw className="h-4 w-4" />
          清空
        </button>
        <button
          onClick={handleHumanize}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {strict && mode !== "rules" ? "严格质检处理中..." : "处理中..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              开始降 AI 率
            </>
          )}
        </button>
      </div>
    </div>
  );
}
