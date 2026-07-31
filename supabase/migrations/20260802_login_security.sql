-- 登录与安全页面所需的设备详情。保留 20260731 中的原有 RPC，避免旧缓存客户端失效。
alter table public.access_devices
    add column if not exists device_browser text,
    add column if not exists ip_address inet;

create or replace function public.claim_my_access_device_with_details(
    p_device_id uuid,
    p_device_label text,
    p_device_browser text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    request_headers jsonb;
    forwarded_ip text;
    parsed_ip inet;
begin
    if auth.uid() is null then
        raise exception 'AUTH_REQUIRED';
    end if;

    perform public.claim_my_access_device(p_device_id, p_device_label);

    request_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
    forwarded_ip := nullif(trim(split_part(coalesce(request_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
    if forwarded_ip is not null then
        begin
            parsed_ip := forwarded_ip::inet;
        exception when others then
            parsed_ip := null;
        end;
    end if;

    update public.access_devices
    set device_browser = left(coalesce(nullif(trim(p_device_browser), ''), '未知浏览器'), 96),
        ip_address = coalesce(parsed_ip, ip_address),
        last_seen_at = now()
    where user_id = auth.uid()
      and device_id = p_device_id
      and revoked_at is null;
end;
$$;

create or replace function public.list_my_access_devices_with_details(p_current_device_id uuid)
returns table(
    device_id uuid,
    device_label text,
    device_browser text,
    ip_address inet,
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    is_current boolean
)
language sql
security definer
set search_path = public, auth
as $$
    select d.device_id,
           d.device_label,
           d.device_browser,
           d.ip_address,
           d.first_seen_at,
           d.last_seen_at,
           d.device_id = p_current_device_id
    from public.access_devices d
    where d.user_id = auth.uid()
      and d.revoked_at is null
    order by d.last_seen_at desc;
$$;

revoke all on function public.claim_my_access_device_with_details(uuid, text, text) from public;
revoke all on function public.list_my_access_devices_with_details(uuid) from public;
grant execute on function public.claim_my_access_device_with_details(uuid, text, text) to authenticated;
grant execute on function public.list_my_access_devices_with_details(uuid) to authenticated;
