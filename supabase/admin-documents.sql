-- ============================================================================
-- admin_documents() — saare users ke documents ek jagah (admin "Documents" tab).
--
-- Kisne (email/naam), kaun sa document, kab (created_at), kitna size, storage
-- path, aur file storage me hai ya nahi. Sirf service_role (admin) ke liye.
--
-- Supabase SQL Editor me Run karo. Prereq: schema.sql + storage.sql + profiles.sql.
-- ============================================================================

create or replace function public.admin_documents(
  p_from  timestamptz default null,
  p_to    timestamptz default null,
  p_limit int default 500
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb; cnt bigint;
begin
  select count(*) into cnt
  from public.documents d
  where (p_from is null or d.created_at >= p_from)
    and (p_to is null or d.created_at < p_to);

  select jsonb_build_object(
    'total', cnt,
    'rows', coalesce((
      select jsonb_agg(row_to_json(x))
      from (
        select
          d.id,
          d.name,
          d.type,
          d.expiry,
          d.summary,
          d.file_size,
          d.file_path,
          d.mime_type,
          (d.file_path is not null) as in_storage,
          d.created_at,
          d.user_id,
          p.email     as user_email,
          p.full_name as user_name
        from public.documents d
        left join public.profiles p on p.id = d.user_id
        where (p_from is null or d.created_at >= p_from)
          and (p_to is null or d.created_at < p_to)
        order by d.created_at desc
        limit least(greatest(p_limit, 1), 2000)
      ) x
    ), '[]'::jsonb)
  ) into res;

  return res;
end;
$$;

-- Security: koi bhi logged-in user ye call na kar sake (poore users ka data hai).
revoke all on function public.admin_documents(timestamptz, timestamptz, int) from public;
revoke all on function public.admin_documents(timestamptz, timestamptz, int) from anon;
revoke all on function public.admin_documents(timestamptz, timestamptz, int) from authenticated;
