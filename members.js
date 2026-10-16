(() => {
  "use strict";
  const {client, configured, bucket} = window.CSDICMemberClient;
  const accountRoutes = new Set(["login", "join", "reset", "account", "resources", "member-admin"]);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const page = document.getElementById("pageContent");
  let user = null, membership = null, view = 0, identity = 0, documents = new Map(), objectUrls = new Set();
  const currentRoute = () => location.hash.slice(1).split("?")[0] || "home";
  const readyNotice = () => configured ? "" : '<div class="member-service-note" role="status">회원 서비스 연결을 준비 중입니다. 연결이 완료되면 가입과 로그인을 이용할 수 있습니다.</div>';
  const disabled = () => configured ? "" : " disabled";
  const field = (name, label, type, autocomplete, extra = "") => '<label class="member-field">' + label + '<input name="' + name + '" type="' + type + '" autocomplete="' + autocomplete + '" required' + extra + disabled() + '></label>';
  const statusLine = '<p class="member-message" id="memberMessage" role="status" aria-live="polite"></p>';
  const title = (heading, detail) => '<div class="member-heading"><h2>' + heading + '</h2><p>' + detail + '</p></div>';
  const links = '<div class="member-form-links"><a href="#login">로그인</a><a href="#join">회원가입</a><a href="#reset">비밀번호 찾기</a></div>';
  const message = text => {const el = document.getElementById("memberMessage"); if (el) el.textContent = text;};
  const errorMessage = error => {
    if (error?.status === 429) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    if (error?.code === "email_not_confirmed") return "이메일 인증을 완료한 뒤 로그인해 주세요.";
    if (error?.code === "invalid_credentials") return "이메일 또는 비밀번호를 확인해 주세요.";
    if (["email_address_not_authorized", "over_email_send_rate_limit", "unexpected_failure"].includes(error?.code)) return "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도하거나 센터 관리자에게 문의해 주세요.";
    return "요청을 완료하지 못했습니다. 입력값과 연결 상태를 확인한 뒤 다시 시도해 주세요.";
  };
  const statusNames = {pending: "승인 대기", approved: "승인 완료", blocked: "이용 제한"};
  const canRead = () => Boolean(user?.email_confirmed_at && membership?.status === "approved");
  const isAdmin = () => canRead() && membership.role === "admin";
  function clearFiles() {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls.clear(); documents.clear();
  }
  function updateHeader() {
    document.querySelector('[data-member-link="login"]').hidden = Boolean(user);
    document.querySelector('[data-member-link="join"]').hidden = Boolean(user);
    document.getElementById("memberAccountLink").hidden = !user;
    document.getElementById("memberAdminLink").hidden = !isAdmin();
    document.getElementById("memberLogout").hidden = !user;
  }
  async function refresh() {
    const request = ++identity;
    let nextUser = null, nextMembership = null;
    if (client) {
      const result = await client.auth.getUser();
      if (!result.error && result.data.user) {
        nextUser = result.data.user;
        const row = await client.from("memberships").select("user_id,email,status,role").eq("user_id", nextUser.id).maybeSingle();
        if (!row.error) nextMembership = row.data;
      }
    }
    if (request !== identity) return;
    user = nextUser; membership = nextMembership; updateHeader();
  }
  function authForm(route) {
    if (user && route !== "reset") return accountContent();
    const signup = route === "join", reset = route === "reset";
    return '<div class="member-card">' + title(signup ? "회원가입" : reset ? "비밀번호 찾기" : "로그인", signup ? "이메일 인증 후 관리자의 승인을 받으면 회원 자료실을 이용할 수 있습니다." : reset ? "가입한 이메일로 비밀번호 재설정 안내를 보내드립니다." : "회원 계정으로 로그인해 주세요.") + readyNotice() +
      '<form id="memberAuthForm" data-action="' + route + '">' + field("email", "이메일", "email", "email", ' maxlength="254"') +
      (reset ? "" : field("password", "비밀번호", "password", signup ? "new-password" : "current-password", signup ? ' minlength="12" maxlength="128"' : ' maxlength="128"')) +
      (signup ? '<p class="member-field-hint">비밀번호는 12자 이상으로 설정해 주세요.</p>' + field("confirm", "비밀번호 확인", "password", "new-password", ' minlength="12" maxlength="128"') : "") +
      '<button class="member-primary" type="submit"' + disabled() + '>' + (signup ? "가입 신청" : reset ? "재설정 안내 받기" : "로그인") + '</button>' + statusLine + '</form>' + links + '</div>';
  }
  function accountContent() {
    if (!user) return '<div class="member-card">' + title("내 회원정보", "로그인 후 회원 상태를 확인할 수 있습니다.") + '<a class="member-primary" href="#login">로그인</a></div>';
    return '<div class="member-card">' + title("내 회원정보", esc(user.email)) + '<div class="member-state">' + esc(statusNames[membership?.status] || "회원 상태 확인 중") + '</div><p>' + (canRead() ? "회원 자료실에서 허용된 문서를 이용할 수 있습니다." : membership?.status === "blocked" ? "자료실 이용이 제한되어 있습니다. 센터 관리자에게 문의해 주세요." : "가입 신청이 접수되었습니다. 관리자 승인 후 회원 자료실을 이용할 수 있습니다.") + '</p><div class="member-actions"><a class="member-primary" href="#resources">회원 자료실</a><button type="button" class="member-secondary" data-member-refresh>회원 상태 새로고침</button></div>' + statusLine + '</div>';
  }
  function gateContent(admin = false) {
    if (!configured) return '<div class="member-card">' + title(admin ? "회원 관리" : "회원 자료실", "승인된 회원만 회원 전용 자료를 이용할 수 있습니다.") + readyNotice() + '<a class="member-secondary" href="#login">로그인 안내</a></div>';
    if (!user) return '<div class="member-card">' + title("로그인이 필요합니다", "로그인한 뒤 이용 권한을 확인합니다.") + '<a class="member-primary" href="#login">로그인</a></div>';
    if (!canRead()) return accountContent();
    if (admin && !isAdmin()) return '<div class="member-card">' + title("관리자 전용 페이지", "이 계정에는 관리 권한이 없습니다.") + '<a href="#resources">회원 자료실로 이동</a></div>';
    return null;
  }
  async function render(route) {
    const ticket = ++view;
    clearFiles();
    if (!accountRoutes.has(route)) return;
    if (["login", "join", "reset"].includes(route)) {page.innerHTML = authForm(route); return;}
    page.innerHTML = '<div class="member-card"><p role="status">회원 상태를 확인하고 있습니다.</p></div>';
    try {
      await refresh();
      if (ticket !== view) return;
      if (route === "account") {page.innerHTML = accountContent(); return;}
      const blocked = gateContent(route === "member-admin");
      if (blocked) {page.innerHTML = blocked; return;}
      if (route === "member-admin") {await renderAdmin(ticket); return;}
      const result = await client.from("member_documents").select("id,title,description,object_path,original_name,media_type,size_bytes,created_at").eq("published", true).order("created_at", {ascending: false});
      if (result.error) throw result.error;
      if (ticket !== view) return;
      result.data.forEach(doc => documents.set(doc.id, doc));
      page.innerHTML = title("회원 자료실", "현재 계정에 열람 권한이 있는 문서만 표시됩니다.") + '<div class="member-document-list">' + (result.data.length ? result.data.map(doc => '<article class="member-document"><div><h3>' + esc(doc.title) + '</h3><p>' + esc(doc.description) + '</p><small>' + esc(doc.original_name) + ' · ' + Math.ceil(doc.size_bytes / 1024) + ' KB</small></div><div class="member-actions">' + (doc.media_type === "application/pdf" ? '<button class="member-secondary" data-document="' + esc(doc.id) + '" data-open>PDF 열람</button>' : "") + '<button class="member-primary" data-document="' + esc(doc.id) + '">다운로드</button></div></article>').join("") : '<div class="empty-content">이용할 수 있는 문서가 없습니다.</div>') + '</div>' + statusLine;
    } catch {if (ticket === view) page.innerHTML = '<div class="member-card">' + title("연결을 확인해 주세요", "회원 정보를 확인하지 못했습니다. 새로고침하거나 다시 로그인해 주세요.") + '<a href="#login">로그인으로 이동</a></div>';}
  }
  async function renderAdmin(ticket) {
    const [members, files] = await Promise.all([client.from("memberships").select("user_id,email,status,role,created_at").order("created_at", {ascending: false}), client.from("member_documents").select("id,title,published").order("created_at", {ascending: false})]);
    if (members.error || files.error) throw new Error("ADMIN_LOAD_FAILED");
    if (ticket !== view) return;
    page.innerHTML = title("회원 및 문서 관리", "회원 승인을 처리하고 회원 전용 문서를 등록합니다.") + '<nav class="community-admin-links" aria-label="게시판 관리"><strong>게시판 글쓰기</strong><a href="#news?write=1">공지사항</a><a href="#press?write=1">대외홍보</a><a href="#recruit?write=1">채용</a><a href="#gallery?write=1">갤러리</a></nav><div class="member-admin-scroll"><table class="member-admin-table"><thead><tr><th>이메일</th><th>상태</th><th>회원 관리</th></tr></thead><tbody>' + members.data.map(m => '<tr><td>' + esc(m.email) + (m.role === "admin" ? ' <span class="member-state">관리자</span>' : "") + '</td><td>' + esc(statusNames[m.status]) + '</td><td>' + (m.role === "admin" ? "—" : '<select aria-label="' + esc(m.email) + ' 회원 상태" data-status-for="' + esc(m.user_id) + '">' + Object.entries(statusNames).map(([key, label]) => '<option value="' + key + '"' + (key === m.status ? " selected" : "") + '>' + label + '</option>').join("") + '</select><button class="member-secondary" data-save-member="' + esc(m.user_id) + '">변경 저장</button>') + '</td></tr>').join("") + '</tbody></table></div><section class="member-card member-upload"><h3>문서 등록</h3><form id="memberUploadForm"><label class="member-field">문서 제목<input name="title" required maxlength="160"></label><label class="member-field">설명<textarea name="description" maxlength="2000" rows="3"></textarea></label><label class="member-field">파일<input name="file" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.zip" required></label><label class="member-check"><input name="allMembers" type="checkbox" checked> 승인된 모든 회원에게 허용</label><label class="member-field" id="documentGrantees" hidden>특정 회원 선택<select name="grantees" multiple size="5">' + members.data.filter(m => m.status === "approved" && m.role !== "admin").map(m => '<option value="' + esc(m.user_id) + '">' + esc(m.email) + '</option>').join("") + '</select></label><p class="member-field-hint">PDF, Word, Excel, PowerPoint, TXT, ZIP · 최대 20 MB</p><button class="member-primary" type="submit">비공개 문서 등록</button></form></section><section class="member-card"><h3>등록 문서</h3>' + (files.data.length ? files.data.map(f => '<p><span translate="no">' + esc(f.title) + '</span> <button class="member-secondary" data-unpublish="' + esc(f.id) + '" data-published="' + String(f.published) + '">' + (f.published ? "열람 중지" : "열람 허용") + '</button> <button type="button" class="member-danger" data-delete-document="' + esc(f.id) + '" data-document-title="' + esc(f.title) + '">삭제</button></p>').join("") : '<p>등록된 문서가 없습니다.</p>') + '</section>' + statusLine;
  }
  async function logout() {
    ++identity; ++view; clearFiles();
    if (client) await client.auth.signOut({scope: "local"});
    user = membership = null; updateHeader(); location.hash = "login";
    if (currentRoute() === "login") render("login");
  }
  page.addEventListener("submit", async event => {
    if (!["memberAuthForm", "memberUploadForm"].includes(event.target.id)) return;
    event.preventDefault();
    if (!client) {message("회원 서비스 연결이 완료되지 않았습니다."); return;}
    const form = event.target, values = new FormData(form), button = form.querySelector('[type="submit"]');
    const ticket = view;
    button.disabled = true; message("요청을 처리하고 있습니다.");
    try {
      if (form.id === "memberUploadForm") {await upload(values); if (ticket === view) await render("member-admin"); message("문서가 등록되었습니다."); return;}
      const email = String(values.get("email") || "").trim(), password = String(values.get("password") || "");
      let result;
      if (form.dataset.action === "join") {
        if (password.length < 12 || password !== values.get("confirm")) {message("12자 이상의 비밀번호와 동일한 확인 비밀번호를 입력해 주세요."); return;}
        result = await client.auth.signUp({email, password, options: {emailRedirectTo: new URL("auth.html", location.href).href}});
        if (result.error) throw result.error;
        form.reset(); message("가입을 진행할 수 있는 이메일이면 인증 안내를 보내드립니다. 이메일 인증 후 관리자 승인을 기다려 주세요.");
      } else if (form.dataset.action === "reset") {
        result = await client.auth.resetPasswordForEmail(email, {redirectTo: new URL("auth.html", location.href).href});
        if (result.error) throw result.error;
        message("가입된 이메일이면 비밀번호 재설정 안내를 보내드립니다.");
      } else {
        result = await client.auth.signInWithPassword({email, password});
        if (result.error) throw result.error;
        await refresh(); if (ticket === view) location.hash = "account";
      }
    } catch (error) {if (ticket === view) message(errorMessage(error));}
    finally {if (button.isConnected) button.disabled = !configured;}
  });
  async function upload(values) {
    await refresh(); if (!isAdmin()) throw new Error("ACCESS_DENIED");
    const file = values.get("file"), ext = file?.name?.split(".").pop().toLowerCase();
    const types = {pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",txt:"text/plain",zip:"application/zip"};
    if (!Object.hasOwn(types,ext) || !file.size || file.size > 20 * 1024 * 1024) throw new Error("INVALID_FILE");
    const path = crypto.randomUUID() + "." + ext;
    const allMembers = values.has("allMembers"), grantees = values.getAll("grantees");
    if (!allMembers && !grantees.length) throw new Error("NO_GRANTEES");
    const uploaded = await client.storage.from(bucket).upload(path, file, {contentType: types[ext], upsert: false});
    if (uploaded.error) throw uploaded.error;
    let documentId;
    try {
      const saved = await client.from("member_documents").insert({title: String(values.get("title")).trim(),description: String(values.get("description") || ""),object_path:path,original_name:file.name,media_type:types[ext],size_bytes:file.size,all_members:allMembers,published:false}).select("id").single();
      if (saved.error) throw saved.error; documentId = saved.data.id;
      if (!allMembers) {const grants = await client.from("member_document_grants").insert(grantees.map(user_id => ({document_id:documentId,user_id}))); if (grants.error) throw grants.error;}
      const published = await client.from("member_documents").update({published:true}).eq("id", documentId); if (published.error) throw published.error;
    } catch (error) {
      // A failed registration stays unpublished and cannot become a public file.
      if (documentId) await client.from("member_documents").delete().eq("id", documentId);
      await client.storage.from(bucket).remove([path]); throw error;
    }
  }
  page.addEventListener("change", event => {if (event.target.name === "allMembers") document.getElementById("documentGrantees").hidden = event.target.checked;});
  page.addEventListener("click", async event => {
    const button = event.target.closest("button"); if (!button) return;
    if (!button.matches("[data-member-refresh],[data-document],[data-save-member],[data-delete-document],[data-unpublish]")) return;
    if (button.hasAttribute("data-member-refresh")) {await render(currentRoute()); return;}
    if (!client) return;
    const ticket = view;
    button.disabled = true;
    try {
      if (button.dataset.document) {
        const doc = documents.get(button.dataset.document); if (!doc) return;
        await refresh(); if (!canRead() || ticket !== view) throw new Error("ACCESS_DENIED");
        message("문서의 열람 권한을 확인하고 있습니다.");
        const result = await client.storage.from(bucket).download(doc.object_path); if (result.error) throw result.error;
        if (ticket !== view) return;
        const url = URL.createObjectURL(button.hasAttribute("data-open") ? new Blob([result.data],{type:"application/pdf"}) : result.data);
        objectUrls.add(url);
        if (button.hasAttribute("data-open")) {
          const preview = document.createElement("a"); preview.href = url; preview.target = "_blank"; preview.rel = "noopener noreferrer"; preview.textContent = "PDF 열기";
          message("열람 권한을 확인했습니다. 아래 링크를 눌러 PDF를 열어 주세요."); document.getElementById("memberMessage").append(" ", preview);
        } else {const a = document.createElement("a"); a.href = url; a.download = doc.original_name; a.click(); message("다운로드를 시작했습니다.");}
      } else if (button.dataset.saveMember) {
        const status = page.querySelector('[data-status-for="' + button.dataset.saveMember + '"]').value;
        const result = await client.rpc("set_member_status",{target_user:button.dataset.saveMember,new_status:status}); if (result.error) throw result.error;
        if (ticket === view) await render("member-admin"); message("회원 상태를 변경했습니다.");
      } else if (button.dataset.deleteDocument) {
        await refresh();
        if (ticket !== view) return;
        if (!isAdmin()) throw new Error("ACCESS_DENIED");
        try {
          const deleted = await window.CSDICMemberDocumentActions.deleteDocument(button.dataset.deleteDocument,button.dataset.documentTitle);
          if (!deleted) return;
          if (ticket === view) {
            await render("member-admin");
            if (currentRoute() === "member-admin") message("문서와 원본 파일을 삭제했습니다.");
          }
        } catch (error) {
          if (!error.documentHidden) throw error;
          if (ticket === view) {
            await render("member-admin");
            if (currentRoute() === "member-admin") message("삭제를 완료하지 못했습니다. 문서는 열람 중지 상태로 유지됩니다. 다시 삭제를 시도해 주세요.");
          }
        }
      } else if (button.dataset.unpublish) {
        const result = await client.from("member_documents").update({published:button.dataset.published !== "true"}).eq("id", button.dataset.unpublish); if (result.error) throw result.error;
        if (ticket === view) await render("member-admin"); message("문서 열람 상태를 변경했습니다.");
      }
    } catch {if (ticket === view) message("권한이 없거나 요청을 완료하지 못했습니다. 회원 상태를 확인한 뒤 다시 시도해 주세요.");}
    finally {if (button.isConnected) button.disabled = false;}
  });
  document.getElementById("memberLogout").addEventListener("click", logout);
  window.CSDICMembers = Object.freeze({render, routes: accountRoutes, async getPermissions() {await refresh(); return {isAdmin:isAdmin(),userId:user?.id || null};}});
  refresh().then(() => {if (accountRoutes.has(currentRoute())) render(currentRoute());}).catch(() => updateHeader());
  if (client) client.auth.onAuthStateChange(() => {
    // Do not call Auth APIs inside its synchronous event callback.
    setTimeout(() => refresh().then(() => {if (accountRoutes.has(currentRoute())) render(currentRoute());}).catch(() => updateHeader()),0);
  });
})();
