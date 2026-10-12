import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon nologin;create role authenticated nologin;
create schema auth;grant usage on schema auth to anon,authenticated;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant execute on function auth.uid() to public;
create schema storage;grant usage on schema storage to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
create policy legacy_broad on storage.objects for all to public using(true) with check(true);`);
await db.exec(fs.readFileSync(new URL('../supabase/member-access.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/community-posts.sql',import.meta.url),'utf8'));
const admin='00000000-0000-0000-0000-000000000001', member='00000000-0000-0000-0000-000000000002', pending='00000000-0000-0000-0000-000000000003';
for(const [id,email]of [[admin,'admin'],[member,'member'],[pending,'pending']])await db.query('insert into auth.users values($1,$2,$3,$4)',[id,email+'@test.dev',new Date(),{role:'admin'}]);
await db.query("update memberships set role='admin',status='approved' where user_id=$1",[admin]);
await db.query("update memberships set status='approved' where user_id=$1",[member]);
async function as(role,id,fn){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);try{return await fn();}finally{await db.exec('reset role');}}
async function rejects(role,id,sql,params=[]){await as(role,id,async()=>{let failure;try{await db.query(sql,params)}catch(e){failure=e}assert.ok(failure,sql);});}
const post='10000000-0000-0000-0000-000000000001',asset='20000000-0000-0000-0000-000000000001',path=post+'/'+asset+'.png';
await as('authenticated',admin,()=>db.query('insert into community_posts(id,board,title,content,author,post_date) values($1,\'gallery\',\'Test\',\'A\',\'관리자\',\'2026-10-12\')',[post]));
await as('authenticated',admin,()=>db.query("insert into storage.objects(bucket_id,name) values('community-assets',$1)",[path]));
await as('authenticated',admin,()=>db.query('insert into community_assets(id,post_id,kind,object_path,original_name,media_type,size_bytes) values($1,$2,\'image\',$3,\'test.png\',\'image/png\',100)',[asset,post,path]));
for(const [role,id]of [['anon',null],['authenticated',member],['authenticated',pending]]){
  await as(role,id,async()=>{assert.equal((await db.query('select id from community_posts')).rows.length,0);assert.equal((await db.query('select id from community_assets')).rows.length,0);assert.equal((await db.query("select id from storage.objects where bucket_id='community-assets'")).rows.length,0);});
  await rejects(role,id,"insert into community_posts(board,title) values('news','Unwanted')");
}
await rejects('authenticated',member,'select save_community_post($1,\'gallery\',\'Test\',\'A\',\'관리자\',\'2026-10-12\',false,true,$2::jsonb)',[post,JSON.stringify([{id:asset,kind:'image',object_path:path,original_name:'test.png',media_type:'image/png',size_bytes:100,sort_order:0}])]);
const manifest=JSON.stringify([{id:asset,kind:'image',object_path:path,original_name:'test.png',media_type:'image/png',size_bytes:100,sort_order:0}]);
await rejects('authenticated',admin,'select save_community_post($1,\'gallery\',\'Test\',\'A\',\'관리자\',\'2026-10-12\',false,true,\'[]\'::jsonb)',[post]);
await as('authenticated',admin,()=>db.query('select save_community_post($1,\'gallery\',\'Test\',\'A\',\'관리자\',\'2026-10-12\',false,true,$2::jsonb)',[post,manifest]));
for(const [role,id]of [['anon',null],['authenticated',member]])await as(role,id,async()=>{assert.equal((await db.query('select id from community_posts')).rows.length,1);assert.equal((await db.query('select id from community_assets')).rows.length,1);assert.equal((await db.query("select name from storage.objects where bucket_id='community-assets'")).rows.length,1);});
await as('authenticated',member,async()=>assert.equal((await db.query("update community_posts set published=false where id=$1 returning id",[post])).rows.length,0));
await as('authenticated',admin,()=>db.query('update community_posts set published=false where id=$1',[post]));
await as('anon',null,async()=>{assert.equal((await db.query('select id from community_posts')).rows.length,0);assert.equal((await db.query("select name from storage.objects where bucket_id='community-assets'")).rows.length,0);});
await db.close();console.log('PASS: community boards, draft and media isolation, role checks, atomic gallery publish and withdrawal.');
