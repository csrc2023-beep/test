import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon,authenticated;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create schema storage; grant usage on schema storage to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
create policy older_broad_policy on storage.objects for all to public using(true) with check(true);
`);
const sql = name => fs.readFileSync(new URL('../supabase/' + name + '.sql',import.meta.url),'utf8');
await db.exec(sql('member-access'));
await db.exec(sql('member-lectures'));
const ids = {admin:'10000000-0000-0000-0000-000000000001', pending:'10000000-0000-0000-0000-000000000002',
  viewer:'10000000-0000-0000-0000-000000000003', unverified:'10000000-0000-0000-0000-000000000004'};
for (const [name,id] of Object.entries(ids)) await db.query('insert into auth.users values($1,$2,$3)',[id,name+'@example.test',name==='unverified'?null:new Date()]);
await db.query("update memberships set status='approved' where user_id<>$1",[ids.pending]);
await db.query("update memberships set role='admin' where user_id=$1",[ids.admin]);

const files = {shown:'20000000-0000-0000-0000-000000000001.png', hidden:'20000000-0000-0000-0000-000000000002.webp', orphan:'20000000-0000-0000-0000-000000000003.jpg'};
const href = 'https://example-my.sharepoint.com/:v:/g/personal/instructor/abc?e=example';
const bucket = 'member-lecture-thumbnails';
for (const name of Object.values(files)) await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,name]);
await db.query('insert into member_lectures(title,watch_url,thumbnail_path,published) values($1,$2,$3,true),($4,$2,$5,false)',['공개 강의',href,files.shown,'숨긴 강의',files.hidden]);
await db.query("insert into storage.objects(bucket_id,name) values('public-images','logo.png')");

async function as(role,id,fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
  await db.exec('set role '+role);
  try {return await fn();} finally {await db.exec('reset role');}
}
async function catalog(role,id) {return as(role,id,async()=> (await db.query('select watch_url from member_lectures')).rows.map(r=>r.watch_url));}
async function thumbnails(role,id) {return as(role,id,async()=> (await db.query('select name from storage.objects where bucket_id=$1 order by name',[bucket])).rows.map(r=>r.name));}
await assert.rejects(catalog('anon',null), {code:'42501'});
for (const key of ['pending','unverified']) {
  assert.deepEqual(await catalog('authenticated',ids[key]), []);
  assert.deepEqual(await thumbnails('authenticated',ids[key]), []);
}
assert.deepEqual(await thumbnails('anon',null), []);
assert.deepEqual(await catalog('authenticated',ids.viewer), [href]);
assert.deepEqual(await thumbnails('authenticated',ids.viewer), [files.shown]);
assert.equal((await thumbnails('authenticated',ids.admin)).length, 3);
await assert.rejects(as('authenticated',ids.viewer,()=>db.query('insert into member_lectures(title,watch_url) values($1,$2)',['제목',href])), {code:'42501'});
await assert.rejects(as('authenticated',ids.viewer,()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,'20000000-0000-0000-0000-000000000004.png'])), {code:'42501'});
assert.equal((await as('authenticated',ids.viewer,()=>db.query('update member_lectures set published=false returning id'))).rows.length,0);
for (const bad of ['https://sharepoint.com.attacker.test/:v:/g/test','https://example.sharepoint.com/:v:/g/test?download=1','javascript:alert(1)']) {
  await assert.rejects(as('authenticated',ids.admin,()=>db.query('insert into member_lectures(title,watch_url) values($1,$2)',['제목',bad])), {code:'23514'});
}
await as('authenticated',ids.admin,()=>db.query('update member_lectures set published=false'));
assert.deepEqual(await catalog('authenticated',ids.viewer), []);
assert.deepEqual(await thumbnails('authenticated',ids.viewer), []);
await db.query('update member_lectures set published=true');
await db.query("update memberships set status='blocked' where user_id=$1",[ids.viewer]);
assert.deepEqual(await catalog('authenticated',ids.viewer), []);
assert.deepEqual(await thumbnails('authenticated',ids.viewer), []);
assert.equal((await as('anon',null,()=>db.query("select name from storage.objects where bucket_id='public-images'"))).rows.length, 1);
await db.exec(sql('member-lectures'));
assert.equal((await db.query('select public from storage.buckets where id=$1',[bucket])).rows[0].public,false);
await db.close();
console.log('PASS: protected OneDrive catalog and thumbnails; guest, pending, unverified, revoked and legacy-policy isolation; admin-only writes and URL constraints.');
