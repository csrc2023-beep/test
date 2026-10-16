(() => {
  "use strict";
  const {client} = window.CSDICMemberClient;
  const bucket = "community-assets";
  const boards = Object.freeze({news:"공지사항",press:"대외홍보",recruit:"채용",gallery:"갤러리"});
  const types = Object.freeze({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",txt:"text/plain",zip:"application/zip"});
  const check = result => {if(result.error) throw result.error;return result.data;};
  async function pages(makeQuery, size=100) {
    const rows=[];
    for(let offset=0;;offset+=size) {
      const data=check(await makeQuery().range(offset,offset+size-1));
      rows.push(...data); if(data.length<size) return rows;
    }
  }
  async function assets(postId, includeRetired=false) {
    return pages(()=>{
      let q=client.from("community_assets").select("*").eq("post_id",postId).order("sort_order").order("id");
      if(!includeRetired) q=q.eq("retired",false);
      return q;
    });
  }
  async function load(board,drafts=false) {
    if(!client || !Object.hasOwn(boards,board)) throw new Error("BOARD_UNAVAILABLE");
    const posts=await pages(()=>client.from("community_posts").select("*").eq("board",board).eq("published",!drafts).order("pinned",{ascending:false}).order("post_date",{ascending:false}).order("created_at",{ascending:false}).order("id"));
    const media=[];
    for(let n=0;n<posts.length;n+=50) {
      const ids=posts.slice(n,n+50).map(p=>p.id);
      media.push(...await pages(()=>client.from("community_assets").select("*").in("post_id",ids).eq("retired",false).order("sort_order").order("id"),200));
    }
    return {posts,assets:media};
  }
  async function get(id) {
    const post=check(await client.from("community_posts").select("*").eq("id",id).maybeSingle());
    return post ? {post,assets:await assets(id)} : null;
  }
  function validateFiles(files, kind) {
    return Array.from(files).map(file=>{
      const ext=file.name.split(".").pop().toLowerCase();
      const image=Object.hasOwn(types,ext)&&types[ext].startsWith("image/");
      if(!Object.hasOwn(types,ext) || (kind==="image")!==image || file.size<1 || file.size>(image?5:20)*1024*1024) throw new Error("INVALID_UPLOAD");
      return {file,ext,kind,media_type:types[ext]};
    });
  }
  async function verifyImage(file,ext) {
    const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const valid=(ext==="jpg"||ext==="jpeg") ? bytes[0]===255&&bytes[1]===216 : ext==="png" ? [137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x) :
      String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
    if(!valid) throw new Error("INVALID_IMAGE");
  }
  async function removePaths(paths) {
    for(let n=0;n<paths.length;n+=100) check(await client.storage.from(bucket).remove(paths.slice(n,n+100)));
  }
  async function cleanup(postId) {
    try {
      const retired=(await assets(postId,true)).filter(a=>a.retired);
      if(!retired.length) return true;
      await removePaths(retired.map(a=>a.object_path));
      const deleted=check(await client.from("community_assets").delete().eq("post_id",postId).eq("retired",true).select("id"));
      return deleted.length===retired.length;
    } catch {return false;}
  }
  async function save(input,onCreated=()=>{}) {
    const imageUploads=validateFiles(input.images,"image"), fileUploads=validateFiles(input.files,"file");
    const kept=input.assets.map(a=>({...a}));
    const imageCount=kept.filter(a=>a.kind==="image").length+imageUploads.length;
    const fileCount=kept.filter(a=>a.kind==="file").length+fileUploads.length;
    if(imageCount>12 || fileCount>5) throw new Error("TOO_MANY_UPLOADS");
    if(!Object.hasOwn(boards,input.board)||!input.title.trim()||input.title.trim().length>160||input.content.length>30000||!input.author.trim()||input.author.trim().length>40) throw new Error("INVALID_POST");
    if(input.published && ((input.board==="gallery"&&!imageCount)||(!input.content.trim()&&!imageCount&&!fileCount))) throw new Error("EMPTY_POST");
    for(const upload of imageUploads) {
      await verifyImage(upload.file,upload.ext);
      upload.file=await window.CSDICCommunityImage.optimize(upload.file);
      upload.ext=upload.file.name.split(".").pop().toLowerCase();
      upload.media_type=types[upload.ext];
    }
    let id=input.id;
    if(!id) {
      id=crypto.randomUUID();
      check(await client.from("community_posts").insert({id,board:input.board,title:input.title.trim(),content:input.content,author:input.author.trim(),post_date:input.date,pinned:input.pinned,published:false}).select("id").single());
      onCreated(id);
    }
    const uploaded=[];
    let committed=false;
    try {
      for(const item of [...imageUploads,...fileUploads]) {
        const assetId=crypto.randomUUID(), path=id+"/"+assetId+"."+item.ext;
        check(await client.storage.from(bucket).upload(path,item.file,{contentType:item.media_type,upsert:false}));
        const asset={id:assetId,kind:item.kind,object_path:path,original_name:item.file.name.slice(0,240),media_type:item.media_type,size_bytes:item.file.size,caption:""};
        uploaded.push(asset); kept.push(asset);
      }
      const manifest=kept.map((a,i)=>({id:a.id,kind:a.kind,object_path:a.object_path,original_name:a.original_name,media_type:a.media_type,size_bytes:a.size_bytes,caption:a.caption||"",sort_order:i}));
      check(await client.rpc("save_community_post",{p_post_id:id,p_board:input.board,p_title:input.title.trim(),p_content:input.content,p_author:input.author.trim(),p_post_date:input.date,p_pinned:input.pinned,p_published:input.published,p_assets:manifest}));
      committed=true;
      return {id,cleaned:await cleanup(id)};
    } catch(error) {
      if(!committed && uploaded.length) {
        try {await removePaths(uploaded.map(a=>a.object_path));}
        catch {
          // Keep failed-upload cleanup records private, so they can be retried later.
          await client.from("community_assets").insert(uploaded.map((a,i)=>({...a,post_id:id,sort_order:i,retired:true}))).then(()=>{},()=>{});
        }
      }
      throw error;
    }
  }
  async function removePost(id,title) {
    if(!window.confirm(window.CSDICLanguage ? window.CSDICLanguage.t('“'+title+'” 게시물과 사진·첨부파일을 삭제할까요?\n삭제한 자료는 복구할 수 없습니다.') : '“'+title+'” 게시물과 사진·첨부파일을 삭제할까요?\n삭제한 자료는 복구할 수 없습니다.')) return false;
    check(await client.from("community_posts").update({published:false}).eq("id",id).select("id").single());
    try {
      await removePaths((await assets(id,true)).map(a=>a.object_path));
      check(await client.from("community_posts").delete().eq("id",id).select("id").single());
      return true;
    } catch {
      const error=new Error("DELETE_INCOMPLETE");error.postHidden=true;throw error;
    }
  }
  const download=path=>client.storage.from(bucket).download(path).then(check);
  window.CSDICCommunityService=Object.freeze({boards,load,get,save,removePost,download});
})();
