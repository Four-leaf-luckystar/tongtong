-- Reuse a revoked device row when the same browser signs in again.
-- device_id is the primary key, so inserting a second row would fail.
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
        select 1
        from public.access_devices d
        where d.user_id = current_user_id
          and d.device_id = p_device_id
          and d.revoked_at is null
    ) then
        update public.access_devices
        set last_seen_at = now(),
            device_label = left(coalesce(nullif(trim(p_device_label), ''), 'Browser'), 64)
        where user_id = current_user_id and device_id = p_device_id;
        return;
    end if;

    select count(*) into active_device_count
    from public.access_devices d
    where d.user_id = current_user_id and d.revoked_at is null;
    if active_device_count >= 2 then
        raise exception 'DEVICE_LIMIT';
    end if;

    update public.access_devices
    set revoked_at = null,
        revoked_reason = null,
        last_seen_at = now(),
        device_label = left(coalesce(nullif(trim(p_device_label), ''), 'Browser'), 64)
    where user_id = current_user_id
      and device_id = p_device_id
      and revoked_at is not null;

    if found then
        return;
    end if;

    insert into public.access_devices (device_id, user_id, device_label)
    values (p_device_id, current_user_id, left(coalesce(nullif(trim(p_device_label), ''), 'Browser'), 64));
end;
$$;

revoke all on function public.claim_my_access_device(uuid, text) from public;
grant execute on function public.claim_my_access_device(uuid, text) to authenticated;
