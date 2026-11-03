const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../home-announcement.js'), 'utf8');
const key = 'csdic.popup.beyond-silicon-2026.hiddenDay';
const day = value => String(Math.floor((Date.parse(value) + 9*3600000) / 86400000));
function fixture({now='2026-11-03T14:59:59Z', hidden=false, stored, blocked=false, complete=true, width=1166, expires='2026-11-21T00:00:00+09:00', supported=true}={}) {
  const events={}, classes=new Set(), storage=new Map(stored ? [[key,stored]] : []);
  const button=()=>({addEventListener(name, fn) { this[name]=fn; }});
  const close=button(), dismiss=button();
  const dialog={dataset:{expiresAt:expires},open:false,count:0,events:{},
    querySelectorAll:()=>[close], addEventListener(name,fn) {this.events[name]=fn;},
    close() {this.open=false;this.events.close();}
  };
  if(supported) dialog.showModal=function() {this.open=true;this.count++;};
  const poster={complete,naturalWidth:width,addEventListener(name,fn) {this[name]=fn;}};
  const home={hidden};
  vm.runInNewContext(source,{
    document:{getElementById:id=>({homeAnnouncement:dialog,announcementPoster:poster,homePage:home,announcementDismiss:dismiss}[id]),body:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}}},
    localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return storage.get(k)??null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');storage.set(k,v);}},
    Date:{now:()=>Date.parse(now),parse:Date.parse},Number,Math,String,addEventListener:(name,fn)=>events[name]=fn
  });
  return {dialog,poster,home,storage,classes,close,dismiss,hash:()=>events.hashchange()};
}
const normal=fixture(); assert.equal(normal.dialog.open,true); assert(normal.classes.has('announcement-open'));
normal.close.click(); assert.equal(normal.dialog.open,false); assert.equal(normal.classes.size,0);
normal.hash(); assert.equal(normal.dialog.count,1,'ordinary dismissal must survive internal navigation');
assert.equal(fixture().dialog.open,true,'ordinary dismissal must not suppress a later page load');
const hidden=fixture({hidden:true}); assert.equal(hidden.dialog.open,false);
hidden.home.hidden=false; hidden.hash(); assert.equal(hidden.dialog.open,true);
hidden.home.hidden=true; hidden.hash(); assert.equal(hidden.dialog.open,false);
const snoozed=fixture(); snoozed.dismiss.click(); assert.equal(snoozed.storage.get(key),day('2026-11-03T14:59:59Z'));
assert.equal(fixture({stored:snoozed.storage.get(key)}).dialog.open,false);
assert.equal(fixture({now:'2026-11-03T15:00:00Z',stored:snoozed.storage.get(key)}).dialog.open,true,'dismissal resets at midnight in Korea');
assert.equal(fixture({now:'2026-11-20T14:59:59Z'}).dialog.open,true);
assert.equal(fixture({now:'2026-11-20T15:00:00Z'}).dialog.open,false,'notice expires after November 20 in Korea');
assert.equal(fixture({expires:'invalid'}).dialog.open,false);
const blocked=fixture({blocked:true}); assert.equal(blocked.dialog.open,true); blocked.dismiss.click(); assert.equal(blocked.dialog.open,false);
const pending=fixture({complete:false}); assert.equal(pending.dialog.open,false); pending.poster.complete=true; pending.poster.load(); assert.equal(pending.dialog.open,true);
assert.equal(fixture({width:0}).dialog.open,false,'missing images must not produce an empty modal');
assert.equal(fixture({supported:false}).dialog.open,false);
console.log('PASS: homepage-only notice, dismissal, Korean midnight, expiry, unavailable storage and missing assets.');
