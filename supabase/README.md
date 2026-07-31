# 童话机访问控制

首次部署已创建两个管理员永久资格：`1509048968` 与 `3292315195`。

在 QQ 群监听接入前，付款审核通过后可在 Supabase SQL Editor 执行：

```sql
insert into public.access_entitlements (qq, status, source, note)
values ('用户QQ号', 'active', 'manual-payment', '付款已人工核验')
on conflict (qq) do update
set status = 'active', granted_at = now(), source = excluded.source, note = excluded.note;
```

封禁或退款时执行：

```sql
update public.access_entitlements
set status = 'revoked', note = '退款或封禁'
where qq = '用户QQ号';
```

恢复永久资格时，把 `status` 改回 `active`。资格与 QQ 群成员状态分离；离群不会自动取消资格。
