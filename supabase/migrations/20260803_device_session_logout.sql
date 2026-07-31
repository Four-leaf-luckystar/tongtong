-- 将设备记录与 Supabase Auth session 绑定，使“退出设备”能撤销对应会话。
alter table public.access_devices
    add column if not exists auth_session_id uuid;

create index if not exists access_devices_active_session_idx
    on public.access_devices (user_id, auth_session_id)
    where revoked_at is null and auth_session_id is not null;

create or replace function public.claim_my_access_device_with_session(
    p_device_id uuid,
    p_device_label text,
    p_device_browser text,
    p_auth_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null then
        raise exception 'AUTH_REQUIRED';
    end if;
    if p_auth_session_id is null then
        raise exception 'SESSION_REQUIRED';
    end if;

    perform public.claim_my_access_device_with_details(
        p_device_id,
        p_device_label,
        p_device_browser
    );

    update public.access_devices
    set auth_session_id = p_auth_session_id,
        last_seen_at = now()
    where user_id = auth.uid()
      and device_id = p_device_id
      and revoked_at is null;
end;
$$;

create or replace function public.assert_my_access_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null then
        raise exception 'AUTH_REQUIRED';
    end if;
    if not exists (
        select 1
        from public.access_devices d
        where d.user_id = auth.uid()
          and d.device_id = p_device_id
          and d.revoked_at is null
    ) then
        raise exception 'DEVICE_REVOKED';
    end if;
end;
$$;

create or replace function public.revoke_my_access_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_user_id uuid := auth.uid();
    target_session_id uuid;
begin
    if current_user_id is null then
        raise exception 'AUTH_REQUIRED';
    end if;

    select d.auth_session_id
    into target_session_id
    from public.access_devices d
    where d.user_id = current_user_id
      and d.device_id = p_device_id
      and d.revoked_at is null
    for update;

    if not found then
        raise exception 'DEVICE_NOT_FOUND';
    end if;

    update public.access_devices
    set revoked_at = now(),
        revoked_reason = 'self-service-logout'
    where user_id = current_user_id
      and device_id = p_device_id
      and revoked_at is null;

    if target_session_id is not null then
        delete from auth.sessions
        where id = target_session_id
          and user_id = current_user_id;
    end if;
end;
$$;

revoke all on function public.claim_my_access_device_with_session(uuid, text, text, uuid) from public;
revoke all on function public.assert_my_access_device(uuid) from public;
revoke all on function public.revoke_my_access_device(uuid) from public;
grant execute on function public.claim_my_access_device_with_session(uuid, text, text, uuid) to authenticated;
grant execute on function public.assert_my_access_device(uuid) to authenticated;
grant execute on function public.revoke_my_access_device(uuid) to authenticated;
