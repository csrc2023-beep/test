const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {File} = require('node:buffer');
const source = fs.readFileSync('community-image.js', 'utf8');
const original = new File([new Uint8Array(1000)], '행사.PNG', {type:'image/png',lastModified:123});

function setup({width=4000,height=3000,size=200,type='image/webp',fallback=false,fail=''}={}) {
  const calls = [], context = {drawImage(...args) {calls.push(['draw',...args.slice(1)]);}};
  const canvas = {width:0,height:0,getContext() {return fail==='context'?null:context;},toBlob(done,mime,quality) {
    calls.push(['encode',mime,quality]);
    if(fail==='encode') throw new Error('encoder failed');
    done(fail==='empty'?null:new Blob([new Uint8Array(size)],{type}));
  }};
  class Image {
    naturalWidth=width;naturalHeight=height;
    set src(value) {if(value)queueMicrotask(()=>fail==='decode'?this.onerror(new Error('decode failed')):this.onload());}
  }
  const window = {createImageBitmap: fallback?undefined:async(file,options)=>{
    assert.equal(file,original);assert.equal(options.imageOrientation,'from-image');
    return {width,height,close(){calls.push(['close']);}};
  }};
  vm.runInNewContext(source,{window,document:{createElement:()=>canvas},Image,File,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:url=>calls.push(['revoke',url])}});
  return {run:()=>window.CSDICCommunityImage.optimize(original),calls,canvas};
}

(async()=>{
  const landscape=setup();const output=await landscape.run();
  assert.equal(output.name,'행사.webp');assert.equal(output.type,'image/webp');assert.equal(output.size,200);assert.equal(output.lastModified,123);
  assert.deepEqual(landscape.calls[0],['draw',0,0,1920,1440]);
  assert.deepEqual(landscape.calls[1],['encode','image/webp',0.8]);
  assert.ok(landscape.calls.some(c=>c[0]==='close'));assert.equal(landscape.canvas.width,1);
  const portrait=setup({width:3000,height:4000});await portrait.run();assert.deepEqual(portrait.calls[0],['draw',0,0,1440,1920]);
  const small=setup({width:320,height:240});await small.run();assert.deepEqual(small.calls[0],['draw',0,0,320,240]);
  for(const size of [1000,1001]) assert.equal(await setup({size}).run(),original,'Keep an equally sized or larger result out of storage');
  const png=await setup({type:'image/png'}).run();assert.equal(png.name,'행사.png');assert.equal(png.type,'image/png');
  const fallback=setup({fallback:true});await fallback.run();assert.ok(fallback.calls.some(c=>c[0]==='revoke'));
  for(const options of [{fail:'context'},{fail:'empty'},{fail:'encode'},{width:0},{width:10000,height:10000},{type:'text/html'}]) {
    const test=setup(options);await assert.rejects(test.run(),/IMAGE_PROCESSING_FAILED/);assert.ok(test.calls.some(c=>c[0]==='close'));
  }
  const broken=setup({fallback:true,fail:'decode'});await assert.rejects(broken.run(),/IMAGE_PROCESSING_FAILED/);assert.ok(broken.calls.some(c=>c[0]==='revoke'));
  console.log('PASS: photo resizing, aspect ratios, no upscaling, actual output format, smaller-only replacement, decoding fallback and resource cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
