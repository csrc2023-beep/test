const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../home-video.js'), 'utf8');
const ids = ['XonYXb1bTe4', 'V0syHK6EBmQ', 'o1JK79jszqo', 'R0n1ta9dnLM', '8NPgswgbTnE'];
const fallback = 'WOuwhJwBOus';

function fixture({random=0, signedIn=false, viewerReady=true, hidden=false, reduced=false, api=true}={}) {
  class Element {
    constructor() { this.dataset={}; this.attributes={}; this.listeners={}; this.disabled=true; this.hidden=false; }
    addEventListener(name, fn) { this.listeners[name]=fn; }
    setAttribute(name, value) { this.attributes[name]=value; }
    getAttribute(name) { return this.attributes[name]; }
    click() { this.listeners.click(); }
  }
  const nodes=Object.fromEntries(['homeVideoPlayer','videoSound','videoPlayback','videoStatus','homePage','homeVideoExternal'].map(id=>[id,new Element()]));
  nodes.homeVideoPlayer.dataset={videoId:fallback,publicVideoIds:ids.join(' ')};
  nodes.homePage.hidden=hidden;
  const listeners={}, appended=[], calls=[], state={ready:viewerReady,signedIn};
  let player, options;
  const YT={PlayerState:{ENDED:0,PLAYING:1,BUFFERING:3,CUED:5},Player:class {
    constructor(element, opts) { options=opts; player=this; this.muted=true; this.state=-1; }
    mute() { this.muted=true; calls.push(['mute']); }
    unMute() { this.muted=false; calls.push(['unmute']); }
    isMuted() { return this.muted; }
    setVolume(value) { calls.push(['volume',value]); }
    playVideo() { this.state=1; calls.push(['play']); }
    pauseVideo() { this.state=2; calls.push(['pause']); }
    getPlayerState() { return this.state; }
    loadVideoById(id) { this.state=1; calls.push(['load',id]); }
    cueVideoById(id) { this.state=5; calls.push(['cue',id]); }
  }};
  const window={CSDICMembers:{getViewerState:()=>({...state})}};
  if(api) window.YT=YT;
  vm.runInNewContext(source,{window,YT,document:{getElementById:id=>nodes[id],createElement:()=>({}),head:{append:el=>appended.push(el)}},URLSearchParams,location:{origin:'https://csdic.co.kr'},matchMedia:()=>({matches:reduced}),Math:{random:()=>random,floor:Math.floor},addEventListener:(name,fn)=>listeners[name]=fn});
  return {nodes,calls,appended,window,state,
    ready() { options.events.onReady({target:player}); },
    emit(value) { player.state=value; options.events.onStateChange({data:value,target:player}); },
    error() { options.events.onError({data:101,target:player}); },
    blocked() { options.events.onAutoplayBlocked(); },
    event:name=>listeners[name](),
    selected:()=>nodes.homeVideoPlayer.dataset.activeVideoId,
    viewer(value) { state.ready=true; state.signedIn=value; listeners['csdic:viewerchange'](); }
  };
}

for (const [i,random] of [0,.21,.41,.61,.999].entries()) {
  const f=fixture({random});
  assert.equal(f.selected(),ids[i]);
  const url=new URL(f.nodes.homeVideoPlayer.src);
  assert.equal(url.pathname,'/embed/'+ids[i]);
  assert.equal(url.searchParams.get('mute'),'1');
  assert.equal(url.searchParams.get('origin'),'https://csdic.co.kr');
  assert.equal(f.nodes.homeVideoExternal.href,'https://www.youtube.com/watch?v='+ids[i]);
}
const f=fixture(); f.ready();
assert.deepEqual(f.calls.slice(0,2),[['mute'],['play']]);
const first=f.selected(); f.emit(0);
assert.notEqual(f.selected(),first);
assert.equal(f.nodes.homeVideoExternal.href,'https://www.youtube.com/watch?v='+f.selected());
f.nodes.videoSound.click(); assert.equal(f.nodes.videoSound.getAttribute('aria-pressed'),'true');
assert(f.calls.some(call=>call[0]==='unmute'));
f.nodes.videoPlayback.click(); assert.equal(f.calls.at(-1)[0],'pause');
f.nodes.homePage.hidden=true; f.event('hashchange');
f.nodes.homePage.hidden=false;
const pausedCalls=f.calls.length; f.event('hashchange'); assert.equal(f.calls.length,pausedCalls);
f.nodes.videoPlayback.click(); assert.equal(f.calls.at(-1)[0],'play');
const selected=f.selected(); f.event('hashchange'); assert.equal(f.selected(),selected);
f.viewer(true); assert.equal(f.selected(),fallback); assert.deepEqual(f.calls.at(-1),['load',fallback]);
f.viewer(false); assert(ids.includes(f.selected()));
const afterLogout=f.calls.length; f.viewer(false); assert.equal(f.calls.length,afterLogout);
const deferred=fixture({viewerReady:false}); assert.equal(deferred.nodes.homeVideoPlayer.src,undefined);
deferred.viewer(true); assert.equal(deferred.selected(),fallback);
const transition=fixture(); transition.viewer(true); transition.ready(); assert.deepEqual(transition.calls.at(-1),['load',fallback]);
const hidden=fixture({hidden:true}); assert.equal(hidden.nodes.homeVideoPlayer.src,undefined);
hidden.nodes.homePage.hidden=false; hidden.event('hashchange'); assert(hidden.nodes.homeVideoPlayer.src);
const reduced=fixture({reduced:true}); reduced.ready(); assert(!reduced.calls.some(call=>call[0]==='play'));
reduced.nodes.videoPlayback.click(); assert.equal(reduced.calls.at(-1)[0],'play');
const errors=fixture(); errors.ready(); const tried=new Set();
for(let i=0;i<5;i++) { tried.add(errors.selected()); errors.error(); }
assert.equal(tried.size,5); assert.equal(errors.nodes.videoPlayback.disabled,true);
assert(errors.nodes.videoStatus.textContent.includes('YouTube'));
const blocked=fixture(); blocked.ready(); blocked.blocked(); assert(blocked.nodes.videoStatus.textContent.includes('재생 버튼'));
const noApi=fixture({api:false}); assert.equal(noApi.appended.length,1);
noApi.appended[0].onerror(); assert(noApi.nodes.videoStatus.textContent.includes('YouTube'));
console.log('Home video: random selection, playback, auth changes and failure handling passed.');
