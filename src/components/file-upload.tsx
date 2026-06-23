"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileUp, X, Loader2 } from "lucide-react";
import {
  ACCEPTED_EXTENSIONS,
  isAcceptedFile,
  parseUploadedFile,
} from "@/lib/file-utils";

interface FileUploadProps {
  onFileLoaded: (text: string, filename: string) => void;
  disabled?: boolean;
  currentFilename?: string | null;
  onClear?: () => void;
}

export function FileUpload({
  onFileLoaded,
  disabled,
  currentFilename,
  onClear,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const processFile = useCallback(
    async (file: File) => {
      setUploadError("");
      setUploading(true);
      try {
        const text = await parseUploadedFile(file);
        onFileLoaded(text, file.name);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "文件读取失败");
      } finally {
        setUploading(false);
      }
    },
    [onFileLoaded]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || disabled || uploading) return;
      const file = files[0];
      if (!isAcceptedFile(file)) {
        setUploadError("仅支持 .txt、.md、.docx 格式");
        return;
      }
      void processFile(file);
    },
    [disabled, uploading, processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const accept = ACCEPTED_EXTENSIONS.join(",");

  if (currentFilename) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-800 dark:bg-violet-950">
        <div className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
          <FileUp className="h-4 w-4 shrink-0" />
          <span className="truncate">{currentFilename}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || uploading}
          className="rounded-md p-1 text-violet-500 hover:bg-violet-100 disabled:opacity-50 dark:hover:bg-violet-900"
          aria-label="移除文件"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition-colors ${
          dragging
            ? "border-violet-400 bg-violet-50 dark:bg-violet-950"
            : "border-zinc-200 hover:border-violet-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-violet-700 dark:hover:bg-zinc-900"
        } ${disabled || uploading ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-violet-500" />
            <p className="text-sm text-zinc-500">正在读取文件...</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-6 w-6 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              点击或拖拽上传文件
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              支持 .txt、.md、.docx，最大 5MB
            </p>
          </>
        )}
      </div>
      {uploadError && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{uploadError}</p>
      )}
    </div>
  );
}
