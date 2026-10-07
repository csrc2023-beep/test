const menuOpen=document.getElementById("menuOpen");
const menuClose=document.getElementById("menuClose");
const sideMenu=document.getElementById("sideMenu");
const backdrop=document.getElementById("drawerBackdrop");
const megaMenu=document.getElementById("megaMenu");
const navLinks=[...document.querySelectorAll(".nav-link")];
const megaCols=[...document.querySelectorAll(".mega-col")];
let closeTimer;

function highlightMenu(name){
  navLinks.forEach(b=>b.classList.toggle("active",b.dataset.menu===name));
  megaCols.forEach(c=>c.classList.toggle("active",c.dataset.col===name));
}
function openMega(name){
  clearTimeout(closeTimer);
  highlightMenu(name);
  megaMenu.classList.add("open");
  megaMenu.setAttribute("aria-hidden","false");
}
function closeMega(){
  closeTimer=setTimeout(()=>{
    megaMenu.classList.remove("open");
    megaMenu.setAttribute("aria-hidden","true");
    navLinks.forEach(b=>b.classList.remove("active"));
    megaCols.forEach(c=>c.classList.remove("active"));
  },120);
}
navLinks.forEach(btn=>{
  btn.addEventListener("mouseenter",()=>openMega(btn.dataset.menu));
  btn.addEventListener("focus",()=>openMega(btn.dataset.menu));
  btn.addEventListener("click",()=>openMega(btn.dataset.menu));
});
megaMenu.addEventListener("mouseenter",()=>clearTimeout(closeTimer));
megaMenu.addEventListener("mouseleave",closeMega);
document.querySelector(".nav-list")?.addEventListener("mouseleave",closeMega);

function openDrawer(){
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden","false");
  backdrop.hidden=false;
  document.body.classList.add("menu-open");
  menuOpen.setAttribute("aria-expanded","true");
}
function closeDrawer(){
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden","true");
  backdrop.hidden=true;
  document.body.classList.remove("menu-open");
  menuOpen.setAttribute("aria-expanded","false");
}
menuOpen.addEventListener("click",openDrawer);
menuClose.addEventListener("click",closeDrawer);
backdrop.addEventListener("click",closeDrawer);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeDrawer();megaMenu.classList.remove("open");}});

const tabButtons=[...document.querySelectorAll(".side-tabs button")];
const panels=[...document.querySelectorAll(".side-panel")];
tabButtons.forEach(btn=>btn.addEventListener("click",()=>{
  tabButtons.forEach(b=>b.classList.remove("active"));
  panels.forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(btn.dataset.panel)?.classList.add("active");
}));
document.querySelectorAll(".side-panel a").forEach(a=>a.addEventListener("click",closeDrawer));