import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon,authenticated;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant execute on function auth.uid() to public;
create schema storage; grant usage on schema storage to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
-- Deliberately unsafe pre-existing policy: the new bucket guards must still deny access.
create policy older_broad_policy on storage.objects for all to public using(true) with check(true);
`);
const sql=fs.readFileSync(new URL('../supabase/member-access.sql',import.meta.url),'utf8');
await db.exec(sql);
const ids={admin:'00000000-0000-0000-0000-000000000001',pending:'00000000-0000-0000-0000-000000000002',alice:'00000000-0000-0000-0000-000000000003',bob:'00000000-0000-0000-0000-000000000004',unverified:'00000000-0000-0000-0000-000000000005'};
for(const [name,id]of Object.entries(ids)) await db.query('insert into auth.users values($1,$2,$3,$4)',[id,name+'@example.test',name==='unverified'?null:new Date(),{role:'admin',status:'approved'}]);
assert.equal((await db.query('select count(*)::int n from memberships where role=\'member\' and status=\'pending\'')).rows[0].n,5);
await db.query("update memberships set status='approved' where user_id<>$1",[ids.pending]);
await db.query("update memberships set role='admin' where user_id=$1",[ids.admin]);
const paths={all:'10000000-0000-0000-0000-000000000001.pdf',alice:'10000000-0000-0000-0000-000000000002.pdf',hidden:'10000000-0000-0000-0000-000000000003.pdf',orphan:'10000000-0000-0000-0000-000000000004.pdf'};
for(const [label,path]of Object.entries(paths)) {
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['member-documents',path]);
 if(label!=='orphan') await db.query('insert into member_documents(title,object_path,original_name,media_type,size_bytes,all_members,published,created_by) values($1,$2,$1,\'application/pdf\',100,$3,$4,$5)',[label,path,label!=='alice',label!=='hidden',ids.admin]);
}
await db.query('insert into member_document_grants select id,$1 from member_documents where title=\'alice\'',[ids.alice]);
await db.query('insert into storage.objects(bucket_id,name) values(\'public-images\',\'logo.png\')');
async function as(role,id,fn) {
 await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']); await db.exec('set role '+role);
 try{return await fn();}finally{await db.exec('reset role');}
}
async function rows(role,id) {return as(role,id,async()=> (await db.query("select name from storage.objects where bucket_id='member-documents' order by name")).rows.map(r=>r.name));}
async function denied(role,id,query,params=[]) {
 return as(role,id,async()=>{let error;try{await db.query(query,params);}catch(e){error=e;}assert.equal(error?.code,'42501',query);});
}
assert.deepEqual(await rows('anon',null),[]);
assert.deepEqual(await rows('authenticated',ids.pending),[]);
assert.deepEqual(await rows('authenticated',ids.unverified),[]);
assert.deepEqual(await rows('authenticated',ids.alice),[paths.all,paths.alice]);
assert.deepEqual(await rows('authenticated',ids.bob),[paths.all]);
assert.equal((await rows('authenticated',ids.admin)).length,4);
await denied('authenticated',ids.pending,"update memberships set status='approved' where user_id=$1",[ids.pending]);
await denied('authenticated',ids.alice,"update memberships set role='admin' where user_id=$1",[ids.alice]);
await denied('authenticated',ids.pending,"select public.set_member_status($1,'approved')",[ids.pending]);
await denied('authenticated',ids.alice,"insert into member_document_grants select id,$1 from member_documents limit 1",[ids.bob]);
await denied('authenticated',ids.alice,"insert into storage.objects(bucket_id,name) values('member-documents','10000000-0000-0000-0000-000000000009.pdf')");
await as('authenticated',ids.alice,async()=>assert.equal((await db.query("delete from storage.objects where bucket_id='member-documents' returning id")).rows.length,0));
await as('authenticated',ids.alice,async()=>assert.equal((await db.query("update storage.objects set name='changed.pdf' where bucket_id='member-documents' returning id")).rows.length,0));
await as('authenticated',ids.alice,async()=>assert.equal((await db.query('select user_id from memberships')).rows.length,1));
await as('authenticated',ids.admin,()=>db.query("select public.set_member_status($1,'approved')",[ids.pending]));
assert.deepEqual(await rows('authenticated',ids.pending),[paths.all]);
await denied('authenticated',ids.admin,"select public.set_member_status($1,'blocked')",[ids.admin]);
await db.query("update memberships set status='blocked' where user_id=$1",[ids.alice]);
assert.deepEqual(await rows('authenticated',ids.alice),[]);
await db.query("update member_documents set published=false where title='all'");
assert.deepEqual(await rows('authenticated',ids.bob),[]);
await as('anon',null,async()=>assert.equal((await db.query("select name from storage.objects where bucket_id='public-images'")).rows.length,1));
assert.equal((await db.query("select public from storage.buckets where id='member-documents'")).rows[0].public,false);
await db.exec(sql); // Re-running the setup must retain approvals and keep the bucket private.
assert.equal((await db.query('select status from memberships where user_id=$1',[ids.alice])).rows[0].status,'blocked');
const grantedDocId=(await db.query("select id from member_documents where title='alice'")).rows[0].id;
await as('authenticated',ids.bob,async()=>assert.equal((await db.query('delete from member_documents where id=$1 returning id',[grantedDocId])).rows.length,0));
await as('authenticated',ids.admin,async()=>{
 assert.equal((await db.query('update member_documents set published=false where id=$1 returning id',[grantedDocId])).rows.length,1);
 assert.equal((await db.query('delete from storage.objects where bucket_id=\'member-documents\' and name=$1 returning id',[paths.alice])).rows.length,1);
 assert.equal((await db.query('delete from member_documents where id=$1 returning id',[grantedDocId])).rows.length,1);
});
assert.equal((await db.query('select count(*)::int n from member_document_grants where document_id=$1',[grantedDocId])).rows[0].n,0);
await db.close();
console.log('PASS: anonymous, pending and unverified reads; grants; self-escalation; uploads; revocation; broad policies; idempotence; admin-only deletion and grant cleanup.');
