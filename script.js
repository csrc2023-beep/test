if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const centerName = "화합물 반도체 설계 센터";
const address = "경기 성남시 수정구 성남대로 1342 가천대학교";
const menuOpen = $("#menuOpen"), menuClose = $("#menuClose"), sideMenu = $("#sideMenu"), backdrop = $("#drawerBackdrop"), megaMenu = $("#megaMenu");
const navLinks = $$(".nav-link"), megaCols = $$(".mega-col");
let closeTimer;
const groups = megaCols.map(col => ({key: col.dataset.col, title: $("h3", col).textContent, links: $$("a", col).map(a => ({route: a.hash.slice(1), title: a.textContent}))}));
const routes = Object.create(null);
groups.forEach(group => group.links.forEach(link => { routes[link.route] = {...link, group}; }));
["login", "join"].forEach(route => { routes[route] = {route, title: route === "login" ? "로그인" : "회원가입", group: {key: "account", title: "회원 서비스", links: [{route: "login", title: "로그인"}, {route: "join", title: "회원가입"}]}}; });
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
const galleryTrack = $("#galleryTrack"), originalGallery = $$(".gallery-card", galleryTrack).map(card => card.outerHTML);
let galleryIndex = 0;
function showGallery(index) {
  galleryIndex = (index + originalGallery.length) % originalGallery.length;
  galleryTrack.innerHTML = [...originalGallery.slice(galleryIndex), ...originalGallery.slice(0, galleryIndex)].join("");
  $$("[data-gallery-index]").forEach(button => button.setAttribute("aria-current", String(Number(button.dataset.galleryIndex) === galleryIndex)));
}
$("#galleryPrev").addEventListener("click", () => showGallery(galleryIndex - 1));
$("#galleryNext").addEventListener("click", () => showGallery(galleryIndex + 1));
$$("[data-gallery-index]").forEach(button => button.addEventListener("click", () => showGallery(Number(button.dataset.galleryIndex))));
$("#backTop").addEventListener("click", () => scrollTo({top: 0, behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth"}));

const lead = text => '<div class="content-lead"><p>' + text + '</p></div>';
const card = (title, text, route, label = "자세히 보기") => '<article class="feature-card"><h3>' + title + '</h3><p>' + text + '</p>' + (route ? '<a href="#' + route + '">' + label + '</a>' : "") + '</article>';
const programs = [
  ["인력양성", "GaAs/GaN, RF/MMIC 설계 및 실무 중심 전문교육", "education"],
  ["기술개발", "화합물반도체 소자 및 집적회로 설계 기술 연구개발", "research"],
  ["기반조성", "EDA, 측정, 분석 및 공동활용 인프라 구축", "facility"],
  ["기업지원", "기술자문, 시제품, 시험·평가 및 산학협력 지원", "support"]
];
const businessPrograms = {
  workforce: {title: "인력양성", points: [
    "GaN 및 GaAs 기반 설계 및 Package & Test(후공정) 전문인력 양성",
    "고교, 전문대학, 학사·석사·박사 프로그램 설계",
    "재직자 대상 화합물반도체 기반 MMIC 및 EDA Tool 교육",
    "반도체 후공정·설계 관련 채용연계 프로그램 개발 및 운영"
  ], heading: "대학협력체계 (11개)", items: ["연세대학교", "경북대학교", "충남대학교", "서울시립대학교", "한밭대학교", "한국교통대학교", "성균관대학교", "전남대학교", "전북대학교", "부산대학교", "대구대학교"]},
  technology: {title: "기술개발", points: [
  "참여교수, 대학(원)생 및 기업체에게 다양한 상용화 설계 서비스(MPW) 제공",
  "대만 Winsemi 社(화합물반도체 파운드리)와 연계하여 전국 대학 및 기업에 설계기회 제공",
  "화합물반도체 (GaN/GaAs 등) 기반 소자 개발 (원천기술)",
  "고주파/고전력 화합물반도체 (GaN/GaAs 등) 기반 IC 설계 및 TEST기법",
  "화합물반도체 (GaN/GaAs 등)와 연동 가능한 Si기반 IC설계 및 TEST기법",
  "고주파/고전력 화합물반도체 패키지 및 bare-die 모델링/신뢰성/열해석"
]},
  infrastructure: {title: "기반조성", points: [
    "화합물반도체 설계에 필요한 공동활용 인프라 구축",
    "EDA Tool 및 설계 환경 지원",
    "측정·분석 및 장비·교육실 공동활용 지원"
  ], heading: "공동활용 인프라", items: ["EDA Tool", "측정·분석", "장비", "교육실"]},
  enterprise: {title: "기업지원", points: [
    "GaN/GaAs 기반 IC 설계 및 기업 기술지원",
    "기술자문, 시제품 및 시험·평가 지원",
    "모델링 및 산학협력 지원"
  ], heading: "기업지원 분야", items: ["IC 설계", "기술자문", "시험·평가", "모델링"]}
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
const noticeEntries = $$(".notice-list li").map(li => ({text: $("span", li).textContent, date: $("time", li).textContent, route: $("a", li).hash}));
const content = {
  vision: '<h2>화합물반도체 설계와 산업을 연결하는 전문센터</h2>' + lead("CSDIC는 화합물반도체 설계, MPW, 교육, EDA 및 기업지원 체계를 통해 연구성과가 실제 구현으로 이어질 수 있도록 지원합니다.") + '<div class="feature-grid">' + card("GaAs", "High Frequency") + card("GaN", "High Power") + card("RF", "MMIC Design") + card("MPW", "Implementation", "mpw") + '</div>',
  research: '<h2>연구개발소개</h2>' + lead("화합물반도체 소자 및 집적회로 설계 기술을 연구합니다.") + '<div class="feature-grid">' + card("GaAs/GaN 소자", "고주파 및 고출력 화합물반도체 소자 설계") + card("RF/MMIC 설계", "RF 및 마이크로파 집적회로 설계") + '</div>',
  education: '<h2>설계교육부터 MPW까지</h2>' + lead("교육, 설계, 검증, 제작으로 이어지는 지원 체계를 구축합니다.") + '<div class="feature-grid">' + card("설계 교육", "GaAs/GaN, RF/MMIC 설계 및 실무 중심 전문교육", "education-apply", "교육신청 안내") + card("온라인강의", "온라인 교육자료 및 강의 안내", "online", "온라인강의 보기") + '</div>',
  mpw: '<h2>MPW 참여안내</h2>' + lead("화합물반도체 설계와 검증, 제작을 위한 MPW 지원 프로그램입니다.") + '<div class="feature-grid">' + card("MPW 신청", "신청 관련 안내를 확인하세요.", "mpw-apply", "신청 안내 보기") + card("설계 지원", "설계에 필요한 EDA Tool과 시설 안내를 확인하세요.", "facility", "EDA Tool 안내") + '</div>',
  support: '<h2>기업협업센터</h2>' + lead("기술자문, 시제품, 시험·평가 및 산학협력을 지원합니다.") + '<div class="feature-grid">' + card("산학협력", "화합물반도체 설계 기술의 공동연구 및 기업협력") + card("채용연계프로그램", "채용연계프로그램 관련 안내", "recruit-program") + '</div>',
  facility: '<h2>EDA Tool</h2>' + lead("화합물반도체 설계를 위한 EDA, 측정, 분석 및 공동활용 인프라를 지원합니다.") + '<div class="feature-grid">' + card("시설이용안내", "공동활용 시설의 이용 안내를 확인하세요.", "facility-guide") + card("장비/교육실현황", "장비 및 교육실 안내를 확인하세요.", "equipment") + '</div>',
  ui: '<h2>CSDIC</h2><div class="logo-showcase"><img src="assets/csdic-logo.png" width="708" height="105" alt="CSDIC Compound Semiconductor Design and Implementation Center"></div><p>화합물 반도체 설계 센터<br>Compound Semiconductor Design and Implementation Center</p>',
  location: '<div class="address-card"><h2>가천대학교</h2><address>' + address + '</address><a class="map-link" href="https://map.naver.com/p/search/' + encodeURIComponent(address) + '" target="_blank" rel="noopener noreferrer">지도에서 위치 보기</a></div>',
  news: '<h2>공지사항</h2><ul class="article-list">' + noticeEntries.map(item => '<li><a href="' + item.route + '"><time>2026-' + item.date + '</time><span>' + escapeHTML(item.text) + '</span></a></li>').join("") + '</ul>',
  gallery: '<h2>행사갤러리</h2><div class="photo-grid">' + originalGallery.map(html => html.replace('href="#gallery"', 'href="#home"')).join("") + '</div><p class="reference-note">보내주신 참고 화면의 행사 사진으로 구성되었습니다.</p>',
  "education-apply": '<h2>교육신청</h2>' + lead("GaAs/GaN, RF/MMIC 설계 교육 프로그램") + '<div class="empty-content">교육 일정 및 신청 안내를 준비 중입니다.</div>',
  "mpw-apply": '<h2>MPW신청</h2><div class="empty-content">MPW 접수 일정 및 신청 안내를 준비 중입니다.</div>',
  recruit: '<h2>인재채용</h2><div class="empty-content">등록된 채용 공고가 없습니다.</div>',
  press: '<h2>대외홍보</h2><div class="empty-content">등록된 대외홍보 소식이 없습니다.</div>',
  login: '<h2>로그인</h2><div class="empty-content">로그인 기능은 준비 중입니다.</div>',
  join: '<h2>회원가입</h2><div class="empty-content">회원가입 기능은 준비 중입니다.</div>'
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
  if (!route || route === "top") route = "home";
  closeDrawer(); closeMega(true);
  const home = route === "home";
  $("#homePage").hidden = !home;
  $("#innerPage").hidden = home;
  $("#innerPage").classList.toggle("business-page", route === "business");
  $(".page-banner").classList.toggle("wrap", route === "business");
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
    $("#pageContent").innerHTML = route === "business" ? businessContent(selectedProgram) : (Object.hasOwn(content, route) ? content[route] : "") || (page ? '<h2>' + escapeHTML(title) + '</h2><div class="empty-content">관련 자료를 준비 중입니다.</div>' : '<div class="empty-content">요청하신 페이지가 없습니다. <a href="#home">홈으로 이동</a></div>');
    document.title = title + " | CSDIC";
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
}
addEventListener("hashchange", () => renderPage());
renderPage(true);
