const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {File}=require('node:buffer');
const {randomUUID}=require('node:crypto');
const source=fs.readFileSync('community-service.js','utf8');
const photo=new File([new Uint8Array([137,80,78,71,13,10,26,10]),new Uint8Array(1000)],'사진.png',{type:'image/png'});
const optimized=new File([new Uint8Array(120)],'사진.webp',{type:'image/webp'});
const documentFile=new File(['original PDF contents'],'문서.pdf',{type:'application/pdf'});
function setup(fail=false) {
  const calls=[];
  const client={
    from(table) {
      return {insert(values) {calls.push(['insert',table,values]);return {select:()=>({single:async()=>({data:{id:values.id}})})};},
        select() {return this;},eq(){return this;},order(){return this;},async range(){return {data:[]};}};
    },
    storage:{from:()=>({async upload(path,file,options){calls.push(['upload',path,file,options]);return {data:{path}};}})},
    async rpc(name,values) {calls.push(['commit',name,values]);return {data:values.p_post_id};}
  };
  const window={CSDICMemberClient:{client},CSDICCommunityImage:{async optimize(file){calls.push(['compress',file]);if(fail)throw new Error('IMAGE_PROCESSING_FAILED');return optimized;}}};
  vm.runInNewContext(source,{window,crypto:{randomUUID},Uint8Array});
  return {calls,save:input=>window.CSDICCommunityService.save(input)};
}
const input={board:'gallery',title:'사진 게시',content:'',author:'관리자',date:'2026-10-16',pinned:false,published:true,assets:[],images:[photo],files:[documentFile]};
(async()=>{
  for(const board of ['news','press','recruit','gallery']) {
    const test=setup();await test.save({...input,board});
    assert.equal(test.calls[0][0],'compress','Compression must finish before creating a draft');
    const uploads=test.calls.filter(x=>x[0]==='upload');assert.equal(uploads.length,2);
    assert.equal(uploads[0][2],optimized);assert.match(uploads[0][1],/\.webp$/);assert.equal(uploads[0][3].contentType,'image/webp');
    assert.equal(uploads[1][2],documentFile);assert.equal(uploads[1][3].contentType,'application/pdf');
    const manifest=test.calls.find(x=>x[0]==='commit')[2].p_assets;
    assert.equal(manifest[0].size_bytes,120);assert.equal(manifest[0].original_name,'사진.webp');assert.equal(manifest[0].media_type,'image/webp');
    assert.equal(manifest[1].size_bytes,documentFile.size);assert.equal(manifest[1].original_name,'문서.pdf');
  }
  const broken=setup(true);await assert.rejects(broken.save(input),/IMAGE_PROCESSING_FAILED/);assert.deepEqual(broken.calls.map(x=>x[0]),['compress']);
  const invalid=setup();await assert.rejects(invalid.save({...input,images:[new File(['bad photo'],'bad.png')]}),/INVALID_IMAGE/);assert.deepEqual(invalid.calls,[]);
  console.log('PASS: all four boards store compressed photo bytes with matching metadata; documents stay intact; invalid photos and compression failures never start uploads.');
})().catch(error=>{console.error(error);process.exitCode=1;});
