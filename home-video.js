(() => {
  const iframe = document.getElementById("homeVideoPlayer");
  const sound = document.getElementById("videoSound");
  const playback = document.getElementById("videoPlayback");
  const status = document.getElementById("videoStatus");
  const home = document.getElementById("homePage");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let player, ready = false, started = false, userPaused = reducedMotion.matches;
  const showStatus = text => { status.textContent = text; status.hidden = !text; };
  function updateSound(enabled = !player.isMuted()) {
    sound.textContent = enabled ? "소리 끄기" : "소리 켜기";
    sound.setAttribute("aria-pressed", String(enabled));
  }
  function updatePlayback(playing) {
    playback.textContent = playing ? "일시정지" : "재생";
    playback.setAttribute("aria-pressed", String(playing));
  }
  function connectPlayer() {
    player = new YT.Player(iframe, {events: {
      onReady: event => {
        ready = true;
        sound.disabled = playback.disabled = false;
        event.target.mute();
        updateSound(false);
        showStatus("");
        if (!home.hidden && !userPaused) event.target.playVideo();
      },
      onStateChange: event => {
        updatePlayback(event.data === YT.PlayerState.PLAYING);
        if (event.data === YT.PlayerState.BUFFERING && !home.hidden) showStatus("영상을 불러오는 중입니다.");
        if (event.data === YT.PlayerState.PLAYING) {
          if (home.hidden) event.target.pauseVideo();
          else showStatus("");
        }
      },
      onAutoplayBlocked: () => showStatus("재생 버튼을 눌러 영상을 시작하세요."),
      onError: () => {
        sound.disabled = playback.disabled = true;
        showStatus("이곳에서 영상을 재생할 수 없습니다. ‘YouTube에서 보기’를 이용해 주세요.");
      }
    }});
  }
  function initialize() {
    if (started || home.hidden) return;
    started = true;
    const params = new URLSearchParams({enablejsapi: "1", origin: location.origin,
      autoplay: "0", mute: "1", loop: "1", playlist: iframe.dataset.videoId,
      playsinline: "1", controls: "1", rel: "0"});
    iframe.src = "https://www.youtube-nocookie.com/embed/" + iframe.dataset.videoId + "?" + params;
    if (window.YT?.Player) connectPlayer();
    else {
      window.onYouTubeIframeAPIReady = connectPlayer;
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => showStatus("영상 안의 재생 버튼 또는 ‘YouTube에서 보기’를 이용해 주세요.");
      document.head.append(script);
    }
  }
  sound.addEventListener("click", () => {
    if (!ready) return;
    const enableSound = sound.getAttribute("aria-pressed") !== "true";
    if (enableSound) { player.unMute(); player.setVolume(70); }
    else player.mute();
    // Player commands cross the iframe asynchronously; update the label from the requested state.
    updateSound(enableSound);
  });
  playback.addEventListener("click", () => {
    if (!ready) return;
    userPaused = player.getPlayerState() === YT.PlayerState.PLAYING;
    if (userPaused) player.pauseVideo(); else player.playVideo();
  });
  addEventListener("hashchange", () => {
    initialize();
    if (!ready) return;
    if (home.hidden) player.pauseVideo();
    else if (!userPaused) player.playVideo();
  });
  initialize();
})();
