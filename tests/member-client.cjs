const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname,'../member-client.js'),'utf8');
const legacy = role => 'e30.' + Buffer.from(JSON.stringify({role})).toString('base64url') + '.signature';
function run(config, storageAvailable=true) {
  let calls=0, options;
  const window={CSDIC_MEMBER_CONFIG:config,supabase:{createClient:(url,key,opts)=>{calls++; options=opts;return {};}}};
  Object.defineProperty(window,'sessionStorage',{get(){if(!storageAvailable) throw new Error('blocked storage');return {};}});
  vm.runInNewContext(source,{window,atob:s=>Buffer.from(s,'base64').toString('utf8')});
  return {calls,options,configured:window.CSDICMemberClient.configured};
}
const url='https://test-project.supabase.co';
assert.equal(run({}).calls,0);
assert.equal(run({supabaseUrl:url,publishableKey:'sb_secret_not-public'}).calls,0);
assert.equal(run({supabaseUrl:url,publishableKey:legacy('service_role')}).calls,0);
assert.equal(run({supabaseUrl:'http://test-project.supabase.co',publishableKey:'sb_publishable_demo'}).calls,0);
assert.equal(run({supabaseUrl:'https://attacker.example',publishableKey:'sb_publishable_demo'}).calls,0);
const valid=run({supabaseUrl:url,publishableKey:'sb_publishable_demo'});
assert.equal(valid.configured,true);
assert.equal(valid.options.auth.detectSessionInUrl,false);
assert.equal(valid.options.auth.flowType,'implicit');
assert.equal(run({supabaseUrl:url,publishableKey:legacy('anon')}).configured,true);
assert.equal(run({supabaseUrl:url,publishableKey:'sb_publishable_demo'},false).configured,false);
console.log('PASS: missing configuration, secret keys, service-role keys, unsafe origins and unavailable storage fail closed.');
