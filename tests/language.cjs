const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Small DOM fixture: exercise the language layer without a browser or network.
class Element {
  constructor(tag, attrs = {}, parent = null) {
    this.tagName = tag.toUpperCase(); this.attrs = {...attrs}; this.parentElement = parent;
    this.children = []; this.hidden = false; this.dataset = {};
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    if (parent) parent.children.push(this);
  }
  getAttribute(name) { return this.attrs[name] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  matches(selector) {
    return selector.split(',').some(part => {
      const s = part.trim();
      const relation = s.match(/^(.*?)(\s+|>)([^ >]+)$/);
      if (relation) return this.matches(relation[3]) && (relation[2] === '>' ? this.parentElement?.matches(relation[1]) : this.parentElement?.closest(relation[1]));
      if (s[0] === '.') return (this.attrs.class || '').split(' ').includes(s.slice(1));
      if (s[0] === '#') return this.attrs.id === s.slice(1);
      const m = s.match(/^(\w+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (m) return (!m[1] || this.tagName === m[1].toUpperCase()) && this.getAttribute(m[2]) !== null && (m[3] === undefined || this.getAttribute(m[2]) === m[3]);
      return this.tagName === s.toUpperCase();
    });
  }
  closest(selector) { for (let p = this; p; p = p.parentElement) if (p.matches(selector)) return p; return null; }
}
function harness({stored = null, search = '', pathname = '/', hash = '#news?q=MPW', blocked = false} = {}) {
  const elements = [], nodes = [], events = {};
  const el = (tag, attrs = {}, parent = body) => { const e = new Element(tag, attrs, parent); elements.push(e); return e; };
  const html = new Element('html'); const body = new Element('body', {}, html); elements.push(html, body);
  const text = (value, parent = body) => { const n = {nodeValue:value, parentElement:parent}; nodes.push(n); return n; };
  const doc = {
    body, documentElement:html, readyState:'complete',
    createTreeWalker() { let i = 0; return {nextNode:() => nodes[i++] || null}; },
    querySelectorAll:s => elements.filter(e => e.matches(s)),
    querySelector:s => elements.find(e => e.matches(s)) || null,
    getElementById:id => elements.find(e => e.attrs.id === id) || null,
    addEventListener:(name, callback) => { events[name] = callback; }
  };
  const location = new URL('https://csdic.co.kr' + pathname + search + hash);
  const storage = new Map(stored ? [['csdic.language', stored]] : []);
  const history = {state:{preserve:true}, replaceState(state, _, target) { this.state = state; location.href = new URL(target, location).href; }};
  let mutation;
  const context = vm.createContext({window:{}, document:doc, location, history, URL, URLSearchParams, NodeFilter:{SHOW_TEXT:4},
    localStorage:{getItem:key => { if (blocked) throw Error('blocked'); return storage.get(key); }, setItem:(key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); }},
    MutationObserver:class { constructor(callback) { mutation = callback; } disconnect() {} observe() {} },
    addEventListener:(name, callback) => {events[name] = callback;}
  });
  vm.runInContext(read('translations-en.js'), context);
  vm.runInContext(read('language.js'), context);
  return {el, text, doc, html, body, location, storage, history, events, mutate:() => mutation(), api:context.window.CSDICLanguage, context};
}

const h = harness();
const heading = h.text('센터비전');
const input = h.el('input', {placeholder:'검색어'}); input.value = '화합물 반도체 MPW';
const area = h.el('textarea', {placeholder:'검색어'}); area.value = '작성 중인 본문';
const areaText = h.text('공지사항', area);
const authored = h.text('공지사항', h.el('p', {}, h.el('div', {class:'notice-body'})));
const file = h.text('다운로드', h.el('span', {translate:'no'}));
const script = h.text('공지사항', h.el('script'));
const status = h.text('회원가입 기능을 불러오고 있습니다.');
const group = h.el('div', {'data-language-switch':'', 'data-no-translate':''});
const ko = h.el('button', {'data-set-language':'ko'}, group), en = h.el('button', {'data-set-language':'en'}, group);
const note = h.el('p', {id:'contentLanguageNote'});
const map = h.el('iframe', {}, h.el('div', {class:'location-map'})); map.src = 'https://maps.google.com/maps?q=Gachon&hl=ko&output=embed';
h.events.click({target:en});
assert.equal(h.html.lang, 'en'); assert.equal(heading.nodeValue, 'Vision');
assert.equal(input.getAttribute('placeholder'), 'Search term'); assert.equal(area.getAttribute('placeholder'), 'Search term');
assert.equal(input.value, '화합물 반도체 MPW'); assert.equal(area.value, '작성 중인 본문'); assert.equal(areaText.nodeValue, '공지사항');
assert.equal(authored.nodeValue, '공지사항'); assert.equal(file.nodeValue, '다운로드'); assert.equal(script.nodeValue, '공지사항');
assert.equal(en.getAttribute('aria-pressed'), 'true'); assert.equal(ko.getAttribute('aria-pressed'), 'false'); assert.equal(note.hidden, false);
assert.equal(h.location.hash, '#news?q=MPW'); assert.equal(h.location.search, '?lang=en'); assert.deepEqual(h.history.state, {preserve:true});
assert.equal(new URL(map.src).searchParams.get('hl'), 'en'); assert.equal(h.storage.get('csdic.language'), 'en');
status.nodeValue = '요청이 많습니다. 잠시 후 다시 시도해 주세요.'; h.mutate();
assert.equal(status.nodeValue, 'Too many requests. Please try again later.');
const dynamic = h.text('MPW신청'); h.mutate(); assert.equal(dynamic.nodeValue, 'MPW application');
h.events.click({target:ko});
assert.equal(h.html.lang, 'ko'); assert.equal(heading.nodeValue, '센터비전'); assert.equal(input.getAttribute('placeholder'), '검색어');
assert.equal(status.nodeValue, '요청이 많습니다. 잠시 후 다시 시도해 주세요.'); assert.equal(dynamic.nodeValue, 'MPW신청'); assert.equal(note.hidden, true);
assert.equal(input.value, '화합물 반도체 MPW'); assert.equal(new URL(map.src).searchParams.get('hl'), 'ko');
assert.equal(harness({stored:'en'}).api.getLanguage(), 'en');
assert.equal(harness({stored:'en',search:'?lang=ko'}).api.getLanguage(), 'ko');
assert.equal(harness({search:'?lang=en',blocked:true}).api.getLanguage(), 'en');
assert.equal(harness({stored:'unsupported'}).api.getLanguage(), 'ko');
const auth = harness({pathname:'/auth.html',search:'?code=keep-this-code'}); auth.api.setLanguage('en');
assert.equal(auth.location.search, '?code=keep-this-code');
assert.equal(h.api.t('“원문 제목” 문서와 원본 파일을 삭제할까요?\n삭제한 자료는 복구할 수 없습니다.', 'en'), 'Delete “원문 제목” and its original file?\nDeleted material cannot be recovered.');
assert.equal(h.api.t('상위 메뉴 선택: 센터소개', 'en'), 'Select category: About');

// Render all static public copy through the same factories used by the site.
vm.runInContext(read('site-content.js'), h.context);
const source = read('script.js');
const business = source.slice(source.indexOf('const lead ='), source.indexOf('$("#pageContent").addEventListener("keydown"'));
const content = source.slice(source.indexOf('function visionContent()'), source.indexOf('function renderBreadcrumb('));
vm.runInContext('const centerName="화합물 반도체설계 지원센터",address="경기 성남시 수정구 성남대로 1342 가천대학교 반도체대학",mapPlace="가천대학교 반도체대학"; const escapeHTML = value => String(value);' + business + content + ';globalThis.pageSamples={...content,...Object.fromEntries(Object.keys(businessPrograms).map(key=>["business-"+key,businessContent(key)]))};', h.context);
const decode = value => value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const missing = new Set(); let checked = 0;
for (const html of [...Object.values(h.context.pageSamples), read('index.html'), read('auth.html')]) {
  const clean = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const strings = [...clean.matchAll(/>([^<>]+)</g)].map(m=>m[1]);
  strings.push(...[...clean.matchAll(/(?:aria-label|title|placeholder|alt|content)="([^"]+)"/g)].map(m=>m[1]));
  for (const raw of strings) {
    const text = decode(raw).trim(); if (!/[가-힣]/.test(text) || text === '한국어') continue;
    checked++; if (/[가-힣]/.test(h.api.t(text, 'en'))) missing.add(text);
  }
}
assert.deepEqual([...missing], [], 'Untranslated public copy');
console.log('Language tests passed: reversible DOM updates, original content and form preservation, URL/preferences, dynamic messages, auth callback, and ' + checked + ' public text nodes/attributes.');
