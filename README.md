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
npm run build        # 创建生产构建
npm run start        # 启动生产服务器
npm run db:generate  # 生成 Prisma Client
```

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
