if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const centerName = "화합물 반도체설계 지원센터";
const address = "경기 성남시 수정구 성남대로 1342 가천대학교 반도체대학";
const mapPlace = "가천대학교 반도체대학";
const menuOpen = $("#menuOpen"), menuClose = $("#menuClose"), sideMenu = $("#sideMenu"), backdrop = $("#drawerBackdrop"), megaMenu = $("#megaMenu");
const navLinks = $$(".nav-link"), megaCols = $$(".mega-col");
let closeTimer;
const groups = megaCols.map(col => ({key: col.dataset.col, title: $("h3", col).textContent, links: $$("a", col).map(a => ({route: a.hash.slice(1), title: a.textContent}))}));
const routes = Object.create(null);
groups.forEach(group => group.links.forEach(link => { routes[link.route] = {...link, group}; }));
const accountLinks = [{route:"login",title:"로그인"},{route:"join",title:"회원가입"},{route:"reset",title:"비밀번호 찾기"},{route:"account",title:"내 회원정보"},{route:"resources",title:"회원 자료실"},{route:"member-admin",title:"회원 관리"}];
accountLinks.forEach(link => {routes[link.route] = {...link,group:{key:"account",title:"회원 서비스",links:accountLinks.filter(item=>item.route!=="member-admin")}};});
function highlightMenu(key) {
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.menu === key));
  megaCols.forEach(col => col.classList.toggle("active", col.dataset.col === key));
}
function openMega(key) {
  if (matchMedia("(max-width:960px)").matches) return;
  clearTimeout(closeTimer);
  highlightMenu(key);
  megaMenu.classList.add("open");
  megaMenu.inert = false;
  megaMenu.setAttribute("aria-hidden", "false");
  navLinks.forEach(a => a.setAttribute("aria-expanded", "true"));
}
function closeMega(immediate = false) {
  clearTimeout(closeTimer);
  const close = () => {
    megaMenu.classList.remove("open"); megaMenu.inert = true;
    megaMenu.setAttribute("aria-hidden", "true");
    navLinks.forEach(a => a.setAttribute("aria-expanded", "false"));
    megaCols.forEach(col => col.classList.remove("active"));
    const current = routes[location.hash.slice(1).split("?")[0]];
    highlightMenu(current?.group.key);
  };
  if (immediate) close(); else closeTimer = setTimeout(close, 150);
}
navLinks.forEach(a => {
  a.addEventListener("mouseenter", () => openMega(a.dataset.menu));
  a.addEventListener("focus", () => openMega(a.dataset.menu));
  a.addEventListener("click", () => closeMega(true));
});
$(".nav-shell").addEventListener("mouseleave", () => closeMega());
megaMenu.addEventListener("mouseenter", () => clearTimeout(closeTimer));
megaMenu.addEventListener("focusout", event => {
  if (!event.relatedTarget || !$(".nav-shell").contains(event.relatedTarget)) closeMega();
});
megaMenu.addEventListener("click", event => { if (event.target.closest("a")) closeMega(true); });
function openDrawer() {
  closeMega(true); sideMenu.inert = false; sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden", "false"); backdrop.hidden = false;
  document.body.classList.add("menu-open"); menuOpen.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => menuClose.focus());
}
function closeDrawer(restoreFocus = false) {
  if (!sideMenu.classList.contains("open")) return;
  sideMenu.classList.remove("open"); sideMenu.inert = true;
  sideMenu.setAttribute("aria-hidden", "true"); backdrop.hidden = true;
  document.body.classList.remove("menu-open"); menuOpen.setAttribute("aria-expanded", "false");
  if (restoreFocus) menuOpen.focus();
}
menuOpen.addEventListener("click", openDrawer);
menuClose.addEventListener("click", () => closeDrawer(true));
backdrop.addEventListener("click", () => closeDrawer(true));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") { closeDrawer(true); closeMega(true); }
  if (event.key === "Tab" && sideMenu.classList.contains("open")) {
    const controls = $$("button, a", sideMenu).filter(el => el.closest(".side-panel")?.classList.contains("active") || !el.closest(".side-panel"));
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
$$(".side-tabs button").forEach(button => button.addEventListener("click", () => {
  $$(".side-tabs button").forEach(b => b.classList.toggle("active", b === button));
  $$(".side-panel").forEach(panel => panel.classList.toggle("active", panel.id === button.dataset.panel));
}));
$$(".side-panel a").forEach(a => a.addEventListener("click", () => closeDrawer()));
addEventListener("resize", () => { if (matchMedia("(max-width:960px)").matches) closeMega(true); });

const noticeTabs = $$("[data-notice]");
function selectNotice(button) {
  noticeTabs.forEach(tab => {
    const selected = tab === button;
    tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
    $("#" + tab.getAttribute("aria-controls")).hidden = !selected;
  });
  const route = {notice: "news", recruit: "recruit", press: "press"}[button.dataset.notice];
  $("#noticeMore").href = "#" + route;
  $("#noticeMore").setAttribute("aria-label", button.textContent + " 더 보기");
}
noticeTabs.forEach((button, index) => {
  button.addEventListener("click", () => selectNotice(button));
  button.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % noticeTabs.length;
    if (event.key === "ArrowLeft") next = (index + noticeTabs.length - 1) % noticeTabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = noticeTabs.length - 1;
    if (next !== undefined) { event.preventDefault(); noticeTabs[next].focus(); selectNotice(noticeTabs[next]); }
  });
});
const noticeBoard = window.CSDICNoticeBoard.create(window.CSDIC_NOTICES);
const communityData = window.CSDIC_COMMUNITY || {};
const communityBoards = {
  news: noticeBoard,
  press: window.CSDICNoticeBoard.create(communityData.press, {route: "press", title: "대외홍보", emptyText: "등록된 대외홍보 게시물이 없습니다."}),
  recruit: window.CSDICNoticeBoard.create(communityData.recruit, {route: "recruit", title: "채용", emptyText: "등록된 채용 공고가 없습니다."}),
  gallery: window.CSDICNoticeBoard.create(communityData.gallery, {route: "gallery", title: "갤러리", layout: "gallery", emptyText: "등록된 행사 사진이 없습니다."}),
  qna: window.CSDICNoticeBoard.create(communityData.qna, {route: "qna", title: "Q&A", emptyText: "등록된 Q&A 게시물이 없습니다."})
};
$("#notice-content").innerHTML = noticeBoard.homeHTML();
$("#recruit-content").innerHTML = communityBoards.recruit.homeHTML();
$("#press-content").innerHTML = communityBoards.press.homeHTML();

