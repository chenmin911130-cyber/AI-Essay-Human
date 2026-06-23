# AI Essay Humanizer — 降 AI 率工具

将 AI 生成的 Essay 改写为更自然的人类写作风格，降低 AI 检测率。

## 功能

- **三种处理模式**
  - **规则模式** — 无需 API Key，基于规则即时替换 AI 常见用语
  - **混合模式** — OpenRouter AI + 严格质检（推荐，需 API Key）
  - **AI 模式** — 纯 OpenRouter 深度改写（需 API Key）
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

如需使用 AI / 混合模式，配置 OpenRouter API Key：

```bash
cp .env.example .env.local
# 编辑 .env.local，填入 OPENROUTER_API_KEY
```

| 变量 | 说明 | 必填 |
|------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API 密钥（`sk-or-v1-` 格式） | AI/混合模式需要 |
| `OPENROUTER_MODEL` | 模型 ID，默认 `openai/gpt-4o-mini` | 否 |
| `OPENAI_API_KEY` | OpenAI 直连密钥（可选替代） | 否 |

## 技术栈

- [Next.js 16](https://nextjs.org/) — App Router
- [Tailwind CSS 4](https://tailwindcss.com/) — 样式
- [Vercel AI SDK](https://sdk.vercel.ai/) — AI 文本生成
- TypeScript

## 部署到 Vercel

### 方式一：一键导入（推荐）

点击以下链接，用 GitHub 账号登录 Vercel 后一键部署：

**https://vercel.com/new/clone?repository-url=https://github.com/chenmin911130-cyber/AI-Essay-Human**

部署完成后会得到一个 `*.vercel.app` 永久地址。

### 方式二：CLI 部署

```bash
npm install -g vercel
vercel login
vercel --prod
```

在 Vercel 项目 **Settings → Environment Variables** 中添加：

```
OPENROUTER_API_KEY = sk-or-v1-你的密钥
OPENROUTER_MODEL = openai/gpt-4o-mini
```

保存后重新部署，AI / 混合模式即可使用 OpenRouter。

### 方式三：GitHub Actions 自动部署

在 GitHub 仓库 Settings → Secrets 中添加：

| Secret | 说明 |
|--------|------|
| `VERCEL_TOKEN` | [Vercel Account Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | 运行 `vercel link` 后在 `.vercel/project.json` 中查看 |
| `VERCEL_PROJECT_ID` | 同上 |

推送代码到 `main` 分支后会自动部署。

## 免责声明

本工具的 AI 率估算基于文本特征启发式分析，不代表任何第三方 AI 检测工具的官方结果。请合理使用，遵守学术诚信规范。
