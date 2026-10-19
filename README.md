# COMP5241 Group 6 — Learning Platform

一个基于 Next.js 的学习平台，包含角色登录、师生工作区（课程与作业），以及基于 LLM 的 AI 学习助手。

> **注意**：目前课程和作业数据为前端 Mock 数据；数据库仅包含用户模型（`User`: id, email, password, role）。

## 🚀 快速开始

代码位于 `learning-platform/` 目录：

```bash
cd learning-platform
npm install

在 `learning-platform/` 下参考创建 `.env`，填写本地配置

安装依赖后生成 Prisma Client，并启动开发服务器：

```bash
npx prisma generate
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 使用应用。

## 常用命令

以下命令均在 `learning-platform/` 目录中运行：

```bash
npm run dev       # 启动开发服务器
npm run lint      # 运行 ESLint
npm run build     # 创建生产构建
npm run start     # 启动生产服务器
npx prisma generate
```

## 主要页面与接口

| 路径 | 说明 |
| --- | --- |
| `/` | 登录页面 |
| `/student` | 学生课程、作业与 AI 学习工作区 |
| `/teacher` | 教师工作区 |
| `/teacher/create` | 创建课程 |
| `/api/auth/login` | 登录接口（POST） |
| `/api/chat` | AI 对话接口（POST） |