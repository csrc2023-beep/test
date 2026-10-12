(() => {
  "use strict";
  const service = window.CSDICCommunityService;
  const page = document.getElementById("pageContent");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid = value => /^[a-f0-9-]{36}$/i.test(value || "");
  let generation = 0, media = {}, urls = new Map(), observer = null, editId = null;
  const boardOptions = route => ({route,title:service.boards[route],layout:route === "gallery" ? "gallery" : undefined,emptyText:"등록된 " + service.boards[route] + " 게시물이 없습니다.",media});
  const routeNow = () => location.hash.slice(1).split("?")[0] || "home";
  const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  function stop() {
    ++generation;
    observer?.disconnect(); observer = null;
    urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); media = {}; editId = null;
  }
  function status(value) {const node = document.getElementById("communityStatus"); if(node) node.textContent=value;}
  function toolbar(route,admin,drafts) {
    if(!admin) return "";
    return '<nav class="community-toolbar" aria-label="' + esc(service.boards[route]) + ' 관리"><a class="member-primary" href="#' + route + '?write=1">글쓰기</a><a href="#' + route + '"' + (!drafts?' aria-current="page"':'') + '>게시된 글</a><a href="#' + route + '?drafts=1"' + (drafts?' aria-current="page"':'') + '>임시 저장글</a></nav>';
  }
  function rowsToBoard(records) {
    const byPost = new Map(records.posts.map(post=>[post.id,[]]));
    media = Object.fromEntries(records.assets.map(asset=>[asset.id,asset]));
    for(const asset of records.assets) byPost.get(asset.post_id)?.push(asset);
    return records.posts.map(post=>{
      const attached=byPost.get(post.id)||[];
      const images=attached.filter(a=>a.kind==="image");
      return {id:post.id,title:post.title,date:post.post_date,author:post.author,pinned:post.pinned,
        body:[...(post.content?[{type:"paragraph",text:post.content}]:[]),...images.map(a=>({type:"image",src:a.id,caption:a.caption}))],
        attachments:attached.filter(a=>a.kind==="file").map(a=>({path:a.id,name:a.original_name})),thumbnail:images[0]?.id};
    });
  }
  async function image(assetId,ticket) {
    const asset=media[assetId]; if(!asset || asset.kind!=="image" || ticket!==generation) return;
    if(!urls.has(assetId)) {
      try {const blob=await service.download(asset.object_path); if(ticket!==generation) return;
        urls.set(assetId,URL.createObjectURL(blob));
      } catch {return;}
    }
    if(ticket!==generation) return;
    document.querySelectorAll('[data-community-image="'+assetId+'"]').forEach(img=>{if(img.isConnected) img.src=urls.get(assetId);});
  }
  function observeImages(root=document) {
    const ticket=generation;
    if(!observer && "IntersectionObserver" in window) observer=new IntersectionObserver(entries=>{
      for(const entry of entries) if(entry.isIntersecting){observer.unobserve(entry.target);image(entry.target.dataset.communityImage,ticket);}
    },{rootMargin:"240px"});
    root.querySelectorAll("[data-community-image]").forEach(img=>{if(urls.has(img.dataset.communityImage)) img.src=urls.get(img.dataset.communityImage); else if(observer) observer.observe(img); else image(img.dataset.communityImage,ticket);});
  }
  function assetList(list,kind) {
    return list.filter(a=>a.kind===kind).map(a=>'<li><label><input type="checkbox" name="keep-' + esc(a.id) + '" checked> 유지: ' + esc(a.original_name) + '</label>' + (kind==="image" ? '<label>사진 설명<input name="caption-' + esc(a.id) + '" value="' + esc(a.caption) + '" maxlength="200"></label>' : '') + '</li>').join("");
  }
  function editor(route, record) {
    const p=record?.post, list=record?.assets||[];
    const images=assetList(list,"image"), files=assetList(list,"file");
    return '<form id="communityEditor" class="community-editor"><h2>' + esc(service.boards[route]) + (p?' 수정':' 글쓰기') + '</h2><p>게시하면 글·사진·첨부파일은 홈페이지 방문자에게 공개됩니다.</p>' +
      '<label class="member-field">제목<input name="title" required maxlength="160" value="'+esc(p?.title||'')+'"></label>' +
      '<div class="community-editor-grid"><label class="member-field">작성자<input name="author" required maxlength="40" value="'+esc(p?.author||'관리자')+'"></label><label class="member-field">게시일<input name="date" type="date" required value="'+esc(p?.post_date||today())+'"></label></div>' +
      '<label class="member-field">본문<textarea name="content" maxlength="30000" rows="12" placeholder="게시물 내용을 입력하세요">'+esc(p?.content||'')+'</textarea></label>' +
      '<label class="member-check"><input type="checkbox" name="pinned"'+(p?.pinned?' checked':'')+'> 상단 공지로 표시</label>' +
      (images?'<fieldset class="community-existing"><legend>등록한 사진</legend><ul>'+images+'</ul></fieldset>':'')+
      '<label class="member-field">사진 추가 (JPG·PNG·WebP, 각 5 MB, 최대 12장)<input name="images" type="file" accept=".jpg,.jpeg,.png,.webp" multiple></label>'+
      (files?'<fieldset class="community-existing"><legend>등록한 첨부파일</legend><ul>'+files+'</ul></fieldset>':'')+
      '<label class="member-field">첨부파일 추가 (PDF·Word·Excel·PowerPoint·TXT·ZIP, 각 20 MB, 최대 5개)<input name="files" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.zip" multiple></label>'+
      '<div class="community-editor-actions"><button class="member-primary" type="submit" data-publish="1">게시하기</button><button class="member-secondary" type="submit" data-publish="0">임시 저장</button><a href="#'+route+'">취소</a></div><p id="communityStatus" role="status" aria-live="polite"></p></form>';
  }
  async function render(route,rawQuery="") {
    if(!Object.hasOwn(service.boards,route)) return;
    const ticket=generation, params=new URLSearchParams(rawQuery);
    page.innerHTML='<p class="community-loading" role="status">게시물을 불러오고 있습니다.</p>';
    try {
      const {isAdmin}=await window.CSDICMembers.getPermissions(); if(ticket!==generation||routeNow()!==route)return;
      const drafts=params.get("drafts")==="1" && isAdmin;
      if(params.get("write")==="1" || params.has("edit")) {
        if(!isAdmin){page.innerHTML='<p class="notice-missing">관리자 계정으로 로그인해 주세요. <a href="#login">로그인</a></p>';return;}
        const id=params.get("edit");if(id&&!uuid(id)) throw new Error("INVALID_POST");
        const record=id?await service.get(id):null;if(ticket!==generation)return;
        if(id&&(!record||record.post.board!==route))throw new Error("POST_MISSING");
        editId=id||null; media=Object.fromEntries((record?.assets||[]).map(a=>[a.id,a])); page.innerHTML=editor(route,record);return;
      }
      const records=await service.load(route,drafts);if(ticket!==generation)return;
      const posts=rowsToBoard(records), board=window.CSDICNoticeBoard.create(posts,boardOptions(route));
      const view=board.render(rawQuery), selected=posts.find(p=>p.id===params.get("id"));
      page.innerHTML=toolbar(route,isAdmin,drafts)+(drafts?'<p class="community-private-note">임시 저장글은 관리자에게만 보입니다.</p>':'')+
        (selected&&isAdmin?'<div class="community-detail-actions"><a class="member-secondary" href="#'+route+'?edit='+esc(selected.id)+'">수정</a><button class="member-danger" type="button" data-community-delete="'+esc(selected.id)+'" data-community-title="'+esc(selected.title)+'">삭제</button></div>':'')+view.html+'<p id="communityStatus" role="status" aria-live="polite"></p>';
      if(params.has("id")) document.title=view.title+' | CSDIC';
      observeImages(page);
    } catch(error) {if(ticket===generation) page.innerHTML='<div class="notice-missing"><p>게시물을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p><a href="#'+route+'">목록</a></div>';}
  }
  async function renderHome() {
    const ticket=generation;
    try {
      const result=await Promise.all(Object.keys(service.boards).map(board=>service.load(board)));
      if(ticket!==generation||routeNow()!=="home")return;
      for(const [index,route] of Object.keys(service.boards).entries()) {
        const items=rowsToBoard(result[index]);
        const board=window.CSDICNoticeBoard.create(items,boardOptions(route));
        const target={news:"notice-content",press:"press-content",recruit:"recruit-content"}[route];
        if(target) document.getElementById(target).innerHTML=board.homeHTML();
        if(route==="gallery") window.CSDICHomeGallery?.setHTML(board.homeGalleryHTML());
      }
      // Keep media from all four feeds available to the carousel.
      media=Object.fromEntries(result.flatMap(x=>x.assets.map(a=>[a.id,a])));
      observeImages(document.getElementById("homePage"));
    } catch { /* Existing empty states remain if the connection is unavailable. */ }
  }
  page.addEventListener("submit",async event=>{
    if(event.target.id!=="communityEditor")return;
    event.preventDefault();const form=event.target,route=routeNow(),ticket=generation, data=new FormData(form);
    const publish=event.submitter?.dataset.publish==="1";
    const kept=Object.values(media).filter(a=>a.post_id===editId&&form.elements.namedItem("keep-"+a.id)?.checked)
      .map(a=>({...a,caption:String(data.get("caption-"+a.id)||"").slice(0,200)}));
    const input={id:editId,board:route,title:String(data.get("title")||""),content:String(data.get("content")||""),author:String(data.get("author")||""),date:String(data.get("date")||""),pinned:data.has("pinned"),published:publish,assets:kept,
      images:form.elements.namedItem("images").files,files:form.elements.namedItem("files").files};
    form.querySelectorAll("button").forEach(b=>b.disabled=true);status("저장하고 있습니다. 사진과 파일이 많으면 잠시 걸립니다.");
    try {
      if(!(await window.CSDICMembers.getPermissions()).isAdmin) throw new Error("ACCESS_DENIED");
      const saved=await service.save(input,id=>{editId=id;});
      if(ticket!==generation)return;
      const next=route+'?id='+saved.id+(publish?'':'&drafts=1');
      if(location.hash.slice(1)===next)render(route,next.split("?")[1]);else location.hash=next;
    } catch(error) {
      if(ticket===generation)status(({INVALID_UPLOAD:"파일 형식과 용량을 확인해 주세요.",INVALID_IMAGE:"사진 파일의 실제 형식을 확인해 주세요.",TOO_MANY_UPLOADS:"사진은 최대 12장, 첨부파일은 최대 5개입니다.",EMPTY_POST:"게시하려면 본문이나 첨부가 필요하며 갤러리는 사진이 필요합니다.",INVALID_POST:"제목·작성자·본문을 확인해 주세요."})[error?.message]||"저장하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {if(form.isConnected)form.querySelectorAll("button").forEach(b=>b.disabled=false);}
  });
  page.addEventListener("click",async event=>{
    const button=event.target.closest("[data-community-delete],[data-community-download]");if(!button)return;
    const ticket=generation;
    if(button.dataset.communityDelete){
      if(!(await window.CSDICMembers.getPermissions()).isAdmin)return;
      try {const done=await service.removePost(button.dataset.communityDelete,button.dataset.communityTitle);if(done&&ticket===generation){const route=routeNow();location.hash=route+"?drafts=1";if(routeNow()===route)render(route,"drafts=1");}}
      catch(error){if(ticket===generation)status(error.postHidden?"삭제를 완료하지 못했습니다. 글은 비공개 상태입니다. 임시 저장글에서 다시 삭제해 주세요.":"삭제하지 못했습니다. 다시 시도해 주세요.");}
      return;
    }
    const asset=media[button.dataset.communityDownload];if(!asset||asset.kind!=="file")return;
    button.disabled=true;status("파일을 준비하고 있습니다.");
    try {const blob=await service.download(asset.object_path);if(ticket!==generation)return;
      const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=asset.original_name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status("다운로드를 시작했습니다.");
    }catch{if(ticket===generation)status("파일을 다운로드하지 못했습니다. 다시 시도해 주세요.");}
    finally {if(button.isConnected)button.disabled=false;}
  });
  window.CSDICCommunityUI=Object.freeze({stop,render,renderHome,observeImages});
})();
