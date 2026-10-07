(() => {
  "use strict";
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[char]);
  const fileURL = path => {
    if (typeof path !== "string" || !/^(assets\/notices|files\/notices)\/[A-Za-z0-9_./-]+$/.test(path) || path.split("/").includes("..")) return "";
    return path;
  };
  const route = params => "#news" + (params.toString() ? "?" + params.toString() : "");
  const emptyRow = text => '<tr><td colspan="4" class="notice-empty">' + escape(text) + '</td></tr>';
  function create(raw) {
    const seen = new Set();
    const notices = (Array.isArray(raw) ? raw : []).filter(item => {
      if (!item || !/^[A-Za-z0-9_-]+$/.test(item.id) || seen.has(item.id) || typeof item.title !== "string" || !item.title || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
      seen.add(item.id); return true;
    }).map(item => ({...item, author: item.author || "관리자", body: Array.isArray(item.body) ? item.body.filter(block => block && typeof block === "object") : [], attachments: Array.isArray(item.attachments) ? item.attachments.filter(file => file && typeof file === "object") : []})).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const allText = item => [item.title, ...item.body.map(block => block.text || (Array.isArray(block.items) ? block.items : []).join(" "))].join(" ").toLocaleLowerCase("ko");
    const filtered = (q, field) => notices.filter(item => !q || (field === "title" ? item.title : field === "body" ? allText({...item, title: ""}) : allText(item)).toLocaleLowerCase("ko").includes(q.toLocaleLowerCase("ko")));
    const state = query => {
      const params = new URLSearchParams(query);
      const q = (params.get("q") || "").trim().slice(0, 200);
      const field = ["all", "title", "body"].includes(params.get("field")) ? params.get("field") : "all";
      const matches = filtered(q, field);
      const totalPages = Math.max(1, Math.ceil(matches.length / 10));
      const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.get("page"), 10) || 1));
      const listParams = new URLSearchParams();
      if (q) { listParams.set("q", q); listParams.set("field", field); }
      if (page > 1) listParams.set("page", page);
      return {params, q, field, matches, page, totalPages, listParams};
    };
    const detailLink = (id, params) => { const p = new URLSearchParams(params); p.set("id", id); return route(p); };
    const blockHTML = block => {
      if (!block || typeof block !== "object") return "";
      if (block.type === "heading") return '<h3>' + escape(block.text) + '</h3>';
      if (block.type === "list") { const tag = block.ordered ? "ol" : "ul"; return '<' + tag + '>' + (Array.isArray(block.items) ? block.items : []).map(item => '<li>' + escape(item) + '</li>').join("") + '</' + tag + '>'; }
      if (block.type === "image") { const url = fileURL(block.src); return url ? '<figure><img src="' + escape(url) + '" alt="' + escape(block.alt || block.caption || "공지 이미지") + '" loading="lazy" />' + (block.caption ? '<figcaption>' + escape(block.caption) + '</figcaption>' : "") + '</figure>' : ""; }
      if (block.type === "paragraph") return '<p>' + escape(block.text).replace(/\n/g, "<br />") + '</p>';
      return "";
    };
    function listHTML(s) {
      const select = [["all", "전체"], ["title", "제목"], ["body", "내용"]].map(([value, label]) => '<option value="' + value + '"' + (s.field === value ? ' selected' : "") + '>' + label + '</option>').join("");
      const search = '<form class="notice-search" id="noticeSearch" role="search" aria-label="공지사항 검색"><label class="sr-only" for="noticeField">검색 범위</label><select id="noticeField" name="field">' + select + '</select><label class="sr-only" for="noticeQuery">검색어</label><input type="search" id="noticeQuery" name="q" maxlength="200" placeholder="검색어" value="' + escape(s.q) + '" /><button type="submit">검색</button><a class="notice-reset" href="#news">전체보기</a></form>';
      const rows = s.matches.slice((s.page - 1) * 10, s.page * 10).map(item => '<tr' + (item.pinned ? ' class="pinned-notice"' : "") + '><td>' + (item.pinned ? '<span class="notice-pin">공지</span>' : String(notices.length - notices.indexOf(item))) + '</td><td class="notice-title-cell"><a href="' + escape(detailLink(item.id, s.listParams)) + '">' + (item.attachments.some(file => fileURL(file.path)) ? '<span class="attachment-mark" aria-label="첨부파일 있음">▤</span> ' : "") + escape(item.title) + '</a></td><td class="notice-author">' + escape(item.author) + '</td><td><time datetime="' + item.date + '">' + item.date + '</time></td></tr>').join("");
      const pageLink = (page, label, current = false) => { const p = new URLSearchParams(s.listParams); if (page === 1) p.delete("page"); else p.set("page", page); return '<a href="' + escape(route(p)) + '"' + (current ? ' aria-current="page"' : "") + ' aria-label="' + escape(label) + '">' + escape(label) + '</a>'; };
      const start = Math.max(1, Math.min(s.page - 2, s.totalPages - 4));
      let pagination = s.page > 1 ? pageLink(1, "처음") + pageLink(s.page - 1, "이전") : "";
      for (let page = start; page <= Math.min(s.totalPages, start + 4); page++) pagination += pageLink(page, String(page), page === s.page);
      if (s.page < s.totalPages) pagination += pageLink(s.page + 1, "다음") + pageLink(s.totalPages, "마지막");
      return search + '<p class="notice-count" role="status">전체게시물 <strong>' + notices.length + '</strong>' + (s.q ? ' / 검색결과 <strong>' + s.matches.length + '</strong>' : "") + ' / 현재페이지 <strong>' + s.page + '</strong></p><table class="notice-table"><caption class="sr-only">공지사항 게시물 목록</caption><thead><tr><th scope="col">번호</th><th scope="col">제목</th><th scope="col">작성자</th><th scope="col">날짜</th></tr></thead><tbody>' + (rows || emptyRow(s.q ? "검색 결과가 없습니다." : "등록된 공지사항이 없습니다.")) + '</tbody></table><nav class="notice-pagination" aria-label="공지 목록 페이지">' + pagination + '</nav>';
    }
    function detailHTML(item, s) {
      const attachments = item.attachments.filter(file => fileURL(file.path)).map(file => '<li><a href="' + escape(fileURL(file.path)) + '" download><span aria-hidden="true">▤</span> ' + escape(file.name || file.path.split("/").pop()) + '</a></li>').join("");
      const index = s.matches.indexOf(item);
      const adjacent = (label, neighbor) => '<div><span>' + label + '</span>' + (neighbor ? '<a href="' + escape(detailLink(neighbor.id, s.listParams)) + '">' + escape(neighbor.title) + '</a>' : '<span class="no-adjacent">' + label + '이 없습니다.</span>') + '</div>';
      return '<article class="notice-article" aria-labelledby="noticeArticleTitle"><h2 id="noticeArticleTitle">' + escape(item.title) + '</h2><div class="notice-meta"><span>작성자: ' + escape(item.author) + '</span><span>게시일: <time datetime="' + item.date + '">' + item.date + '</time></span><div class="notice-tools"><button type="button" data-notice-print aria-label="공지 인쇄">인쇄</button><button type="button" data-notice-copy>링크 복사</button></div></div>' + (attachments ? '<div class="notice-attachments"><strong>첨부파일</strong><ul>' + attachments + '</ul></div>' : "") + '<div class="notice-body">' + item.body.map(blockHTML).join("") + '</div><nav class="notice-adjacent" aria-label="이전 및 다음 공지">' + adjacent("이전 글", index >= 0 ? s.matches[index - 1] : null) + adjacent("다음 글", index >= 0 ? s.matches[index + 1] : null) + '</nav><div class="notice-footer"><a class="notice-list-button" href="' + escape(route(s.listParams)) + '">목록</a><p id="noticeActionStatus" role="status"></p></div></article>';
    }
    return {
      render(query = "") {
        const s = state(query), id = s.params.get("id");
        if (!id) return {html: listHTML(s), title: "공지사항"};
        const item = notices.find(item => item.id === id);
        return item ? {html: detailHTML(item, s), title: item.title} : {html: '<div class="notice-missing"><p>요청한 공지사항을 찾을 수 없습니다.</p><a class="notice-list-button" href="' + escape(route(s.listParams)) + '">목록</a></div>', title: "공지사항"};
      },
      homeHTML() { return notices.length ? notices.slice(0, 5).map(item => '<li><a href="' + escape(detailLink(item.id, new URLSearchParams())) + '"><time datetime="' + item.date + '">' + item.date.slice(5) + '</time><span>' + escape(item.title) + '</span></a></li>').join("") : '<li class="home-notice-empty">등록된 공지사항이 없습니다.</li>'; }
    };
  }
  window.CSDICNoticeBoard = {create};
})();
