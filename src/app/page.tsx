import { HumanizerApp } from "@/components/humanizer-app";
import { PenLine } from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1 bg-gradient-to-b from-violet-50/50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200/60 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
            <PenLine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">AI Essay Humanizer</h1>
            <p className="text-xs text-zinc-500">智能降 AI 率 · 让 Essay 更像人类写作</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            降低 Essay AI 检测率
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            粘贴 AI 生成的文章内容，一键改写为更自然的人类写作风格
          </p>
        </div>

        <HumanizerApp />

        <footer className="mt-12 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
          <p>
            AI 率估算基于文本特征启发式分析，仅供参考。规则模式无需 API Key 即可使用。
          </p>
        </footer>
      </div>
    </main>
  );
}