const galleryTrack = $("#galleryTrack");
galleryTrack.innerHTML = communityBoards.gallery.homeGalleryHTML();
let originalGallery = $$(".gallery-card", galleryTrack).map(card => card.outerHTML);
$("#galleryPrev").hidden = originalGallery.length < 2;
$("#galleryNext").hidden = originalGallery.length < 2;
$(".gallery-dots").innerHTML = originalGallery.length > 1 ? originalGallery.map((_, index) => '<button type="button" data-gallery-index="' + index + '" aria-label="행사 사진 ' + (index + 1) + '부터 보기" aria-current="' + String(index === 0) + '"></button>').join("") : "";
let galleryIndex = 0;
function showGallery(index) {
  if (!originalGallery.length) return;
  galleryIndex = (index + originalGallery.length) % originalGallery.length;
  galleryTrack.innerHTML = [...originalGallery.slice(galleryIndex), ...originalGallery.slice(0, galleryIndex)].join("");
  window.CSDICCommunityUI?.observeImages(galleryTrack);
  $$("[data-gallery-index]").forEach(button => button.setAttribute("aria-current", String(Number(button.dataset.galleryIndex) === galleryIndex)));
}
$("#galleryPrev").addEventListener("click", () => showGallery(galleryIndex - 1));
$("#galleryNext").addEventListener("click", () => showGallery(galleryIndex + 1));
$(".gallery-dots").addEventListener("click", event => {
  const button=event.target.closest("[data-gallery-index]");
  if(button) showGallery(Number(button.dataset.galleryIndex));
});
window.CSDICHomeGallery=Object.freeze({setHTML(html) {
  galleryTrack.innerHTML=html;
  originalGallery=$$(".gallery-card",galleryTrack).map(card=>card.outerHTML);
  galleryIndex=0;
  $("#galleryPrev").hidden=$("#galleryNext").hidden=originalGallery.length<2;
  $(".gallery-dots").innerHTML=originalGallery.length>1?originalGallery.map((_,index)=>'<button type="button" data-gallery-index="'+index+'" aria-label="행사 사진 '+(index+1)+'부터 보기" aria-current="'+String(index===0)+'"></button>').join(""):"";
  window.CSDICCommunityUI?.observeImages(galleryTrack);
}});
$("#backTop").addEventListener("click", () => scrollTo({top: 0, behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth"}));

const lead = text => '<div class="content-lead"><p>' + text + '</p></div>';
const card = (title, text, route, label = "자세히 보기") => '<article class="feature-card"><h3>' + title + '</h3><p>' + text + '</p>' + (route ? '<a href="#' + route + '">' + label + '</a>' : "") + '</article>';
const programs = [
  ["인력양성", "회로 설계와 EDA 실습, MPW 프로젝트를 연계한 전문인력 양성", "education"],
  ["기술개발", "화합물반도체 회로 설계, 검증 및 측정 데이터 기반 기술 지원", "research"],
  ["기반조성", "EDA 설계환경과 공동활용 기반, 설계·측정 데이터 관리체계 조성", "facility"],
  ["기업지원", "설계 자문, MPW 제작 연계 및 시제품 검증을 위한 산학협력 지원", "support"]
];
const businessPrograms = {
  workforce: {title: "인력양성", points: [
    "화합물반도체 회로 설계의 기초 이론과 실무를 연결하는 교육과정 운영 추진",
    "ADS·Cadence 등 EDA 도구를 활용한 회로 설계 및 레이아웃 실습",
    "PDK 활용, DRC/LVS 검증과 MPW 제출 과정을 다루는 설계 프로젝트 교육",
    "대학·기업과 연계한 기술교류 및 재직자 설계교육 지원"
  ], heading: "설계교육 주요 분야", items: ["전자회로 기초", "RF 회로 설계", "MMIC 설계", "ADS 실습", "Cadence 실습", "전자기 해석", "PDK 활용", "DRC·LVS 검증", "MPW 설계", "측정 결과 해석", "프로젝트 실습"]},
  technology: {title: "기술개발", points: [
    "GaN·GaAs 등 화합물반도체 기반 고주파·고출력 회로 설계 기술 지원",
    "파운드리 PDK를 활용한 회로 시뮬레이션 및 레이아웃 설계 검토",
    "DRC/LVS 사전 검증과 제출 규격 검토를 통한 MPW 제작 준비 지원",
    "레티클 설계와 Fab-in 제출을 위한 파운드리 연계 업무 추진",
    "소자 및 회로 측정 결과를 활용한 모델링 검토와 설계 개선 지원",
    "설계·검증 사례와 IP 정보를 축적하는 기술지원 기반 마련"
  ]},
  infrastructure: {title: "기반조성", points: [
    "화합물반도체 설계 연구와 교육을 위한 EDA 공동활용 환경 조성",
    "참여기관의 설계 검증 및 측정·분석을 위한 협력기관 연계",
    "설계·공정·측정 자료를 축적하고 활용하는 데이터 관리체계 마련"
  ], heading: "공동활용 지원 기반", items: ["EDA 설계환경", "설계·검증 자료", "측정·분석 연계", "설계교육 공간"]},
  enterprise: {title: "기업지원", points: [
    "기업의 기술 수요에 맞춘 화합물반도체 회로 설계 및 검증 자문",
    "MPW 제작과 패키징·측정 연계를 통한 시제품 검증 지원",
    "산학연 협력을 통한 후속 연구, 기술이전 및 사업화 연계 추진",
    "MOSIS 업무협약(MOU)을 바탕으로 설계·제작 국제협력 기반 확대 추진"
  ], heading: "기업지원 분야", items: ["설계 자문", "MPW 제작 연계", "성능 검증 연계", "산학연 협력"]}
};
function businessContent(key) {
  const program = businessPrograms[key];
  const tabs = Object.entries(businessPrograms).map(([id, item]) => '<a class="business-tab" id="program-tab-' + id + '" href="#business?program=' + id + '" role="tab" aria-selected="' + String(id === key) + '" aria-controls="businessDetail" tabindex="' + (id === key ? 0 : -1) + '">' + item.title + '</a>').join("");
  return '<div class="business-tabs" role="tablist" aria-label="사업 분야">' + tabs + '</div><section class="business-detail' + (program.heading ? "" : " business-detail--text") + '" id="businessDetail" role="tabpanel" aria-labelledby="program-tab-' + key + '" tabindex="0"><ul class="business-points">' + program.points.map(text => '<li>' + escapeHTML(text) + '</li>').join("") + '</ul>' + (program.heading ? '<h2 class="business-subtitle">' + program.heading + '</h2>' : "") + (program.items?.length ? '<div class="business-items">' + program.items.map(text => '<div>' + escapeHTML(text) + '</div>').join("") + '</div>' : "") + (program.note ? '<p class="business-note">' + escapeHTML(program.note) + '</p>' : "") + '</section>';
}
$("#pageContent").addEventListener("keydown", event => {
  const tab = event.target.closest(".business-tab");
  if (!tab) return;
  const tabs = $$(".business-tab");
  const index = tabs.indexOf(tab);
  let next;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
  if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = tabs.length - 1;
  if (next !== undefined) { event.preventDefault(); location.hash = tabs[next].hash; }
});
function visionContent() {
  const icons = {
    people: '<circle cx="16" cy="7" r="4"/><path d="M9 22v-5a7 7 0 0 1 14 0v5M5 13a3 3 0 1 0 0-6M27 13a3 3 0 1 1 0-6M2 23v-5a5 5 0 0 1 5-5M30 23v-5a5 5 0 0 0-5-5M6 28h20M16 22v6"/>',
    building: '<path d="M7 29V3h18v26M3 29h26M13 29v-7h6v7M12 8h1M19 8h1M12 13h1M19 13h1M12 18h1M19 18h1"/>',
    network: '<rect x="11" y="2" width="10" height="7" rx="1"/><rect x="2" y="23" width="10" height="7" rx="1"/><rect x="20" y="23" width="10" height="7" rx="1"/><path d="M16 9v7M7 23v-7h18v7"/>',
    pin: '<path d="M16 30S6 20 6 12a10 10 0 0 1 20 0c0 8-10 18-10 18Z"/><circle cx="16" cy="12" r="3"/>'
  };
  const goals = [
    ["설계·검증 역량 강화", "회로 설계, 레이아웃 검증 및 측정 결과 분석"],
    ["MPW 연계 지원체계 구축", "참여기관의 설계 결과를 상용 파운드리 제작으로 연결"],
    ["설계 전문인력 양성", "EDA 실습과 설계 프로젝트를 통한 현장 역량 확보"]
  ];
  const strategies = [
    {icon: "people", label: "인력양성", title: "설계 실무교육", points: ["회로 이론과 EDA 실습을 연계한 교육", "MPW 설계 사례를 활용한 프로젝트 교육"]},
    {icon: "building", label: "기술지원", title: "설계·검증 지원", points: ["PDK 기반 회로 및 레이아웃 설계 지원", "DRC/LVS 검토와 측정 결과 분석 지원"]},
    {icon: "network", label: "인프라 조성", title: "설계환경과 데이터", points: ["EDA 설계환경 및 공동활용 기반 조성", "파운드리 : Win-Semi, Wavice"]},
    {icon: "pin", label: "산학연 협력", title: "제작과 사업화 연계", points: ["MOSIS 업무협약과 국내외 협력기관 연계", "기술자문과 후속 연구·사업화 협력"]}
  ];
  return '<div class="vision-overview"><h2>화합물반도체 설계와 구현을 연결하는 지원 거점</h2><p>가천대학교 화합물 반도체설계 지원센터 CSDIC는 대학·연구기관·기업의 설계교육과 검증, MPW 제작 연계를 지원합니다. 모시스(MOSIS)와 업무협약(MOU)을 체결하고 국제협력 기반을 넓혀가고자 합니다.<br><span lang="en">Compound Semiconductor Design and Implementation Center, CSDIC</span></p></div>' +
    '<section class="vision-section" aria-labelledby="visionGoalsTitle"><h2 id="visionGoalsTitle">[ 목표 ]</h2><p class="vision-statement">설계·검증·MPW 제작 연계를 통한 화합물반도체 설계 지원체계 구축</p><div class="vision-goals">' + goals.map(([title, detail]) => '<article class="vision-goal"><h3>' + title + '</h3><p>(' + detail + ')</p></article>').join("") + '</div></section>' +
    '<section class="vision-section" aria-labelledby="visionStrategyTitle"><h2 id="visionStrategyTitle">[ 추진전략 ]</h2><p class="vision-statement">설계 경험과 검증 데이터를 축적하는 산학연 협력 기반 조성</p><div class="vision-strategies">' + strategies.map(item => '<article class="vision-strategy"><div class="vision-strategy-label"><svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + icons[item.icon] + '</svg><span>' + item.label + '</span></div><div class="vision-strategy-body"><h3>' + item.title + '</h3><ul>' + item.points.map(point => '<li>' + point + '</li>').join("") + '</ul></div></article>').join("") + '</div></section>';
}
const content = {
  vision: visionContent(),
  ...window.CSDICPageContent.create({lead, card}),
  ui: '<h2>CSDIC</h2><div class="logo-showcase"><img src="assets/csdic-logo.png" width="708" height="105" alt="CSDIC Compound Semiconductor Design and Implementation Center"></div><p>화합물 반도체설계 지원센터 CSDIC는 가천대학교를 기반으로 설계 연구와 교육, MPW 제작 연계를 지원하는 센터입니다.<br>Compound Semiconductor Design and Implementation Center</p>',
  location: '<div class="address-card"><h2>가천대학교 화합물 반도체설계 지원센터 CSDIC</h2><address>' + address + '</address><div class="location-map"><iframe title="가천대학교 반도체대학 위치 지도" src="https://maps.google.com/maps?q=' + encodeURIComponent(mapPlace) + '&amp;hl=ko&amp;z=17&amp;output=embed" width="100%" height="450" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></div>',
  login: '<h2>로그인</h2><div class="empty-content">로그인 기능을 불러오고 있습니다.</div>',
  join: '<h2>회원가입</h2><div class="empty-content">회원가입 기능을 불러오고 있습니다.</div>'
};

function renderBreadcrumb(page, title) {
  const group = page?.group;
  const categoryGroups = group?.key === "account" ? [...groups, group] : groups;
  const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg>';
  const dropdown = (label, text, links) => '<details class="crumb-dropdown"><summary class="crumb-trigger" role="button" aria-expanded="false" aria-label="' + label + ': ' + escapeHTML(text) + '">' + escapeHTML(text) + arrow + '</summary><div class="crumb-options">' + links + '</div></details>';
  const categoryLinks = categoryGroups.map(item => '<a href="#' + item.links[0].route + '"' + (item.key === group?.key ? ' aria-current="page"' : "") + '>' + escapeHTML(item.title) + '</a>').join("");
  const pageLinks = (group?.links || []).map(item => '<a href="#' + item.route + '"' + (item.route === page?.route ? ' aria-current="page"' : "") + '>' + escapeHTML(item.title) + '</a>').join("");
  $("#breadcrumbNav").innerHTML = '<a class="crumb-home" href="#home" aria-label="홈으로 이동"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5v2.5h-3v8h-5v-6h-2v6H6v-8H3z"/></svg></a>' + dropdown("상위 메뉴 선택", group?.title || "안내", categoryLinks) + (pageLinks ? dropdown("하위 메뉴 선택", title, pageLinks) : '<span class="crumb-trigger">' + escapeHTML(title) + '</span>');
}
const breadcrumbNav = $("#breadcrumbNav");
breadcrumbNav.addEventListener("toggle", event => {
  const details = event.target;
  if (!details.matches(".crumb-dropdown")) return;
  $("summary", details).setAttribute("aria-expanded", String(details.open));
  if (details.open) $$(".crumb-dropdown", breadcrumbNav).forEach(other => { if (other !== details) other.open = false; });
}, true);
document.addEventListener("click", event => {
  if (!breadcrumbNav.contains(event.target)) $$(".crumb-dropdown", breadcrumbNav).forEach(details => { details.open = false; });
});
breadcrumbNav.addEventListener("keydown", event => {
  const details = event.target.closest(".crumb-dropdown");
  if (!details) return;
  const summary = $("summary", details), links = $$("a", details);
  if (event.key === "Escape") { event.preventDefault(); details.open = false; summary.focus(); return; }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !links.length) return;
  event.preventDefault(); details.open = true;
  const current = links.indexOf(event.target);
  let next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : event.key === "ArrowDown" ? (current + 1) % links.length : (current < 0 ? links.length - 1 : (current - 1 + links.length) % links.length);
  links[next].focus();
});

let renderedRoute;
function renderPage(initial = false) {
  let route;
  const [rawRoute, rawQuery = ""] = location.hash.slice(1).split("?");
  const requestedProgram = new URLSearchParams(rawQuery).get("program");
  const selectedProgram = Object.hasOwn(businessPrograms, requestedProgram) ? requestedProgram : "workforce";
  try { route = decodeURIComponent(rawRoute); } catch { route = "home"; }
  if (route === "main") return;
  window.CSDICCommunityUI?.stop();
  if (!route || route === "top") route = "home";
  closeDrawer(); closeMega(true);
  const home = route === "home";
  $("#homePage").hidden = !home;
  $("#innerPage").hidden = home;
  $("#innerPage").classList.toggle("business-page", route === "business");
  $("#innerPage").classList.toggle("vision-page", route === "vision");
  const isMember = window.CSDICMembers?.routes.has(route) || false;
  $("#innerPage").classList.toggle("member-page", isMember);
  const isBoard = Object.hasOwn(communityBoards, route);
  $("#innerPage").classList.toggle("notice-page", isBoard);
  $(".page-banner").classList.toggle("wrap", route === "business" || route === "vision" || isBoard || isMember);
  if (home) {
    document.title = "CSDIC | " + centerName;
    highlightMenu(null);
  } else {
    const page = routes[route];
    const title = page?.title || "페이지를 찾을 수 없습니다";
    $("#pageTitle").textContent = title;
    $("#pageCategory").textContent = page?.group.title || "CSDIC";
    renderBreadcrumb(page, title);
    $("#subnav").innerHTML = (page?.group.links || []).map(link => '<a href="#' + link.route + '"' + (link.route === route ? ' aria-current="page"' : "") + '>' + escapeHTML(link.title) + '</a>').join("");
    const noticeView = isBoard ? communityBoards[route].render(rawQuery) : null;
    $("#pageContent").innerHTML = noticeView ? noticeView.html : route === "business" ? businessContent(selectedProgram) : (Object.hasOwn(content, route) ? content[route] : "") || (page ? '<h2>' + escapeHTML(title) + '</h2><div class="empty-content">관련 자료를 준비 중입니다.</div>' : '<div class="empty-content">요청하신 페이지가 없습니다. <a href="#home">홈으로 이동</a></div>');
    document.title = (noticeView?.title || title) + " | CSDIC";
    highlightMenu(page?.group.key);
  }
  // Only the selected page is visible; menu clicks never scroll between sections.
  scrollTo({top: 0, left: 0, behavior: "instant"});
  if (!initial) {
    const target = route === "business" && renderedRoute === "business" ? $(".business-tab[aria-selected=\"true\"]") : home ? $("#newsTitle") : $("#pageTitle");
    if (!target.classList.contains("business-tab")) target.tabIndex = -1;
    target.focus({preventScroll: true});
  }
  renderedRoute = route;
  window.CSDICMembers?.render(route);
  if (home) window.CSDICCommunityUI?.renderHome();
  else window.CSDICCommunityUI?.render(route,rawQuery);
}
addEventListener("hashchange", () => renderPage());
renderPage(true);

$("#pageContent").addEventListener("submit", event => {
  if (event.target.id !== "noticeSearch") return;
  event.preventDefault();
  const params = new URLSearchParams();
  const query = $("#noticeQuery").value.trim();
  if (query) { params.set("q", query); params.set("field", $("#noticeField").value); }
  const boardRoute = event.target.dataset.boardRoute;
  if (new URLSearchParams(location.hash.split("?")[1]||"").get("drafts")==="1") params.set("drafts","1");
  if (Object.hasOwn(communityBoards, boardRoute)) location.hash = boardRoute + (params.toString() ? "?" + params.toString() : "");
});
$("#pageContent").addEventListener("click", async event => {
  if (event.target.closest("[data-notice-print]")) { window.print(); return; }
  if (!event.target.closest("[data-notice-copy]")) return;
  const status = $("#noticeActionStatus");
  try { await navigator.clipboard.writeText(location.href); if (status?.isConnected) status.textContent = "게시물 링크를 복사했습니다."; }
  catch { if (status?.isConnected) status.textContent = "주소창의 링크를 복사해 주세요."; }
});
