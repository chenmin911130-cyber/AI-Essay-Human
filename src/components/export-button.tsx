"use client";

import { useState } from "react";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { exportContent, type ExportFormat } from "@/lib/file-utils";

interface ExportButtonProps {
  content: string;
  originalFilename: string | null;
  size?: "sm" | "lg";
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "txt", label: "TXT 文本" },
  { value: "docx", label: "Word 文档" },
  { value: "md", label: "Markdown" },
];

export function ExportButton({ content, originalFilename, size = "sm" }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    setExportError("");
    setShowMenu(false);
    try {
      await exportContent(content, format, originalFilename);
    } catch {
      setExportError("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const isLarge = size === "lg";

  return (
    <div className="relative">
      <div className="flex">
        <button
          type="button"
          onClick={() => handleExport("txt")}
          disabled={exporting}
          className={`flex items-center gap-1.5 bg-emerald-600 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 ${
            isLarge
              ? "rounded-l-xl px-6 py-2.5 text-sm"
              : "rounded-l-lg px-3 py-1.5 text-xs"
          }`}
        >
          {exporting ? (
            <Loader2 className={`animate-spin ${isLarge ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
          ) : (
            <Download className={isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} />
          )}
          导出下载
        </button>
        <button
          type="button"
          onClick={() => setShowMenu((v) => !v)}
          disabled={exporting}
          className={`border-l border-emerald-500 bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 ${
            isLarge ? "rounded-r-xl px-2 py-2.5" : "rounded-r-lg px-1.5 py-1.5"
          }`}
          aria-label="选择导出格式"
        >
          <ChevronDown className={isLarge ? "h-4 w-4" : "h-3.5 w-3.5"} />
        </button>
      </div>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleExport(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Download className="h-3.5 w-3.5 text-zinc-400" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {exportError && (
        <p className="absolute right-0 mt-1 whitespace-nowrap text-xs text-rose-500">
          {exportError}
        </p>
      )}
    </div>
  );
}
