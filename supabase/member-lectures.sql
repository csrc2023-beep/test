-- Requires the existing CSDIC membership schema from member-access.sql.
begin;

create table if not exists public.member_lectures (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  watch_url text not null check (
    char_length(watch_url) <= 2000
    and watch_url ~* '^https://[a-z0-9][a-z0-9-]*\.sharepoint\.com/(:v:/|[^?#]*_layouts/15/stream\.aspx\?)'
    and watch_url !~ '[[:space:][:cntrl:]]'
    and position(chr(92) in watch_url)=0
    and watch_url !~* '[?&]download=(1|true)(&|#|$)'
  ),
  thumbnail_path text unique check (thumbnail_path ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$'),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.member_lectures enable row level security;
revoke all on public.member_lectures from public, anon, authenticated;
grant select,insert,update on public.member_lectures to authenticated;
create index if not exists member_lectures_visible_created_idx on public.member_lectures(created_at desc) where published;

drop policy if exists csdic_lecture_read on public.member_lectures;
create policy csdic_lecture_read on public.member_lectures for select to authenticated
  using ((select private.is_member_admin()) or (published and (select private.is_approved_member())));
drop policy if exists csdic_lecture_insert on public.member_lectures;
create policy csdic_lecture_insert on public.member_lectures for insert to authenticated
  with check ((select private.is_member_admin()));
drop policy if exists csdic_lecture_update on public.member_lectures;
create policy csdic_lecture_update on public.member_lectures for update to authenticated
  using ((select private.is_member_admin())) with check ((select private.is_member_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('member-lecture-thumbnails','member-lecture-thumbnails',false,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- A private helper lets restrictive policies check one bucket even for anon callers
-- without granting anon SELECT on the lecture catalog.
create or replace function private.can_read_lecture_thumbnail(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member_admin() or (private.is_approved_member() and exists(
    select 1 from public.member_lectures where thumbnail_path=object_name and published));
$$;
revoke all on function private.can_read_lecture_thumbnail(text) from public, anon, authenticated;
grant execute on function private.can_read_lecture_thumbnail(text) to anon, authenticated;

drop policy if exists csdic_lecture_thumb_read on storage.objects;
create policy csdic_lecture_thumb_read on storage.objects for select to authenticated
  using (bucket_id='member-lecture-thumbnails' and private.can_read_lecture_thumbnail(name));
drop policy if exists csdic_lecture_thumb_insert on storage.objects;
create policy csdic_lecture_thumb_insert on storage.objects for insert to authenticated
  with check (bucket_id='member-lecture-thumbnails' and (select private.is_member_admin()) and name ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$');
drop policy if exists csdic_lecture_thumb_delete on storage.objects;
create policy csdic_lecture_thumb_delete on storage.objects for delete to authenticated
  using (bucket_id='member-lecture-thumbnails' and (select private.is_member_admin()));

drop policy if exists csdic_lecture_thumb_guard_read on storage.objects;
create policy csdic_lecture_thumb_guard_read on storage.objects as restrictive for select to public
  using (case when bucket_id='member-lecture-thumbnails' then private.can_read_lecture_thumbnail(name) else true end);
drop policy if exists csdic_lecture_thumb_guard_insert on storage.objects;
create policy csdic_lecture_thumb_guard_insert on storage.objects as restrictive for insert to public
  with check (case when bucket_id='member-lecture-thumbnails' then (select private.is_member_admin()) and name ~ '^[a-f0-9-]{36}\.(jpg|png|webp)$' else true end);
drop policy if exists csdic_lecture_thumb_guard_update on storage.objects;
create policy csdic_lecture_thumb_guard_update on storage.objects as restrictive for update to public
  using (bucket_id<>'member-lecture-thumbnails') with check (bucket_id<>'member-lecture-thumbnails');
drop policy if exists csdic_lecture_thumb_guard_delete on storage.objects;
create policy csdic_lecture_thumb_guard_delete on storage.objects as restrictive for delete to public
  using (case when bucket_id='member-lecture-thumbnails' then (select private.is_member_admin()) else true end);

commit;
