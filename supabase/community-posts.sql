-- Public community boards. Drafts and unlinked/retired assets remain private.
begin;
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('news','press','recruit','gallery')),
  title text not null check (length(trim(title)) between 1 and 160),
  content text not null default '' check (length(content)<=30000),
  author text not null default '관리자' check (length(trim(author)) between 1 and 40),
  post_date date not null default (now() at time zone 'Asia/Seoul')::date,
  pinned boolean not null default false,
  published boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.community_assets (
  id uuid primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  kind text not null check(kind in ('image','file')),
  object_path text unique not null check(object_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|docx|xlsx|pptx|txt|zip)$'),
  original_name text not null check(length(original_name) between 1 and 240),
  media_type text not null,
  size_bytes bigint not null check(size_bytes between 1 and 20971520),
  caption text not null default '' check(length(caption)<=200),
  sort_order integer not null default 0 check(sort_order between 0 and 16),
  retired boolean not null default false,
  created_at timestamptz not null default now(),
  check(split_part(object_path,'/',1)=post_id::text),
  check ((kind='image' and media_type in ('image/jpeg','image/png','image/webp') and size_bytes<=5242880 and object_path ~ '\.(jpg|jpeg|png|webp)$')
    or (kind='file' and media_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','application/zip') and object_path ~ '\.(pdf|docx|xlsx|pptx|txt|zip)$'))
);
create index community_posts_board_date_idx on public.community_posts(board,published,pinned desc,post_date desc,created_at desc);
create index community_posts_creator_idx on public.community_posts(created_by);
create index community_assets_post_id_idx on public.community_assets(post_id);
alter table public.community_posts enable row level security;
alter table public.community_assets enable row level security;
revoke all on public.community_posts,public.community_assets from public,anon,authenticated;
grant select on public.community_posts,public.community_assets to anon,authenticated;
grant insert(id,board,title,content,author,post_date,pinned,published) on public.community_posts to authenticated;
grant update(title,content,author,post_date,pinned,published) on public.community_posts to authenticated;
grant delete on public.community_posts to authenticated;
grant insert,delete on public.community_assets to authenticated;
grant update(caption,sort_order,retired) on public.community_assets to authenticated;
create policy csdic_posts_read on public.community_posts for select to anon,authenticated
  using(published or (select private.is_member_admin()));
create policy csdic_posts_insert on public.community_posts for insert to authenticated
  with check((select private.is_member_admin()) and created_by=(select auth.uid()));
create policy csdic_posts_update on public.community_posts for update to authenticated
  using((select private.is_member_admin())) with check((select private.is_member_admin()));
create policy csdic_posts_delete on public.community_posts for delete to authenticated
  using((select private.is_member_admin()));
create policy csdic_assets_read on public.community_assets for select to anon,authenticated
  using((select private.is_member_admin()) or (not retired and exists(select 1 from public.community_posts p where p.id=post_id and p.published)));
create policy csdic_assets_insert on public.community_assets for insert to authenticated
  with check((select private.is_member_admin()));
create policy csdic_assets_update on public.community_assets for update to authenticated
  using((select private.is_member_admin())) with check((select private.is_member_admin()));
create policy csdic_assets_delete on public.community_assets for delete to authenticated
  using((select private.is_member_admin()));
create function private.touch_community_post() returns trigger
language plpgsql security invoker set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
revoke all on function private.touch_community_post() from public,anon,authenticated;
create trigger csdic_community_updated before update on public.community_posts
  for each row execute function private.touch_community_post();

create function private.can_read_community_asset(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_member_admin() or exists(select 1 from public.community_assets a join public.community_posts p on p.id=a.post_id
   where a.object_path=object_name and not a.retired and p.published);
$$;
revoke all on function private.can_read_community_asset(text) from public;
grant execute on function private.can_read_community_asset(text) to anon,authenticated;

-- This invoker RPC saves the text and image/file manifest together, under the same RLS policies.
create function public.save_community_post(p_post_id uuid,p_board text,p_title text,p_content text,p_author text,
  p_post_date date,p_pinned boolean,p_published boolean,p_assets jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare a record; image_count integer; file_count integer;
begin
 if not private.is_member_admin() then raise exception 'not authorized' using errcode='42501'; end if;
 if p_assets is null or jsonb_typeof(p_assets)<>'array' or jsonb_array_length(p_assets)>17 then raise exception 'invalid attachments'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_assets))<>jsonb_array_length(p_assets) then raise exception 'duplicate attachments'; end if;
 perform 1 from public.community_posts where id=p_post_id and board=p_board for update;
 if not found then raise exception 'post not found' using errcode='42501'; end if;
 update public.community_assets set retired=true where post_id=p_post_id;
 for a in select * from jsonb_to_recordset(p_assets) as x(id uuid,kind text,object_path text,original_name text,media_type text,size_bytes bigint,caption text,sort_order integer) loop
   if not exists(select 1 from storage.objects where bucket_id='community-assets' and name=a.object_path) then raise exception 'file not found'; end if;
   insert into public.community_assets(id,post_id,kind,object_path,original_name,media_type,size_bytes,caption,sort_order,retired)
     values(a.id,p_post_id,a.kind,a.object_path,a.original_name,a.media_type,a.size_bytes,coalesce(a.caption,''),a.sort_order,false)
     on conflict(id) do update set caption=excluded.caption,sort_order=excluded.sort_order,retired=false
     where community_assets.post_id=p_post_id and community_assets.object_path=excluded.object_path and community_assets.kind=excluded.kind;
   if not found then raise exception 'invalid attachment identity'; end if;
 end loop;
 select count(*) filter(where kind='image'),count(*) filter(where kind='file') into image_count,file_count
   from public.community_assets where post_id=p_post_id and not retired;
 if image_count>12 or file_count>5 then raise exception 'too many attachments'; end if;
 if p_published and p_board='gallery' and image_count=0 then raise exception 'gallery needs a photo'; end if;
 if p_published and length(trim(p_content))=0 and image_count+file_count=0 then raise exception 'post needs content'; end if;
 update public.community_posts set title=p_title,content=p_content,author=p_author,post_date=p_post_date,pinned=p_pinned,published=p_published where id=p_post_id;
 return p_post_id;
end $$;
revoke all on function public.save_community_post(uuid,text,text,text,text,date,boolean,boolean,jsonb) from public,anon;
grant execute on function public.save_community_post(uuid,text,text,text,text,date,boolean,boolean,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-assets','community-assets',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','application/zip']);
create policy csdic_community_file_read on storage.objects for select to anon,authenticated
  using(bucket_id='community-assets' and private.can_read_community_asset(name));
create policy csdic_community_file_insert on storage.objects for insert to authenticated
  with check(bucket_id='community-assets' and (select private.is_member_admin()) and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|docx|xlsx|pptx|txt|zip)$'
    and exists(select 1 from public.community_posts p where p.id::text=split_part(name,'/',1)));
create policy csdic_community_file_delete on storage.objects for delete to authenticated
  using(bucket_id='community-assets' and (select private.is_member_admin()));
create policy csdic_community_guard_read on storage.objects as restrictive for select to public
  using(case when bucket_id='community-assets' then private.can_read_community_asset(name) else true end);
create policy csdic_community_guard_insert on storage.objects as restrictive for insert to public
  with check(case when bucket_id='community-assets' then (select private.is_member_admin()) and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf|docx|xlsx|pptx|txt|zip)$'
    and exists(select 1 from public.community_posts p where p.id::text=split_part(name,'/',1)) else true end);
create policy csdic_community_guard_update on storage.objects as restrictive for update to public
  using(case when bucket_id='community-assets' then false else true end) with check(case when bucket_id='community-assets' then false else true end);
create policy csdic_community_guard_delete on storage.objects as restrictive for delete to public
  using(case when bucket_id='community-assets' then (select private.is_member_admin()) else true end);
commit;
