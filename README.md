# COMP5241 Group 6 — Learning Platform

一个基于 Next.js 的学习平台，包含角色登录、师生工作区（课程与作业），以及基于 LLM 的 AI 学习助手。

> **注意**：目前课程和作业数据为前端 Mock 数据；数据库包含用户与登录会话模型。

## 🚀 快速开始

先进入应用目录并安装依赖：

```bash
cd learning-platform
npm install
```

在 `learning-platform/` 下参考 `.env.example` 创建 `.env`，填写本地配置。应用连接使用 `DATABASE_URL`；数据库迁移优先使用非池化的 `DATABASE_URL_UNPOOLED`。

安装依赖后生成 Prisma Client，并启动开发服务器：

```bash
npm run db:generate
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 使用应用。

## 常用命令

以下命令均在 `learning-platform/` 目录中运行：

```bash
npm run dev          # 启动开发服务器
npm run test         # 运行自动化测试
npm run lint         # 运行 ESLint
npm run typecheck    # 生成 Next 类型后运行 tsc
npm run build        # 创建生产构建
npm run start        # 启动生产服务器
npm run db:generate  # 生成 Prisma Client
```

`npm run typecheck` 先执行 `next typegen`，再运行 `tsc --noEmit`；直接运行 `tsc` 会因为缺少 Next 生成的路由类型（例如 `LayoutProps`）而报错。

运行命令前请确认当前目录是 `learning-platform/`。不要在仓库根目录直接运行不带版本的 `npx prisma`，否则 npm 会下载一个与项目锁定版本不同的 CLI。

## 数据库迁移

对于已有 `User` 表、但尚未使用 Prisma Migrate 的数据库，先执行一次 baseline，再部署后续迁移：

```bash
npm run db:migrate:baseline
npm run db:migrate:deploy
```

对于全新空数据库，只运行：

```bash
npm run db:migrate:deploy
```

## GitHub Actions CI/CD

### Workflow 与合并门禁

仓库根目录的 workflow 分工如下：

| Workflow | 触发条件 | 作用 |
| --- | --- | --- |
| `CI` | PR 指向 `main`、push 到 `main`、手动 | lint、TypeScript、Vitest、生产构建、全新数据库 migration、从当前 `main` 升级 migration |
| `Preview` | 内部 PR 创建或更新；manual 模式下使用 `deploy-preview` 标签 | 隔离 Neon 分支、Vercel Preview、Playwright E2E、PR URL 评论 |
| `Preview Cleanup` | PR 关闭 | 删除 `preview/pr-{number}`；7 天 TTL 是异常兜底 |
| `Production` | push 到 `main` 或手动 | 人工批准后创建恢复分支、迁移、候选部署、健康验证和 promote |
| `Maintenance Migration` | 手动 | 破坏性 migration 的双环境审批维护窗口 |
| `Break Glass Production` | 手动且显式启用 | 仅管理员可使用的审计化紧急部署 |

`main` 应要求 `quality`、`migration-fresh`、`migration-upgrade` 和 `preview-gate` 四项检查通过，并要求至少一名 reviewer、解决全部 conversation、分支保持最新；禁止 force-push 和删除。

`preview-gate` 只在下列情况降级为警告：Preview 被明确设置为 `off`/未加手动标签，或平台返回已识别的配额错误。构建、migration、E2E、认证错误和未知部署错误仍会失败。

`npm run ci:migrations:check` 读取 `prisma/migrations` 并把新增 SQL 与基线比较：`DROP TABLE/COLUMN/TYPE`、类型重写、`SET NOT NULL`、`TRUNCATE` 和数据删除会被拦截，`DROP INDEX` 只产生需要人工核对唯一性与性能影响的警告。

### GitHub Variables 与 Environments

Repository Variables：

```text
PREVIEW_DEPLOYMENT_MODE=off        # 完成首次配置后改为 auto；配额紧张时用 manual
PRODUCTION_DEPLOYMENTS_ENABLED=false
BREAK_GLASS_ENABLED=false
MAINTENANCE_MIGRATIONS_ENABLED=false
PREVIEW_VERCEL_ORG_ID=
PREVIEW_VERCEL_PROJECT_ID=
PRODUCTION_VERCEL_ORG_ID=
PRODUCTION_VERCEL_PROJECT_ID=
NEON_CI_PROJECT_ID=
NEON_CI_PARENT_BRANCH_ID=
NEON_PRODUCTION_PROJECT_ID=
NEON_PRODUCTION_BRANCH_ID=
```

创建以下 GitHub Environments：

- `preview`：配置 `PREVIEW_NEON_API_KEY`、`PREVIEW_VERCEL_TOKEN`；如果启用 Vercel Deployment Protection，再配置 `VERCEL_AUTOMATION_BYPASS_SECRET`。
- `production`：配置 `PRODUCTION_VERCEL_TOKEN`、`PRODUCTION_DATABASE_URL_UNPOOLED`、`PRODUCTION_NEON_API_KEY` 和可选 `PRODUCTION_AUTOMATION_BYPASS_SECRET`。Required reviewers 为所有仓库成员，启用 prevent self-review。
- `maintenance-admin-approval`：仅管理员审批；`maintenance-peer-approval`：至少一位非管理员协作者审批。
- `production-emergency`：复制最小必需 Production secrets，仅在事件期间配合 `BREAK_GLASS_ENABLED=true` 使用，完成后立即关闭并轮换凭据。

Secrets 必须是项目专用、最小权限凭据，不使用个人日常 Token；每 30 天轮换。Preview Vercel Token 必须属于无法访问 Production 项目的独立 Vercel scope。Production direct DB URL 只存在于 `production`/`production-emergency` Environment，不配置到 Preview 或普通 Repository Secrets。

### Preview 数据与配额

Preview 只包含 `db:seed:e2e` 生成的合成数据，不复制教师、学生或其他生产数据，也不配置生产数据库凭据。Vercel CLI 始终在 `learning-platform/` 执行，该目录内完成项目 link；项目 Root Directory 保持 `.`。

`db:seed:e2e` 与 `tests/e2e` 的断言 fixture 随作业工作流功能一起合入。在该 fixture 就绪之前保持 `PREVIEW_DEPLOYMENT_MODE=off`，否则 Preview E2E 步骤会因为缺少测试文件而失败。

Preview 与 Production Vercel 项目关闭 Vercel Git 自动部署，由 GitHub Actions 作为唯一部署入口，避免同一次 push 重复构建和消耗配额。

`PREVIEW_DEPLOYMENT_MODE`：

- `auto`：所有同仓库 PR 自动部署；fork PR 仍只运行无密钥 CI。
- `manual`：只有带 `deploy-preview` 标签的 PR 部署。
- `off`：不创建云资源，`preview-gate` 写入明确警告后结束。

接近 Hobby 配额时先切换到 `manual`，达到上限时切换到 `off`，为 Production 保留部署能力。旧 PR run 会被新 commit 取消；PR 关闭删除 Neon 分支。若 Vercel 套餐不支持自动 bypass，可临时公开只含合成数据的随机 Preview URL，禁止绑定真实数据或固定公开域名。

### Production 发布、恢复与紧急路径

首次启用时保持 `PRODUCTION_DEPLOYMENTS_ENABLED=false`：先完成 Preview dry run、检查 E2E artifact 和清理流程，再建立 `main` 保护，最后开启开关并由另一名 collaborator 批准首次发布。

Production 顺序固定为：构建 artifact → 创建 72 小时、无 compute 的 Neon recovery branch → 执行兼容 migration → 使用 `--skip-domain` 部署候选版本 → 验证首页、`/api/health` 和匿名 session → `vercel promote`。候选验证失败时旧域名不切换。`scripts/check-deployment-env.mjs` 会在构建前核对 `.vercel/.env.production.local` 中必需变量是否齐全。Promote 后发现问题时回滚 Vercel deployment；数据库 migration 保持向前兼容并采用 forward-fix，确需数据恢复时使用 release backup 或 Neon PITR。

Migration 必须使用 expand-contract：先新增兼容结构、发布兼容代码，最后在后续维护窗口删除旧结构。无法拆分时，先启用 `MAINTENANCE_MIGRATIONS_ENABLED`，填写当前 `main` 完整 SHA、维护原因和恢复说明，依次取得管理员、同伴及 Production 审批；workflow 会先创建 72 小时恢复分支，完成后立即关闭开关。

Break-glass 默认关闭。事件中只有 `xixi-in-polyu` 能以当前 `main` 的完整 SHA 和原因发起；使用后必须关闭 `BREAK_GLASS_ENABLED`、记录后续事件复盘并轮换 emergency credentials。它不能成为绕过常规 reviewer 的日常发布方式。

### 诊断与证据

- PR 页面查看 `Checks` 与唯一 Preview 评论。
- GitHub `Environments`/`Deployments` 查看候选和生产发布历史。
- Workflow 的 job summary 记录 commit、候选 URL、旧 deployment 和 Neon recovery branch 到期时间。
- Playwright trace 与 HTML report 仅在失败时上传，保留 14 天。
- 不得提交 `.env*`、`.vercel`、`.neon`、数据库 URL、Token、Playwright 报告或构建产物。

## 主要页面与接口

| 路径 | 说明 |
| --- | --- |
| `/` | 登录页面 |
| `/student` | 学生课程、作业与 AI 学习工作区 |
| `/teacher` | 教师工作区 |
| `/teacher/create` | 创建课程 |
| `/api/auth/login` | 登录接口（POST） |
| `/api/auth/logout` | 注销接口（POST） |
| `/api/auth/session` | 当前会话接口（GET） |
| `/api/chat` | AI 对话接口（POST） |
