# 用户自有云端部署

所有记忆均以明文保存在使用者自己的服务中。本项目不会接收云端地址、密钥或记忆内容。

## Cloudflare Worker + D1

1. 在使用者自己的 Cloudflare 账户创建 D1 数据库。
2. 对 D1 执行 `cloudflare-schema.sql`。
3. 复制 `wrangler.toml.example` 为 `wrangler.toml`，填写自己的 `database_id`。
4. 在本目录执行 `wrangler secret put SYNC_TOKEN`，设置一个强随机令牌。
5. 执行 `wrangler deploy`，把得到的 Worker URL 和令牌填入应用的“通用 HTTP / Cloudflare Worker”。

Worker 实现 `/health`、`/list`、`/search`、`PUT /records/:id` 和 `DELETE /records/:id`，写入是幂等的。

## Supabase

1. 在使用者自己的 Supabase 项目 SQL Editor 执行 `supabase.sql`。
2. 使用者需要在应用中登录自己的 Supabase 用户，并填入项目 URL、publishable/anon key 与该用户的 access token。
3. 表名保持 `tonghuaji_memories`。RLS 会把每位登录用户限制在自己的记录内。

不要在浏览器中填写或保存 Supabase `service_role` key。
