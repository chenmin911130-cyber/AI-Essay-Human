export const ACCEPTED_FILE_TYPES = {
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export const ACCEPTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export type ExportFormat = "txt" | "docx" | "md";

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function isAcceptedFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number]);
}

export async function parseUploadedFile(file: File): Promise<string> {
  if (!isAcceptedFile(file)) {
    throw new Error("仅支持 .txt、.md、.docx 格式");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("文件大小不能超过 5MB");
  }

  const ext = getFileExtension(file.name);

  if (ext === ".txt" || ext === ".md") {
    const text = await file.text();
    if (!text.trim()) throw new Error("文件内容为空");
    return text;
  }

  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (!result.value.trim()) throw new Error("文件内容为空");
    return result.value;
  }

  throw new Error("不支持的文件格式");
}

export function getExportFilename(
  originalName: string | null,
  format: ExportFormat
): string {
  const ext = format === "docx" ? ".docx" : format === "md" ? ".md" : ".txt";
  if (!originalName) return `essay_humanized${ext}`;
  const base = originalName.replace(/\.[^.]+$/, "");
  return `${base}_humanized${ext}`;
}

export function downloadTextFile(content: string, filename: string): void {
  const mimeType = filename.endsWith(".md")
    ? "text/markdown;charset=utf-8"
    : "text/plain;charset=utf-8";
  const blob = new Blob([content], { type: mimeType });
  triggerDownload(blob, filename);
}

export async function downloadDocxFile(
  content: string,
  filename: string
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");

  const paragraphs = content.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)],
      })
  );

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, filename);
}

export async function exportContent(
  content: string,
  format: ExportFormat,
  originalFilename: string | null
): Promise<void> {
  const filename = getExportFilename(originalFilename, format);

  if (format === "docx") {
    await downloadDocxFile(content, filename);
    return;
  }

  downloadTextFile(content, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
