(() => {
  "use strict";
  const iframe = document.getElementById("homeVideoPlayer");
  const sound = document.getElementById("videoSound");
  const playback = document.getElementById("videoPlayback");
  const status = document.getElementById("videoStatus");
  const home = document.getElementById("homePage");
  const external = document.getElementById("homeVideoExternal");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const publicVideos = [...new Set((iframe.dataset.publicVideoIds || "").split(/\s+/).filter(id => /^[A-Za-z0-9_-]{11}$/.test(id)))];
  const defaultVideo = iframe.dataset.videoId;
  const unavailable = new Set();
  let player, ready = false, started = false, userPaused = reducedMotion.matches;
  let activeVideo = "", embeddedVideo = "", signedIn, guest = true;
  const showStatus = text => { status.textContent = text; status.hidden = !text; };
  function updateSound(enabled = !player.isMuted()) {
    sound.textContent = enabled ? "소리 끄기" : "소리 켜기";
    sound.setAttribute("aria-pressed", String(enabled));
  }
  function updatePlayback(playing) {
    playback.textContent = playing ? "일시정지" : "재생";
    playback.setAttribute("aria-pressed", String(playing));
  }
  function randomPublic(exclude = "") {
    const available = publicVideos.filter(id => !unavailable.has(id));
    const other = available.filter(id => id !== exclude);
    const candidates = other.length ? other : available;
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }
  function selectVideo(id) {
    activeVideo = id;
    iframe.dataset.activeVideoId = id;
    external.href = "https://www.youtube.com/watch?v=" + id;
  }
  function loadCurrent() {
    if (!ready) return;
    embeddedVideo = activeVideo;
    sound.disabled = playback.disabled = false;
    updatePlayback(false);
    showStatus("영상을 불러오는 중입니다.");
    if (!home.hidden && !userPaused) player.loadVideoById(activeVideo);
    else player.cueVideoById(activeVideo);
  }
  function connectPlayer() {
    if (player) return;
    player = new YT.Player(iframe, {events: {
      onReady: event => {
        ready = true;
        sound.disabled = playback.disabled = false;
        event.target.mute();
        updateSound(false);
        showStatus("");
        if (embeddedVideo !== activeVideo) loadCurrent();
        else if (!home.hidden && !userPaused) event.target.playVideo();
      },
      onStateChange: event => {
        updatePlayback(event.data === YT.PlayerState.PLAYING);
        if (event.data === YT.PlayerState.BUFFERING && !home.hidden) showStatus("영상을 불러오는 중입니다.");
        if (event.data === YT.PlayerState.CUED) showStatus("");
        if (event.data === YT.PlayerState.PLAYING) {
          if (home.hidden) event.target.pauseVideo();
          else showStatus("");
        }
        if (event.data === YT.PlayerState.ENDED && !home.hidden && !userPaused) {
          if (guest) selectVideo(randomPublic(activeVideo) || defaultVideo);
          loadCurrent();
        }
      },
      onAutoplayBlocked: () => {
        updatePlayback(false);
        showStatus("재생 버튼을 눌러 영상을 시작하세요.");
      },
      onError: () => {
        unavailable.add(activeVideo);
        const next = guest ? randomPublic(activeVideo) : null;
        if (next) {selectVideo(next); loadCurrent(); return;}
        sound.disabled = playback.disabled = true;
        updatePlayback(false);
        showStatus("이곳에서 영상을 재생할 수 없습니다. ‘YouTube에서 보기’를 이용해 주세요.");
      }
    }});
  }
  function initialize() {
    if (started || home.hidden || !activeVideo) return;
    started = true;
    embeddedVideo = activeVideo;
    const params = new URLSearchParams({enablejsapi: "1", origin: location.origin,
      autoplay: "0", mute: "1", playsinline: "1", controls: "1", rel: "0"});
    iframe.src = "https://www.youtube-nocookie.com/embed/" + activeVideo + "?" + params;
    if (window.YT?.Player) connectPlayer();
    else {
      window.onYouTubeIframeAPIReady = connectPlayer;
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => showStatus("영상 안의 재생 버튼 또는 ‘YouTube에서 보기’를 이용해 주세요.");
      document.head.append(script);
    }
  }
  function syncViewer() {
    // This state selects public presentation only; document access still uses server policies.
    const viewer = window.CSDICMembers?.getViewerState?.() || {ready:true,signedIn:false};
    if (!viewer.ready) return;
    const changed = signedIn !== viewer.signedIn;
    signedIn = viewer.signedIn;
    guest = !signedIn;
    if (changed || !activeVideo) selectVideo(guest ? randomPublic() || defaultVideo : defaultVideo);
    initialize();
    if (changed && ready) loadCurrent();
  }
  sound.addEventListener("click", () => {
    if (!ready || sound.disabled) return;
    const enableSound = sound.getAttribute("aria-pressed") !== "true";
    if (enableSound) { player.unMute(); player.setVolume(70); }
    else player.mute();
    updateSound(enableSound);
  });
  playback.addEventListener("click", () => {
    if (!ready || playback.disabled) return;
    userPaused = player.getPlayerState() === YT.PlayerState.PLAYING;
    if (userPaused) player.pauseVideo(); else player.playVideo();
  });
  addEventListener("csdic:viewerchange", syncViewer);
  addEventListener("hashchange", () => {
    syncViewer();
    if (!ready) return;
    if (home.hidden) player.pauseVideo();
    else if (!userPaused) player.playVideo();
  });
  syncViewer();
})();
