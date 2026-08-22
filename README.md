# MyGuru SPM 龙虎榜

中文 SPM 四选一练习平台：学生可按科目完成每日 20 题、进入日榜与连续打卡榜；老师经邀请码验证后可上传文字型 PDF、审核题目并发布。

## 已实现功能

- Google 登录与服务器端身份验证
- 学生自主选择科目；当天首次 20 题锁定并计入该科日榜
- 提交后显示答案与解析；非正式练习不会改变日榜
- 马来西亚日期（UTC+8）计算、同分同名次、连续打卡榜
- 教师邀请码、PDF 私有储存、ABCD 草稿提取、人工确认答案后发布
- Supabase Row Level Security、私有 Storage bucket 与服务端角色检查

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

浏览器打开 `http://localhost:3000`。开发模式未配置 Supabase 时会显示演示题目；真实登录、题库与上传功能需要下列环境变量。

## 环境变量

复制 `.env.example` 至 `.env.local`，填入同一个 Supabase 项目的值：

| 变量 | 用途 | 是否公开 |
| --- | --- | --- |
| `SPM_SUPABASE_URL` | API 路由使用的 Supabase URL | 否 |
| `SPM_SUPABASE_SERVICE_ROLE_KEY` | 仅服务器端使用的 service role key | 否，绝不可使用 `NEXT_PUBLIC_` 前缀 |
| `NEXT_PUBLIC_SPM_SUPABASE_URL` | 浏览器端 Supabase URL | 是 |
| `NEXT_PUBLIC_SPM_SUPABASE_PUBLISHABLE_KEY` | 浏览器端 publishable key | 是 |
| `TEACHER_INVITE_CODE` | 教师权限邀请码 | 否 |

生产环境需在 Vercel 的 Production 环境中设置相同变量，并重新部署。不要把 `.env.local` 提交到 Git。

## 数据库与 Storage

首次部署前，使用拥有数据库连接权限的环境执行：

```bash
POSTGRES_URL='postgresql://...' npm run db:apply
```

此命令会依次运行 `supabase/migrations/` 内的迁移，建立用户、题库、每日任务、排行、上传记录与题目审核字段，以及 `question-papers` 私有储存桶。

## 上线前检查

1. 在 Supabase Auth 启用 Google Provider，并填写 Google OAuth Client ID 与 Client Secret。
2. 在 Google Cloud OAuth Client 的 Authorized JavaScript origins 与 Redirect URIs 中加入生产网址。
3. 在 Supabase Auth URL Configuration 填入生产 Site URL 与 redirect URL。
4. 以老师帐号验证邀请码，上传一份文字型 PDF，逐题确认答案并发布。
5. 每个可供学生选择的科目至少发布 20 题；否则每日任务会明确提示题目不足。

## 验证命令

```bash
npx next build --webpack
npm run build
curl https://spm-longhubang.vercel.app/api/backend-status
```

后端正常时，最后一条会返回 `{"connected":true}`。
