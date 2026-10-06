const menuOpen = document.getElementById("menuOpen");
const menuClose = document.getElementById("menuClose");
const sideMenu = document.getElementById("sideMenu");
const backdrop = document.getElementById("drawerBackdrop");
const tabButtons = document.querySelectorAll(".side-tabs button");
const panels = document.querySelectorAll(".side-panel");

function openMenu(){
  sideMenu.classList.add("open");
  sideMenu.setAttribute("aria-hidden","false");
  menuOpen.setAttribute("aria-expanded","true");
  backdrop.hidden = false;
  document.body.classList.add("menu-open");
}

function closeMenu(){
  sideMenu.classList.remove("open");
  sideMenu.setAttribute("aria-hidden","true");
  menuOpen.setAttribute("aria-expanded","false");
  backdrop.hidden = true;
  document.body.classList.remove("menu-open");
}

menuOpen.addEventListener("click", openMenu);
menuClose.addEventListener("click", closeMenu);
backdrop.addEventListener("click", closeMenu);

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") closeMenu();
});

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById(btn.dataset.panel);
    if(panel) panel.classList.add("active");
  });
});

document.querySelectorAll(".side-panel a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});
