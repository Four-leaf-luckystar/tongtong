-- Private administrator data is stored only in Supabase.
create table if not exists public.access_admins (
    qq text references public.access_entitlements(qq) on delete cascade,
    role text not null default 'administrator' check (role in ('administrator', 'owner')),
    created_at timestamptz not null default now(),
    primary key (qq)
);

alter table public.access_admins enable row level security;
revoke all on public.access_admins from anon, authenticated;

drop function if exists public.bind_my_paid_qq();

create function public.bind_my_paid_qq()
returns table(qq text, is_admin boolean)
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

    return query
    select requested_qq, exists (select 1 from public.access_admins a where a.qq = requested_qq);
end;
$$;

revoke all on function public.bind_my_paid_qq() from public;
grant execute on function public.bind_my_paid_qq() to authenticated;
