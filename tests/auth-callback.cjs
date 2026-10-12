const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../auth-callback.js'), 'utf8');

async function run(search, hash, verified = true) {
  const calls = [], status = {textContent: ''}, form = {hidden: true, addEventListener() {}};
  const user = {email: 'member@example.test', email_confirmed_at: '2026-10-12T00:00:00Z'};
  const auth = {
    verifyOtp: async input => {calls.push(['verify', input.type]); return {data: {user}};},
    setSession: async () => {calls.push(['session']); return {data: {user}};},
    getUser: async () => {calls.push(['server-user']); return verified ? {data: {user}} : {data: {user: null}, error: {}};},
    signOut: async () => {calls.push(['signout']);}
  };
  vm.runInNewContext(source, {
    window: {CSDICMemberClient: {client: {auth}}},
    location: {search, hash, pathname: '/auth.html'},
    history: {replaceState: (_, __, url) => {calls.push(['clear-url', url]);}},
    document: {getElementById: id => id === 'callbackStatus' ? status : form},
    URLSearchParams
  });
  await new Promise(resolve => setImmediate(resolve));
  return {calls, status: status.textContent, recoveryVisible: !form.hidden};
}

(async () => {
  const signup = await run('', '#access_token=test-access&refresh_token=test-refresh&type=signup');
  assert.deepEqual(signup.calls.map(c => c[0]), ['clear-url', 'session', 'server-user']);
  assert.equal(signup.calls[0][1], '/auth.html');
  assert.match(signup.status, /이메일 인증이 완료/);
  assert.equal(signup.recoveryVisible, false);
  const recovery = await run('', '#access_token=test-access&refresh_token=test-refresh&type=recovery');
  assert.equal(recovery.recoveryVisible, true);
  assert.match(recovery.status, /member@example.test/);
  const hashLink = await run('?token_hash=test-hash&type=email', '');
  assert.deepEqual(hashLink.calls.map(c => c[0]), ['clear-url', 'verify', 'server-user']);
  const rejected = await run('', '#access_token=test-access&refresh_token=test-refresh&type=recovery', false);
  assert.equal(rejected.recoveryVisible, false);
  assert.equal(rejected.calls.at(-1)[0], 'signout');
  const malformed = await run('', '#access_token=test-access&type=recovery');
  assert.deepEqual(malformed.calls.map(c => c[0]), ['clear-url']);
  assert.equal(malformed.recoveryVisible, false);
  const wrongType = await run('', '#access_token=test-access&refresh_token=test-refresh&type=other');
  assert.deepEqual(wrongType.calls.map(c => c[0]), ['clear-url']);
  console.log('PASS: callback tokens removed before Auth calls; default and custom mail links; recovery identity; server verification and incomplete links fail closed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
