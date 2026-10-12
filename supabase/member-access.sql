-- CSDIC: email-verified membership, admin approval and private document authorization.
-- Run in the intended Supabase project's SQL Editor, as the project database owner.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.member_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 2000),
  object_path text unique not null check (object_path ~ '^[a-f0-9-]{36}\.(pdf|docx|xlsx|pptx|txt|zip)$'),
  original_name text not null,
  media_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  all_members boolean not null default true,
  published boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.member_document_grants (
  document_id uuid not null references public.member_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (document_id,user_id)
);
create index if not exists member_documents_created_by_idx on public.member_documents(created_by);
create index if not exists member_document_grants_user_id_idx on public.member_document_grants(user_id);
alter table public.memberships enable row level security;
alter table public.member_documents enable row level security;
alter table public.member_document_grants enable row level security;

create or replace function private.is_approved_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id
    where m.user_id=auth.uid() and m.status='approved' and u.email_confirmed_at is not null);
$$;
create or replace function private.is_member_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id
    where m.user_id=auth.uid() and m.status='approved' and m.role='admin' and u.email_confirmed_at is not null);
$$;
create or replace function private.can_read_member_document(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member_admin() or (private.is_approved_member() and exists(
    select 1 from public.member_documents d where d.object_path=object_name and d.published
      and (d.all_members or exists(select 1 from public.member_document_grants g
        where g.document_id=d.id and g.user_id=auth.uid()))));
$$;
revoke all on function private.is_approved_member() from public, anon;
revoke all on function private.is_member_admin() from public, anon;
revoke all on function private.can_read_member_document(text) from public, anon;
-- Anonymous callers get false; this also supports bucket guards against older broad policies.
grant execute on function private.is_approved_member(),private.is_member_admin(),private.can_read_member_document(text) to authenticated, anon;

create or replace function private.bootstrap_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Never copy role/approval claims from user-controlled signup metadata.
  insert into public.memberships(user_id,email) values(new.id,coalesce(new.email,''))
    on conflict(user_id) do update set email=excluded.email;
  return new;
end;
$$;
revoke all on function private.bootstrap_member() from public, anon, authenticated;
drop trigger if exists csdic_bootstrap_member on auth.users;
create trigger csdic_bootstrap_member after insert or update of email on auth.users
  for each row execute function private.bootstrap_member();
insert into public.memberships(user_id,email)
  select id,coalesce(email,'') from auth.users on conflict(user_id) do nothing;

-- Members cannot directly update status or role, even for their own account.
revoke all on public.memberships from public, anon, authenticated;
grant select on public.memberships to authenticated;
drop policy if exists csdic_read_membership on public.memberships;
create policy csdic_read_membership on public.memberships for select to authenticated
  using (user_id=(select auth.uid()) or (select private.is_member_admin()));

create or replace function private.set_member_status(target_user uuid,new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member_admin() then raise exception 'not authorized' using errcode='42501'; end if;
  if new_status not in ('pending','approved','blocked') then raise exception 'invalid status'; end if;
  -- Admin-role assignment is deliberately not exposed through this RPC.
  if exists(select 1 from public.memberships where user_id=target_user and role='admin') then
    raise exception 'administrator accounts require owner management' using errcode='42501';
  end if;
  update public.memberships set status=new_status where user_id=target_user;
  if not found then raise exception 'member not found'; end if;
end;
$$;
revoke all on function private.set_member_status(uuid,text) from public, anon;
grant execute on function private.set_member_status(uuid,text) to authenticated;
-- The exposed RPC delegates to a private helper that checks the caller's live admin status.
create or replace function public.set_member_status(target_user uuid,new_status text) returns void
language sql security invoker set search_path = '' as $$
  select private.set_member_status(target_user,new_status);
$$;
revoke all on function public.set_member_status(uuid,text) from public, anon;
grant execute on function public.set_member_status(uuid,text) to authenticated;
-- Supabase's automatic RLS event trigger is internal and must not be a public RPC.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

revoke all on public.member_documents,public.member_document_grants from public, anon, authenticated;
grant select,insert,update,delete on public.member_documents,public.member_document_grants to authenticated;
drop policy if exists csdic_document_read on public.member_documents;
create policy csdic_document_read on public.member_documents for select to authenticated
  using (private.can_read_member_document(object_path));
drop policy if exists csdic_document_insert on public.member_documents;
create policy csdic_document_insert on public.member_documents for insert to authenticated
  with check ((select private.is_member_admin()) and created_by=(select auth.uid()));
drop policy if exists csdic_document_update on public.member_documents;
create policy csdic_document_update on public.member_documents for update to authenticated
  using ((select private.is_member_admin())) with check ((select private.is_member_admin()));
drop policy if exists csdic_document_delete on public.member_documents;
create policy csdic_document_delete on public.member_documents for delete to authenticated
  using ((select private.is_member_admin()));
drop policy if exists csdic_grants_read on public.member_document_grants;
create policy csdic_grants_read on public.member_document_grants for select to authenticated
  using ((select private.is_member_admin()) or (user_id=(select auth.uid()) and (select private.is_approved_member())));
drop policy if exists csdic_grants_write on public.member_document_grants;
drop policy if exists csdic_grants_insert on public.member_document_grants;
create policy csdic_grants_insert on public.member_document_grants for insert to authenticated
  with check ((select private.is_member_admin()));
drop policy if exists csdic_grants_update on public.member_document_grants;
create policy csdic_grants_update on public.member_document_grants for update to authenticated
  using ((select private.is_member_admin())) with check ((select private.is_member_admin()));
drop policy if exists csdic_grants_delete on public.member_document_grants;
create policy csdic_grants_delete on public.member_document_grants for delete to authenticated
  using ((select private.is_member_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('member-documents','member-documents',false,20971520,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','application/zip'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists csdic_private_file_read on storage.objects;
create policy csdic_private_file_read on storage.objects for select to authenticated
  using (bucket_id='member-documents' and private.can_read_member_document(name));
drop policy if exists csdic_private_file_insert on storage.objects;
create policy csdic_private_file_insert on storage.objects for insert to authenticated
  with check (bucket_id='member-documents' and (select private.is_member_admin()) and name ~ '^[a-f0-9-]{36}\.(pdf|docx|xlsx|pptx|txt|zip)$');
drop policy if exists csdic_private_file_delete on storage.objects;
create policy csdic_private_file_delete on storage.objects for delete to authenticated
  using (bucket_id='member-documents' and (select private.is_member_admin()));
-- Restrictive guards prevent any pre-existing permissive storage policy from bypassing this bucket.
drop policy if exists csdic_bucket_guard_read on storage.objects;
create policy csdic_bucket_guard_read on storage.objects as restrictive for select to public
  using (case when bucket_id='member-documents' then private.can_read_member_document(name) else true end);
drop policy if exists csdic_bucket_guard_insert on storage.objects;
create policy csdic_bucket_guard_insert on storage.objects as restrictive for insert to public
  with check (case when bucket_id='member-documents' then (select private.is_member_admin())
    and name ~ '^[a-f0-9-]{36}\.(pdf|docx|xlsx|pptx|txt|zip)$' else true end);
drop policy if exists csdic_bucket_guard_update on storage.objects;
create policy csdic_bucket_guard_update on storage.objects as restrictive for update to public
  using (case when bucket_id='member-documents' then (select private.is_member_admin()) else true end)
  with check (case when bucket_id='member-documents' then (select private.is_member_admin()) else true end);
drop policy if exists csdic_bucket_guard_delete on storage.objects;
create policy csdic_bucket_guard_delete on storage.objects as restrictive for delete to public
  using (case when bucket_id='member-documents' then (select private.is_member_admin()) else true end);
commit;
