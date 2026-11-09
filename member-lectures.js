(() => {
  "use strict";

  const table = "member_lectures";
  const bucket = "member-lecture-thumbnails";
  const imageTypes = {"image/jpeg":"jpg", "image/png":"png", "image/webp":"webp"};
  const columns = "id,title,watch_url,thumbnail_path,published";
  const unavailable = "강의 영상을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.";
  let dispose = () => {};

  function watchUrl(value) {
    const raw = String(value ?? "").trim();
    if (raw.length > 2000 || /[\s\\]/u.test(raw)) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !/^[a-z0-9][a-z0-9-]*\.sharepoint\.com$/.test(url.hostname) ||
          url.username || url.password || url.port) return null;
      if (!/^\/:v:\/[^/]/i.test(url.pathname) &&
          !(/\/_layouts\/15\/stream\.aspx$/i.test(url.pathname) && url.searchParams.has("id"))) return null;
      for (const [name, setting] of url.searchParams) {
        if (name.toLowerCase() === "download" && /^(1|true)$/i.test(setting)) return null;
      }
      return url.href;
    } catch { return null; }
  }

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function unmount() {
    const cleanup = dispose;
    dispose = () => {};
    cleanup();
  }

  function scope(root) {
    unmount();
    let active = true;
    const urls = new Set();
    const observers = new Set();
    dispose = () => {
      active = false;
      for (const observer of observers) observer.disconnect();
      for (const url of urls) URL.revokeObjectURL(url);
    };
    return {
      live: () => active && root.isConnected,
      addUrl: blob => { const url = URL.createObjectURL(blob); urls.add(url); return url; },
      observe: observer => observers.add(observer)
    };
  }

  async function mount(root, client) {
    if (!root) return;
    const state = scope(root);
    const status = node("p", "empty-content member-lecture-status", "강의 영상을 불러오는 중입니다.");
    status.setAttribute("role", "status");
    root.replaceChildren(status);
    try {
      const {data, error} = await client.from(table).select(columns).eq("published", true)
        .order("created_at", {ascending:false}).order("id");
      if (error) throw error;
      if (!state.live()) return;
      const entries = data.map(lecture => ({...lecture, href:watchUrl(lecture.watch_url)})).filter(lecture => lecture.href);
      if (!entries.length) {
        status.textContent = "등록된 강의 영상이 없습니다.";
        return;
      }

      const note = node("p", "member-field-hint member-lecture-note", "썸네일을 누르면 OneDrive가 새 창에서 열립니다. Microsoft 로그인 또는 이메일 인증이 필요할 수 있습니다.");
      const grid = node("ul", "member-lecture-grid");
      const thumbnails = new Map();
      async function loadImage(image) {
        const path = thumbnails.get(image);
        thumbnails.delete(image);
        if (!path || !state.live()) return;
        try {
          const {data:blob, error:downloadError} = await client.storage.from(bucket).download(path);
          if (!downloadError && Object.hasOwn(imageTypes, blob?.type) && state.live()) image.src = state.addUrl(blob);
          else if (state.live()) image.remove();
        } catch {if (state.live()) image.remove();}
      }

      for (const item of entries) {
        const card = node("a", "member-lecture-card");
        card.href = item.href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        const cover = node("span", "member-lecture-cover");
        if (item.thumbnail_path) {
          const image = node("img");
          image.alt = "";
          image.decoding = "async";
          image.addEventListener("error", () => image.remove(), {once:true});
          thumbnails.set(image, item.thumbnail_path);
          cover.append(image);
        }
        const play = node("span", "member-lecture-play", "▶");
        play.setAttribute("aria-hidden", "true");
        cover.append(play);
        const name = node("span", "member-lecture-name", item.title);
        name.setAttribute("translate", "no");
        card.append(cover, name, node("span", "member-lecture-label", "OneDrive에서 보기 ↗"));
        const row = node("li");
        row.append(card);
        grid.append(row);
      }
      root.replaceChildren(note, grid);
      if (typeof IntersectionObserver === "function") {
        const observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            loadImage(entry.target);
          }
        }, {rootMargin:"150px"});
        state.observe(observer);
        for (const image of thumbnails.keys()) observer.observe(image);
      } else {
        for (const image of thumbnails.keys()) loadImage(image);
      }
    } catch {if (state.live()) status.textContent = unavailable;}
  }

  async function putThumbnail(client, file) {
    if (!Object.hasOwn(imageTypes, file.type) || file.size > 20 * 1024 * 1024) throw new Error("THUMBNAIL");
    let optimized;
    try {optimized = await window.CSDICCommunityImage.optimize(file);}
    catch {throw new Error("THUMBNAIL");}
    if (!Object.hasOwn(imageTypes, optimized.type) || optimized.size > 1024 * 1024) throw new Error("THUMBNAIL");
    const path = crypto.randomUUID() + "." + imageTypes[optimized.type];
    const {error} = await client.storage.from(bucket).upload(path, optimized, {contentType:optimized.type, upsert:false});
    if (error) throw error;
    return path;
  }

  function mountAdmin(root, client) {
    if (!root) return;
    const state = scope(root);
    root.innerHTML = '<h3 class="member-library-subtitle">OneDrive 강의 영상 등록</h3>' +
      '<p>학교 또는 직장용 OneDrive에서 영상 공유 권한을 먼저 설정해 주세요.</p>' +
      '<form class="member-lecture-form"><label class="member-field">강의 제목<input name="title" maxlength="160" required></label>' +
      '<label class="member-field">OneDrive 영상 링크<input name="watchUrl" type="url" maxlength="2000" placeholder="https://...sharepoint.com/..." required></label>' +
      '<p class="member-field-hint">학교 또는 직장용 OneDrive의 sharepoint.com 영상 보기 링크를 붙여넣어 주세요.</p>' +
      '<label class="member-field">썸네일 사진 (선택)<input name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
      '<label class="member-check"><input name="confirmed" type="checkbox" required>특정 사용자, 보기 전용, 다운로드 차단을 설정했습니다.</label>' +
      '<div class="member-actions"><button class="member-primary" type="submit">강의 영상 등록</button>' +
      '<button class="member-secondary" type="button" data-lecture-cancel hidden>수정 취소</button></div></form>' +
      '<p class="member-message" role="status" aria-live="polite"></p><div class="member-lecture-admin-list"></div>';
    const form = root.querySelector("form");
    const submit = form.querySelector('button[type="submit"]');
    const cancel = form.querySelector("[data-lecture-cancel]");
    const status = root.querySelector('[role="status"]');
    const list = root.querySelector(".member-lecture-admin-list");
    let edited = null, saving = false;

    function clearEditor() {
      edited = null;
      form.reset();
      submit.textContent = "강의 영상 등록";
      cancel.hidden = true;
    }

    function changeBusy(value) {
      saving = value;
      submit.disabled = value;
      cancel.disabled = value;
      for (const button of list.querySelectorAll("button")) button.disabled = value;
    }

    cancel.addEventListener("click", clearEditor);

    async function loadAdminList() {
      try {
        const {data, error} = await client.from(table).select(columns).order("created_at", {ascending:false}).order("id");
        if (error) throw error;
        if (!state.live()) return;
        list.replaceChildren(node("h4", "", "등록된 강의 영상"));
        if (!data.length) list.append(node("p", "", "등록된 강의 영상이 없습니다."));
        for (const item of data) {
          const line = node("div", "member-lecture-admin-row");
          const title = node("strong", "", item.title);
          title.setAttribute("translate", "no");
          const edit = node("button", "member-secondary", "수정");
          edit.type = "button";
          edit.disabled = saving;
          edit.addEventListener("click", () => {
            if (saving) return;
            form.reset();
            edited = item;
            form.elements.title.value = item.title;
            form.elements.watchUrl.value = item.watch_url;
            submit.textContent = "수정 저장";
            cancel.hidden = false;
            form.elements.title.focus();
          });
          const toggle = node("button", "member-secondary", item.published ? "열람 중지" : "열람 허용");
          toggle.type = "button";
          toggle.disabled = saving;
          toggle.addEventListener("click", async () => {
            if (saving) return;
            changeBusy(true);
            try {
              const {error} = await client.from(table).update({published:!item.published}).eq("id", item.id).select("id").single();
              if (error) throw error;
              if (!state.live()) return;
              if (edited?.id === item.id) clearEditor();
              status.textContent = item.published ? "자료실에서 강의를 숨겼습니다. OneDrive 공유 권한은 별도로 해제해야 합니다." : "자료실에서 강의를 다시 표시합니다.";
              await loadAdminList();
            } catch {if (state.live()) status.textContent = "강의 상태를 변경하지 못했습니다.";}
            finally {if (state.live()) changeBusy(false);}
          });
          line.append(title, edit, toggle);
          list.append(line);
        }
      } catch {
        if (state.live()) list.replaceChildren(node("p", "", unavailable));
      }
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (saving) return;
      const values = new FormData(form);
      const title = String(values.get("title") || "").trim();
      const href = watchUrl(values.get("watchUrl"));
      const file = values.get("thumbnail");
      if (!title || !href || !values.has("confirmed")) {
        status.textContent = "강의 제목, OneDrive 영상 보기 링크와 공유 설정을 확인해 주세요.";
        return;
      }
      const original = edited;
      let uploaded = null, saved = false;
      changeBusy(true);
      status.textContent = "강의 영상을 등록하는 중입니다.";
      try {
        if (file?.size) uploaded = await putThumbnail(client, file);
        const data = {title, watch_url:href};
        if (uploaded) data.thumbnail_path = uploaded;
        const query = original ? client.from(table).update(data).eq("id", original.id)
          : client.from(table).insert({...data, published:true});
        const {error} = await query.select("id").single();
        if (error) throw error;
        saved = true;
        if (uploaded && original?.thumbnail_path) {
          try {await client.storage.from(bucket).remove([original.thumbnail_path]);} catch {}
        }
        if (state.live()) {
          clearEditor();
          status.textContent = "강의 영상 정보가 저장되었습니다.";
          await loadAdminList();
        }
      } catch (error) {
        if (uploaded && !saved) {
          try {await client.storage.from(bucket).remove([uploaded]);} catch {}
        }
        if (state.live()) status.textContent = error?.message === "THUMBNAIL"
          ? "썸네일은 JPG, PNG, WebP 형식으로 압축 후 1 MB 이하여야 합니다."
          : "강의 정보를 저장하지 못했습니다. 입력값과 연결 상태를 확인해 주세요.";
      } finally {if (state.live()) changeBusy(false);}
    });
    loadAdminList();
  }

  window.CSDICMemberLectures = Object.freeze({mount, mountAdmin, unmount});
})();
