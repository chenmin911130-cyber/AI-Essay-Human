# AI Essay Humanizer — 降 AI 率工具

将 AI 生成的 Essay 改写为更自然的人类写作风格，降低 AI 检测率。

## 功能

- **三种处理模式**
  - **规则模式** — 无需 API Key，基于规则即时替换 AI 常见用语
  - **混合模式** — 规则预处理 + AI 深度改写（推荐，需 API Key）
  - **AI 模式** — 纯 AI 深度人性化改写（需 API Key）
- **三种改写强度** — 轻度 / 标准 / 深度
- **AI 率估算** — 处理前后对比，基于文本特征启发式分析
- **中英文支持** — 自动识别语言并适配改写策略
- **一键复制** — 快速获取改写结果
- **文件上传** — 支持上传 .txt、.md、.docx 文件（拖拽或点击）
- **导出下载** — 降 AI 后一键导出为 TXT / Word / Markdown

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

**规则模式**无需任何配置，开箱即用。

## 环境变量（可选）

如需使用 AI / 混合模式，配置 OpenAI API Key：

```bash
cp .env.example .env.local
# 编辑 .env.local，填入 OPENAI_API_KEY
```

| 变量 | 说明 | 必填 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | AI/混合模式需要 |

## 技术栈

- [Next.js 16](https://nextjs.org/) — App Router
- [Tailwind CSS 4](https://tailwindcss.com/) — 样式
- [Vercel AI SDK](https://sdk.vercel.ai/) — AI 文本生成
- TypeScript

## 部署

推荐部署到 [Vercel](https://vercel.com)：

```bash
npx vercel
```

在 Vercel 项目设置中添加 `OPENAI_API_KEY` 环境变量即可启用 AI 模式。

## 免责声明

本工具的 AI 率估算基于文本特征启发式分析，不代表任何第三方 AI 检测工具的官方结果。请合理使用，遵守学术诚信规范。
