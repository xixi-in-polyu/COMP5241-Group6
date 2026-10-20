# COMP5241 Group 6 — Learning Platform

基于 Next.js 16、Prisma 和 PostgreSQL 的学习平台。教师端支持按课程管理多份作业，并通过 `Sources → Knowledge → Brief → Draft` 四步流程生成有证据依据的题目。

当前阶段实现教师端作业生成与审核；学生答题端和互动游戏不在本功能范围内。

## 本地启动

```bash
cd learning-platform
npm ci
cp .env.example .env.local
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。不要提交 `.env.local`、`.vercel`、`.neon`、上传文件或任何凭据。

### 必需的云配置

在 `learning-platform/.env.local` 中配置：

- `DATABASE_URL`：应用运行时使用的 PostgreSQL 连接；Neon 建议使用 pooled URL。
- `DATABASE_URL_UNPOOLED`：Prisma migration 使用的 direct URL。
- `BLOB_READ_WRITE_TOKEN`：Private Vercel Blob。上传路径限制在 `learning-platform/courses/{courseId}/assignments/{assignmentId}/`。
- 一个 OpenAI-compatible AI Provider：通过 `AI_PROVIDER`、`AI_ENDPOINT`、`AI_API_KEY` 和 `AI_MODEL` 配置。
- `CRON_SECRET`：保护 Usage payload 清理接口。

Blob、数据库和 AI Provider 没有本地替代器；缺少相应配置时，相关功能会明确返回 `503` 或上传错误。

### AI Provider 配置

所有教师生成能力和学生 Chat 共用同一组配置。`AI_ENDPOINT` 应填写 API base URL；如果误填了以 `/chat/completions` 或 `/responses` 结尾的完整路径，应用会自动移除该后缀。

DeepSeek 官方：

```dotenv
AI_PROVIDER=deepseek
AI_ENDPOINT=https://api.deepseek.com
AI_API_KEY=你的DeepSeek API Key
AI_MODEL=deepseek-flash
```

港理工校内 DeepSeek（具体 endpoint、Key 和模型名以学校提供的信息为准）：

```dotenv
AI_PROVIDER=polyu
AI_ENDPOINT=https://学校提供的OpenAI兼容地址/v1
AI_API_KEY=学校提供的Key
AI_MODEL=学校提供的模型名
```

OpenRouter 免费模型路由：

```dotenv
AI_PROVIDER=openrouter
AI_ENDPOINT=https://openrouter.ai/api/v1
AI_API_KEY=你的OpenRouter API Key
AI_MODEL=openrouter/free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=COMP5241 Learning Platform
```

也可以将 `AI_MODEL` 改为具体的 `provider/model:free` slug。OpenRouter 免费路由受可用模型、速率限制和上下文策略影响，不建议把它当成稳定的生产 SLA。

## 数据库与测试教师

纯本地 PostgreSQL 可以使用 Docker 启动：

```bash
docker run --name learning-platform-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=learning_platform \
  -p 5432:5432 \
  -d postgres:17
```

对应 `.env.local`：

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learning_platform?schema=public
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/learning_platform?schema=public
```

本地 PostgreSQL 不区分 pooled/direct，因此两个变量使用相同 URL。若密码包含 `@`、`:`、`/`、`?` 等字符，需要先进行 URL encoding。使用 Neon 时，`DATABASE_URL` 填 pooled URL，`DATABASE_URL_UNPOOLED` 填 direct URL。

全新数据库直接部署全部 migration：

```bash
npm run db:migrate:deploy
```

对于已经存在 `User` 表、但尚未使用 Prisma Migrate 的数据库，先标记 baseline，再部署：

```bash
npm run db:migrate:baseline
npm run db:migrate:deploy
```

开发和 migration 验证不得直接使用生产数据库。CI 使用独立、无业务数据的 Neon 项目；每个 Preview 分支从空父分支创建后执行完整 migration。不要把 schema-only 分支直接交给 `prisma migrate deploy`：schema-only 分支没有 `_prisma_migrations` 数据，Prisma 会把已有表误判为未迁移。当前 migration 历史只允许追加，不应修改已应用的 migration。

创建隔离测试教师前，在本地设置 `TEST_TEACHER_PASSWORD`，然后运行：

```bash
npm run db:seed:feature
```

种子账号固定为 `ai-assignment-test@local.invalid`，密码只从环境变量读取。

## Vercel Blob

该功能使用 Private Vercel Blob，没有本地文件存储替代器。在 Vercel 项目的 Storage 页面创建或连接一个 Private Blob store 后，Vercel 会为项目生成 `BLOB_READ_WRITE_TOKEN`。可以从 Blob store 设置复制该值，或在已经 link 的 `learning-platform/` 目录执行：

```bash
npx vercel env pull .env.local
```

然后确认 `.env.local` 包含：

```dotenv
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_实际生成的值
```

`vercel env pull` 会更新目标文件，因此应先保留已有的数据库和 AI 配置。Token 只能放在 `.env.local` 或 Vercel Environment Variables 中，不得写入 `.env.example`、提交记录或浏览器端代码。

