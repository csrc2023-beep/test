(() => {
  "use strict";
  const dialog = document.getElementById("homeAnnouncement");
  const poster = document.getElementById("announcementPoster");
  const home = document.getElementById("homePage");
  if (!dialog || !poster || !home || typeof dialog.showModal !== "function") return;

  const storageKey = "csdic.popup.beyond-silicon-2026.hiddenDay";
  const expiresAt = Date.parse(dialog.dataset.expiresAt);
  // The notice and its daily dismissal follow the event's Korean time zone.
  const today = () => String(Math.floor((Date.now() + 9 * 60 * 60 * 1000) / 86400000));
  let shown = false;

  function showAnnouncement() {
    if (shown || home.hidden || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) return;
    if (!poster.complete || !poster.naturalWidth) return;
    try { if (localStorage.getItem(storageKey) === today()) return; }
    catch { /* The notice still works when preference storage is unavailable. */ }
    dialog.showModal();
    shown = true;
    document.body.classList.add("announcement-open");
  }
  dialog.querySelectorAll("[data-announcement-close]").forEach(button => {
    button.addEventListener("click", () => dialog.close());
  });
  document.getElementById("announcementDismiss").addEventListener("click", () => {
    try { localStorage.setItem(storageKey, today()); }
    catch { /* Closing the notice does not depend on persistent storage. */ }
    dialog.close();
  });
  dialog.addEventListener("close", () => document.body.classList.remove("announcement-open"));
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  poster.addEventListener("load", showAnnouncement);
  addEventListener("hashchange", () => {
    if (home.hidden && dialog.open) dialog.close();
    else showAnnouncement();
  });
  showAnnouncement();
})();
