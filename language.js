(() => {
  "use strict";
  const dictionary = window.CSDICEnglish || {};
  const storageKey = "csdic.language";
  const normalize = value => String(value).replace(/\s+/g, " ").trim();
  const valid = value => value === "ko" || value === "en";
  let language = "ko";
  const requested = new URLSearchParams(location.search).get("lang");
  try {
    const stored = localStorage.getItem(storageKey);
    language = valid(stored) ? stored : "ko";
  } catch { /* A blocked preference store must not prevent access to the site. */ }
  if (valid(requested)) {
    language = requested;
    try {localStorage.setItem(storageKey, language);} catch { /* Sharing a language-specific URL still works. */ }
  }
  const known = source => Object.hasOwn(dictionary, source) ? dictionary[source] : null;
  function english(source) {
    const direct = known(source);
    if (direct !== null) return direct;
    let match;
    if ((match = source.match(/^\((.+)\)$/)) && known(match[1])) return "(" + known(match[1]) + ")";
    if ((match = source.match(/^(.+) \| CSDIC$/)) && known(match[1])) return known(match[1]) + " | CSDIC";
    if ((match = source.match(/^상위 메뉴 선택: (.+)$/))) return "Select category: " + (known(match[1]) || match[1]);
    if ((match = source.match(/^하위 메뉴 선택: (.+)$/))) return "Select page: " + (known(match[1]) || match[1]);
    if ((match = source.match(/^(.+) 더 보기$/)) && known(match[1])) return "More " + known(match[1]);
    if ((match = source.match(/^등록된 (.+) 게시물이 없습니다\.$/))) return "No posts in " + (known(match[1]) || match[1]) + ".";
    if ((match = source.match(/^(.+) (검색|게시물 목록|목록 페이지|관리)$/)) && known(match[1])) {
      const suffix = {"검색":"search", "게시물 목록":"post list", "목록 페이지":"list pages", "관리":"administration"};
      return known(match[1]) + " " + suffix[match[2]];
    }
    if ((match = source.match(/^(.+) (글쓰기|수정)$/)) && known(match[1])) return (match[2] === "글쓰기" ? "New post: " : "Edit: ") + known(match[1]);
    if ((match = source.match(/^행사 사진 (\d+)부터 보기$/))) return "View from event photo " + match[1];
    if ((match = source.match(/^(이전 글|다음 글)이 없습니다\.$/))) return match[1] === "이전 글" ? "No previous post." : "No next post.";
    if ((match = source.match(/^(.+) 회원 상태$/))) return "Membership status for " + match[1];
    if ((match = source.match(/^(.+) 계정의 새 비밀번호를 입력해 주세요\.$/))) return "Enter a new password for " + match[1] + ".";
    if ((match = source.match(/^“(.+)” (게시물과 사진·첨부파일|문서와 원본 파일)을 삭제할까요\? 삭제한 자료는 복구할 수 없습니다\.$/))) {
      return "Delete “" + match[1] + "” and " + (match[2] === "문서와 원본 파일" ? "its original file" : "its photos and attachments") + "?\nDeleted material cannot be recovered.";
    }
    return source;
  }
  function t(value, locale = language) {
    const original = String(value ?? "");
    if (locale !== "en") return original;
    const source = normalize(original);
    if (!source) return original;
    const translated = english(source);
    if (translated === source) return original;
    return original.match(/^\s*/)[0] + translated + original.match(/\s*$/)[0];
  }
  const textSources = new WeakMap(), attributeSources = new WeakMap();
  const protectedContent = [
    'script', 'style', 'noscript', '[translate="no"]', '[data-no-translate]',
    '.notice-body', '.notice-title-cell a', '.notice-author', '#noticeArticleTitle',
    '.notice-adjacent a', '.notice-list a>span', '.gallery-card>span',
    '.community-gallery-card h2', '.community-gallery-card p', '.community-gallery-card img', '.gallery-card img',
    '.member-document h3', '.member-document p', '.member-document small'
  ].join(",");
  const boardRoutes = new Set(["news", "press", "recruit", "gallery", "qna"]);
  function routeState() {
    const [route = "home", query = ""] = location.hash.slice(1).split("?");
    return {route, params:new URLSearchParams(query)};
  }
  function isProtected(element) {
    if (!element || element.closest(protectedContent)) return true;
    const state = routeState();
    return element.tagName === "TITLE" && boardRoutes.has(state.route) && state.params.has("id");
  }
  function renderText(node) {
    if (isProtected(node.parentElement) || node.parentElement.tagName === "TEXTAREA") return;
    const current = node.nodeValue;
    const previous = textSources.get(node);
    const source = previous && (current === previous.rendered || current === previous.source) ? previous.source : current;
    const rendered = t(source);
    textSources.set(node, {source, rendered});
    if (current !== rendered) node.nodeValue = rendered;
  }
  const attributes = ["aria-label", "title", "placeholder", "alt"];
  function renderAttributes(element) {
    if (isProtected(element)) return;
    let records = attributeSources.get(element);
    if (!records) {records = new Map(); attributeSources.set(element, records);}
    const names = element.matches('meta[name="description"]') ? [...attributes, "content"] : attributes;
    for (const name of names) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      const previous = records.get(name);
      const source = previous && (current === previous.rendered || current === previous.source) ? previous.source : current;
      const rendered = t(source);
      records.set(name, {source, rendered});
      if (current !== rendered) element.setAttribute(name, rendered);
    }
  }
  let observer, active = false;
  function apply() {
    if (!document.body || active) return;
    active = true;
    observer?.disconnect();
    try {
      document.documentElement.lang = language;
      const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) renderText(node);
      document.querySelectorAll('[aria-label],[title],[placeholder],[alt],meta[name="description"]').forEach(renderAttributes);
      document.querySelectorAll("[data-language-switch]").forEach(group => group.setAttribute("aria-label", language === "en" ? "Language" : "언어 선택"));
      document.querySelectorAll("[data-set-language]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.setLanguage === language)));
      const note = document.getElementById("contentLanguageNote"), state = routeState();
      if (note) note.hidden = !(language === "en" && (boardRoutes.has(state.route) || state.route === "resources"));
      const map = document.querySelector(".location-map iframe");
      if (map) {
        const url = new URL(map.src);
        if (url.hostname === "maps.google.com" && url.searchParams.get("hl") !== language) {url.searchParams.set("hl", language); map.src = url.href;}
      }
    } finally {
      active = false;
      observer?.observe(document.documentElement, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
    }
  }
  function setLanguage(next) {
    if (!valid(next)) return;
    language = next;
    try {localStorage.setItem(storageKey, language);} catch { /* The current page can still switch languages. */ }
    // Keep the current route, search state and form values. Never rewrite auth callback parameters.
    if (!location.pathname.endsWith("/auth.html")) {
      const url = new URL(location.href); url.searchParams.set("lang", language);
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
    apply();
  }
  function start() {
    observer = new MutationObserver(() => apply());
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-set-language]");
      if (button) setLanguage(button.dataset.setLanguage);
    });
    addEventListener("hashchange", apply);
    apply();
  }
  window.CSDICLanguage = Object.freeze({t, apply, setLanguage, getLanguage:() => language});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
