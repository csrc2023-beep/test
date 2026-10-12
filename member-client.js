(() => {
  "use strict";
  const cfg = window.CSDIC_MEMBER_CONFIG || {};
  function isPublicKey(key) {
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    try {
      const part = key.split(".")[1];
      return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))).role === "anon";
    } catch { return false; }
  }
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || "") && isPublicKey(cfg.publishableKey || "");
  let client = null;
  if (configured && window.supabase?.createClient) {
    try {
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey, {
        auth: {flowType: "pkce", detectSessionInUrl: false, persistSession: true,
          autoRefreshToken: true, storage: window.sessionStorage, storageKey: "csdic-member-session"}
      });
    } catch { /* Unavailable session storage must not create a fake logged-in state. */ }
  }
  window.CSDICMemberClient = Object.freeze({client, configured: Boolean(client), bucket: "member-documents"});
})();
