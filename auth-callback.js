(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token_hash = params.get("token_hash");
  const access_token = fragment.get("access_token"), refresh_token = fragment.get("refresh_token");
  const callbackType = token_hash ? params.get("type") : fragment.get("type");
  const type = ["email", "signup"].includes(callbackType) ? "email" : callbackType === "recovery" ? "recovery" : null;
  // Clear the one-time token before displaying links or loading other pages.
  history.replaceState(null, "", location.pathname);
  const {client} = window.CSDICMemberClient;
  const status = document.getElementById("callbackStatus"), form = document.getElementById("passwordUpdateForm");
  async function verify() {
    if (!client) {status.textContent = "회원 서비스 연결을 준비 중입니다. 연결 후 인증을 다시 진행해 주세요."; return;}
    if (!type || (!token_hash && (!access_token || !refresh_token))) {status.textContent = "인증 링크가 올바르지 않습니다. 가입 또는 비밀번호 찾기를 다시 진행해 주세요."; return;}
    const result = token_hash ? await client.auth.verifyOtp({token_hash, type}) : await client.auth.setSession({access_token, refresh_token});
    if (result.error || !result.data.user) {status.textContent = "인증 링크가 만료되었거나 이미 사용되었습니다. 가입 또는 비밀번호 찾기를 다시 진행해 주세요."; return;}
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user?.email_confirmed_at) {
      await client.auth.signOut({scope:"local"});
      status.textContent = "이메일 인증을 확인하지 못했습니다. 가입 또는 비밀번호 찾기를 다시 진행해 주세요."; return;
    }
    if (type === "recovery") {status.textContent = verified.data.user.email + " 계정의 새 비밀번호를 입력해 주세요."; form.hidden = false;}
    else {status.textContent = "이메일 인증이 완료되었습니다. 관리자 승인 후 회원 자료실을 이용할 수 있습니다.";}
  }
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (!client) return;
    const values = new FormData(form), password = String(values.get("password"));
    if (password.length < 12 || password !== values.get("confirm")) {status.textContent = "12자 이상의 동일한 비밀번호를 입력해 주세요."; return;}
    const button = form.querySelector("button"); button.disabled = true;
    try {
      const result = await client.auth.updateUser({password});
      if (result.error) {status.textContent = "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요."; return;}
      form.reset(); form.hidden = true;
      await client.auth.signOut({scope:"local"});
      status.textContent = "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.";
    } catch {status.textContent = "연결을 확인한 뒤 다시 시도해 주세요.";}
    finally {button.disabled = false;}
  });
  verify().catch(() => {status.textContent = "인증을 완료하지 못했습니다. 연결 상태를 확인하고 다시 진행해 주세요.";});
})();