## 教师作业流程

1. 在 `/teacher/create` 只创建课程元数据。新课程会立即进入可创建作业的空工作区。
2. 在课程页点击 **Create assignment**，选择以下一种来源：
   - 最多两个英文、机器可读的 PDF/TXT/DOCX/PPTX，总计不超过 20 MiB；
   - 一个不超过 30 分钟、带英文字幕的公开 YouTube 视频；
   - 若课程已有确认知识，可不附加来源并复用课程知识快照。
3. 在 **Knowledge** 审核、选择、改名、改描述、调整父级、合并或删除知识点，再确认。
4. 在 **Brief** 设置题数、题型、难度、认知目标和覆盖范围；AI 建议只有接受后才修改 brief。
5. 在 **Draft** 编辑、排序、删除或手工新增题目，恢复失败槽，或为不满意的题目生成候选版本。
6. **Save** 后仍可编辑；**Submit** 后作业永久锁定。

已完成的步骤可通过 Tab 只读回看。处理中的步骤显示 spinner，未来步骤不可进入。切换 Tab 不会清除尚未保存的 Brief/Draft 本地状态。

## 验证命令

以下命令均在 `learning-platform/` 中执行：

```bash
npm run db:generate
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Playwright 流程需要 `SMOKE_TEACHER_EMAIL`、`SMOKE_TEACHER_PASSWORD`、`SMOKE_COURSE_ID` 和 `SMOKE_ASSIGNMENT_ID`。任一变量缺失时测试会失败，不允许通过跳过测试产生假绿灯。Preview workflow 会在隔离数据库中运行 `npm run db:seed:e2e` 并注入纯合成 fixture。

### 真实云 smoke

真实 smoke 会创建隔离课程和作业，上传合成的 PDF/TXT/DOCX/PPTX，审核知识，生成 20 道题，Save、Submit，并验证提交后锁定：

```bash
npm run test:smoke:ai-assignment
```

必需变量为 `SMOKE_BASE_URL`、`SMOKE_TEACHER_EMAIL`、`SMOKE_TEACHER_PASSWORD` 和 `BLOB_READ_WRITE_TOKEN`。可选变量：

- `SMOKE_YOUTUBE_URL`：应指向不超过 30 分钟且有可用英文字幕的公开视频，用于自动字幕路径。
- `SMOKE_TRANSCRIPT_VIDEO_URL`：应指向会进入字幕修复状态的视频；脚本会上传合成 TXT transcript 并验证恢复路径。

Smoke 会产生真实 Blob、数据库行和 AI 调用费用，应只在隔离 Neon 分支及开发 Blob 前缀执行。当前阶段没有整门课程/整份作业删除 API，执行后的测试数据需按云资源管理流程处理。

## GitHub Actions CI/CD

### Workflow 与合并门禁

仓库根目录的 workflow 分工如下：

| Workflow | 触发条件 | 作用 |
| --- | --- | --- |
| `CI` | PR 指向 `main`、push 到 `main`、手动 | lint、TypeScript、Vitest、生产构建、全新安装 migration、从当前 `main` 升级 migration |
| `Preview` | 内部 PR 创建或更新；manual 模式下使用 `deploy-preview` 标签 | 隔离 Neon 分支、Vercel Preview、Playwright E2E、PR URL 评论 |
| `Preview Cleanup` | PR 关闭 | 删除 `preview/pr-{number}`；7 天 TTL 是异常兜底 |
| `Production` | push 到 `main` 或手动 | 人工批准后创建恢复分支、迁移、候选部署、健康验证和 promote |
| `Maintenance Migration` | 手动 | 破坏性 migration 的双环境审批维护窗口 |
| `Break Glass Production` | 手动且显式启用 | 仅管理员可使用的审计化紧急部署 |

`main` 应要求 `quality`、`migration-fresh`、`migration-upgrade` 和 `preview-gate` 四项检查，并要求至少一名代码 reviewer、解决全部 conversation、分支保持最新；禁止 force-push 和删除。

`preview-gate` 只在下列情况降级为警告：Preview 被明确设置为 `off`/未加手动标签，或平台返回已识别的配额错误。构建、migration、E2E、认证错误和未知部署错误仍会失败。

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
- `production`：配置 `PRODUCTION_VERCEL_TOKEN`、`PRODUCTION_DATABASE_URL_UNPOOLED`、`PRODUCTION_NEON_API_KEY` 和可选 `PRODUCTION_AUTOMATION_BYPASS_SECRET`。Required reviewers 为 所有仓库成员，启用 prevent self-review。
- `maintenance-admin-approval`：仅管理员审批；`maintenance-peer-approval`：至少一位非管理员协作者审批。
- `production-emergency`：复制最小必需 Production secrets，仅在事件期间配合 `BREAK_GLASS_ENABLED=true` 使用，完成后立即关闭并轮换凭据。

Secrets 必须是项目专用、最小权限凭据，不使用个人日常 Token；每 30 天轮换。Preview Vercel Token 必须属于无法访问 Production 项目的独立 Vercel scope。Production direct DB URL 只存在于 `production`/`production-emergency` Environment，不配置到 Preview 或普通 Repository Secrets。

### Preview 数据与配额

Preview 只包含 `db:seed:e2e` 生成的合成账号、课程、作业和题目，不允许复制教师、学生或其他生产数据，也不配置生产 AI、Blob 或 Cron 凭据。Vercel CLI 始终在 `learning-platform/` 执行，该目录内完成项目 link；项目 Root Directory 保持 `.`。

Preview 与 Production Vercel 项目关闭 Vercel Git 自动部署，由 GitHub Actions 作为唯一部署入口，避免同一次 push 重复构建和消耗配额。

`PREVIEW_DEPLOYMENT_MODE`：

- `auto`：所有同仓库 PR 自动部署；fork PR 仍只运行无密钥 CI。
- `manual`：只有带 `deploy-preview` 标签的 PR 部署。
- `off`：不创建云资源，`preview-gate` 写入明确警告后结束。

接近 Hobby 配额时先切换到 `manual`，达到上限时切换到 `off`，为 Production 保留部署能力。旧 PR run 会被新 commit 取消；PR 关闭删除 Neon 分支。若 Vercel 套餐不支持自动 bypass，可临时公开只含合成数据的随机 Preview URL，禁止绑定真实数据或固定公开域名。

### Production 发布、恢复与紧急路径

首次启用时保持 `PRODUCTION_DEPLOYMENTS_ENABLED=false`：先完成 Preview dry run、检查 E2E artifact 和清理流程，再建立 `main` 保护，最后开启开关并由另一名 collaborator 批准首次发布。

Production 顺序固定为：构建 artifact → 创建 72 小时、无 compute 的 Neon recovery branch → 执行兼容 migration → 使用 `--skip-domain` 部署候选版本 → 验证首页、`/api/health` 和匿名 session → `vercel promote`。候选验证失败时旧域名不切换。Promote 后发现问题时回滚 Vercel deployment；数据库 migration 保持向前兼容并采用 forward-fix，确需数据恢复时使用 release backup 或 Neon PITR。

Migration 必须使用 expand-contract：先新增兼容结构、发布兼容代码，最后在后续维护窗口删除旧结构。`DROP TABLE/COLUMN/TYPE`、类型重写、`SET NOT NULL`、`TRUNCATE` 和数据删除会被 CI 拦截；`DROP INDEX` 会产生必须人工核对唯一性与性能影响的警告。无法拆分时，先启用 `MAINTENANCE_MIGRATIONS_ENABLED`，填写当前 `main` 完整 SHA、维护原因和恢复说明，依次取得管理员、同伴及 Production 审批；workflow 会先创建 72 小时恢复分支，完成后立即关闭开关。

Break-glass 默认关闭。事件中只有 `xixi-in-polyu` 能以当前 `main` 的完整 SHA和原因发起；使用后必须关闭 `BREAK_GLASS_ENABLED`、记录后续事件复盘并轮换 emergency credentials。它不能成为绕过常规 reviewer 的日常发布方式。

### 诊断与证据

- PR 页面查看 `Checks` 与唯一 Preview 评论。
- GitHub `Environments`/`Deployments` 查看候选和生产发布历史。
- Workflow 的 job summary 记录 commit、候选 URL、旧 deployment 和 Neon recovery branch 到期时间。
- Playwright trace 与 HTML report 仅在失败时上传，保留 14 天。
- 不得提交 `.env*`、`.vercel`、`.neon`、数据库 URL、Token、Playwright 报告或构建产物。

## Usage 与数据安全

- AI 请求按教师执行小时/每日限流，默认 `20/200`。
- 单事件完整上下文最多 2 MiB、单课程最多 100 MiB；超限只保留模型、状态、耗时、错误和大小等元数据。
- Cookie、Authorization、API Key、原始二进制和响应头不得写入 Usage payload。
- 完整请求/响应 payload 默认保存 30 天，由受 `CRON_SECRET` 保护的清理接口清空；统计元数据继续保留。
- Usage API 只允许课程所属教师读取，本阶段不提供 Dashboard。

## 依赖审计

`workflow@4.8.13` 当前带来 high 级传递依赖告警。禁止运行 `npm audit fix --force`。创建 PR 前运行：

```bash
npm audit --omit=dev
```

若 high 告警仍存在，可以创建 PR 供团队审查，但未经明确风险接受不得合并或部署。

## 主要页面

| 路径 | 说明 |
| --- | --- |
| `/` | 角色登录 |
| `/teacher` | 教师课程列表 |
| `/teacher/create` | 创建空课程工作区 |
| `/teacher/courses/{courseId}` | 作业列表；旧课程材料恢复/知识确认入口 |
| `/teacher/courses/{courseId}/assignments/create` | 作业 Sources 步骤 |
| `/teacher/courses/{courseId}/assignments/{assignmentId}` | 四步作业工作台 |
| `/student` | 现有学生工作区（本功能未扩展） |
