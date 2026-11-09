(() => {
  "use strict";

  const origin = "https://video.csdic.co.kr";
  const canConnect = ["https://csdic.co.kr", "https://www.csdic.co.kr"].includes(location.origin);
  const api = origin + "/api/";
  const ready = "등록된 강의 영상이 없습니다.";
  const unavailable = "강의 영상을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.";
  const denied = "강의 시청 권한을 확인하지 못했습니다. 회원 상태를 확인해 주세요.";
  const waiting = "강의 영상을 준비 중입니다.";
  let active = null, hadSession = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function unmount() {
    if (!active) return;
    const old = active;
    active = null;
    old.abort.abort();
    old.dispose();
  }

  function disconnect() {
    unmount();
    if (canConnect && hadSession) {
      hadSession = false;
      fetch(api + "session", {method:"DELETE", credentials:"include", redirect:"error", keepalive:true}).catch(() => {});
    }
  }

  async function mount(root, client, userId) {
    unmount();
    if (!root) return;
    const abort = new AbortController();
    const ctx = {abort, dispose:() => {}};
    active = ctx;
    const isActive = () => active === ctx && root.isConnected;
    const status = element("p", "empty-content member-lecture-status", "강의 영상을 불러오는 중입니다.");
    status.setAttribute("role", "status");
    root.replaceChildren(status);
    const request = (path, options = {}) => fetch(api + path, {
      credentials:"include", redirect:"error", cache:"no-store", signal:abort.signal, ...options
    });
    const allowed = error => error?.status === 401 || error?.status === 403;
    function requireOk(response) {
      if (!response.ok) throw Object.assign(new Error("Lecture service response"), {status:response.status});
      return response;
    }
    async function authorize() {
      const {data, error} = await client.auth.getSession();
      const session = data?.session;
      if (error || !session?.access_token || session.user?.id !== userId || !isActive()) {
        throw Object.assign(new Error("No matching session"), {status:401});
      }
      requireOk(await request("session", {method:"POST", headers:{Authorization:"Bearer " + session.access_token}}));
      if (isActive()) hadSession = true;
    }

    if (!canConnect) {status.textContent = waiting; return;}
    try {
      const timeout = typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.any([abort.signal, AbortSignal.timeout(6000)]) : abort.signal;
      const health = await requireOk(await request("health", {credentials:"omit", signal:timeout})).json();
      if (health.service !== "csdic-lectures-v1") throw new Error("Unknown lecture service");
    } catch {if (isActive()) status.textContent = waiting; return;}

    let entries;
    try {
      await authorize();
      const data = await requireOk(await request("lectures")).json();
      if (!Array.isArray(data.lectures)) throw new Error("Unexpected catalog");
      entries = data.lectures.filter(item => typeof item?.title === "string" && /^[a-f0-9]{32}$/.test(item.id));
    } catch (error) {if (isActive()) status.textContent = allowed(error) ? denied : unavailable; return;}
    if (!isActive()) return;
    if (!entries.length) {status.textContent = ready; return;}

    const grid = element("ul", "member-lecture-grid");
    const dialog = element("dialog", "member-lecture-dialog");
    dialog.setAttribute("aria-labelledby", "memberLecturePlaying");
    const header = element("div", "member-lecture-dialog-header");
    const heading = element("h3");
    heading.id = "memberLecturePlaying";
    heading.setAttribute("translate", "no");
    const close = element("button", "member-secondary", "닫기");
    close.type = "button";
    header.append(heading, close);
    const video = element("video", "member-lecture-player");
    video.crossOrigin = "use-credentials";
    video.setAttribute("controls", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("controlslist", "nodownload noremoteplayback");
    video.setAttribute("disablepictureinpicture", "");
    video.setAttribute("disableremoteplayback", "");
    video.preload = "metadata";
    const feedback = element("p", "member-lecture-feedback");
    feedback.setAttribute("role", "status");
    dialog.append(header, video, feedback);
    let opener = null, playback = 0, renewal = null;

    function stopVideo() {
      clearInterval(renewal);
      video.pause();
      if (video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    }
    function showError(error) {
      stopVideo();
      feedback.textContent = allowed(error) ? denied : "영상을 재생하지 못했습니다. 닫은 뒤 다시 시도해 주세요.";
    }
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      ++playback;
      stopVideo();
      if (isActive()) opener?.focus();
    });
    video.addEventListener("error", () => {if (dialog.open && video.hasAttribute("src")) showError();});
    ctx.dispose = () => {
      ++playback;
      stopVideo();
      if (dialog.open) dialog.close();
    };

    for (const item of entries) {
      const card = element("button", "member-lecture-card");
      card.type = "button";
      card.setAttribute("aria-haspopup", "dialog");
      const cover = element("span", "member-lecture-cover");
      if (item.thumbnail === true) {
        const image = element("img");
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.crossOrigin = "use-credentials";
        image.addEventListener("error", () => image.remove(), {once:true});
        image.src = api + "lectures/" + item.id + "/thumbnail";
        cover.append(image);
      }
      const play = element("span", "member-lecture-play", "▶");
      play.setAttribute("aria-hidden", "true");
      cover.append(play);
      const name = element("span", "member-lecture-name", item.title);
      name.setAttribute("translate", "no");
      card.append(cover, name, element("span", "member-lecture-label", "영상 재생"));
      card.addEventListener("click", async () => {
        const selection = ++playback;
        const current = () => isActive() && dialog.open && selection === playback;
        stopVideo();
        opener = card;
        heading.textContent = item.title;
        feedback.textContent = "영상을 불러오는 중입니다.";
        if (!dialog.open) dialog.showModal();
        try {
          await authorize();
          if (!current()) return;
          video.src = api + "lectures/" + item.id + "/stream";
          feedback.textContent = "";
          video.play().catch(() => {});
          renewal = setInterval(() => authorize().catch(error => {if (current()) showError(error);}), 240000);
        } catch (error) {if (current()) showError(error);}
      });
      const li = element("li");
      li.append(card);
      grid.append(li);
    }
    root.replaceChildren(grid, dialog);
  }

  window.CSDICMemberLectures = Object.freeze({mount, unmount, disconnect});
})();
