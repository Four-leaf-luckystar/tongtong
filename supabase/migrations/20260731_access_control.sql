-- 童话机全局访问控制。请在 Supabase Dashboard -> SQL Editor 中完整执行一次。
-- 登录账号固定为 QQ号@qq.com；资格由管理员维护，离群不会自动失效。

create table if not exists public.access_entitlements (
    qq text primary key check (qq !~ '[^0-9]' and char_length(qq) between 5 and 12 and left(qq, 1) <> '0'),
    status text not null default 'active' check (status in ('active', 'revoked')),
    granted_at timestamptz not null default now(),
    source text not null default 'manual',
    note text not null default ''
);

create table if not exists public.access_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    qq text not null unique references public.access_entitlements(qq),
    bound_at timestamptz not null default now()
);

create table if not exists public.access_devices (
    device_id uuid primary key,
    user_id uuid not null references public.access_profiles(user_id) on delete cascade,
    device_label text not null default '浏览器' check (char_length(device_label) between 1 and 64),
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    revoked_at timestamptz,
    revoked_reason text,
    unique (user_id, device_id)
);

create index if not exists access_devices_active_user_idx on public.access_devices (user_id) where revoked_at is null;

alter table public.access_entitlements enable row level security;
alter table public.access_profiles enable row level security;
alter table public.access_devices enable row level security;

revoke all on public.access_entitlements, public.access_profiles, public.access_devices from anon, authenticated;

create or replace function public.bind_my_paid_qq()
returns table(qq text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid := auth.uid();
    account_email text;
    requested_qq text;
    existing_qq text;
begin
    account_email := lower(coalesce((auth.jwt()) ->> 'email', ''));
    if current_user_id is null then
        raise exception 'AUTH_REQUIRED';
    end if;
    requested_qq := split_part(account_email, '@', 1);
    if split_part(account_email, '@', 2) <> 'qq.com'
       or requested_qq ~ '[^0-9]'
       or char_length(requested_qq) not between 5 and 12
       or left(requested_qq, 1) = '0' then
        raise exception 'QQ_EMAIL_REQUIRED';
    end if;

    select p.qq into existing_qq from public.access_profiles p where p.user_id = current_user_id;
    if existing_qq is not null and existing_qq <> requested_qq then
        raise exception 'ACCOUNT_ALREADY_BOUND';
    end if;
    if not exists (
        select 1 from public.access_entitlements e where e.qq = requested_qq and e.status = 'active'
    ) then
        raise exception 'ACCESS_NOT_GRANTED';
    end if;

    insert into public.access_profiles (user_id, qq)
    values (current_user_id, requested_qq)
    on conflict (user_id) do update set qq = excluded.qq;

    return query select requested_qq;
end;
$$;

create or replace function public.claim_my_access_device(p_device_id uuid, p_device_label text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid := auth.uid();
    active_device_count integer;
begin
    if current_user_id is null then
        raise exception 'AUTH_REQUIRED';
    end if;
    if not exists (
        select 1
        from public.access_profiles p
        join public.access_entitlements e on e.qq = p.qq
        where p.user_id = current_user_id and e.status = 'active'
    ) then
        raise exception 'ACCESS_NOT_GRANTED';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
    if exists (
        select 1 from public.access_devices d
        where d.user_id = current_user_id and d.device_id = p_device_id and d.revoked_at is null
    ) then
        update public.access_devices
        set last_seen_at = now(), device_label = left(coalesce(nullif(trim(p_device_label), ''), '浏览器'), 64)
        where user_id = current_user_id and device_id = p_device_id;
        return;
    end if;

    select count(*) into active_device_count
    from public.access_devices d
    where d.user_id = current_user_id and d.revoked_at is null;
    if active_device_count >= 2 then
        raise exception 'DEVICE_LIMIT';
    end if;

    insert into public.access_devices (device_id, user_id, device_label)
    values (p_device_id, current_user_id, left(coalesce(nullif(trim(p_device_label), ''), '浏览器'), 64));
end;
$$;

create or replace function public.list_my_access_devices(p_current_device_id uuid)
returns table(device_id uuid, device_label text, first_seen_at timestamptz, last_seen_at timestamptz, is_current boolean)
language sql
security definer
set search_path = public, auth
as $$
    select d.device_id, d.device_label, d.first_seen_at, d.last_seen_at, d.device_id = p_current_device_id
    from public.access_devices d
    where d.user_id = auth.uid() and d.revoked_at is null
    order by d.last_seen_at desc;
$$;

create or replace function public.revoke_my_access_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null then
        raise exception 'AUTH_REQUIRED';
    end if;
    update public.access_devices
    set revoked_at = now(), revoked_reason = 'self-service'
    where user_id = auth.uid() and device_id = p_device_id and revoked_at is null;
end;
$$;

revoke all on function public.bind_my_paid_qq() from public;
revoke all on function public.claim_my_access_device(uuid, text) from public;
revoke all on function public.list_my_access_devices(uuid) from public;
revoke all on function public.revoke_my_access_device(uuid) from public;
grant execute on function public.bind_my_paid_qq() to authenticated;
grant execute on function public.claim_my_access_device(uuid, text) to authenticated;
grant execute on function public.list_my_access_devices(uuid) to authenticated;
grant execute on function public.revoke_my_access_device(uuid) to authenticated;

-- 不在迁移中写入真实 QQ。付款资格和管理员账号仅在 Supabase 私有表中维护。
