/* ==========================================================================
   DIMCHI — script.js
   ==========================================================================
   맨 위 값(profile, links, activities)만 바꾸면 HTML을 건드리지 않고
   화면 내용이 바뀝니다. 소설 데이터는 novels.js에 따로 있습니다.

   이 파일이 하는 일:
   0. 개인 설정값 (직접 수정하는 곳)
   1. 라이트 / 다크 테마 전환
   2. 홈 / 활동 / 소설 사이 페이지 전환 + 소설 목록↔읽기 전환 (hash 기반)
   3. 홈 링크 아이콘 / 활동 목록 / 소설 목록·읽기 렌더링
   4. Spotify 지금 재생 중인 곡 + "같이 듣기" 표시
   5. Discord 온라인 상태 + 접속 시간 표시
   6. 마우스/터치 인터랙션 (parallax, 프로필 사진 추적, 클릭 눌림 효과)
   7. 프로필 이미지 복사 억제 (완전한 보호는 아니며, 최소한의 번거로움만 추가)
   ========================================================================== */

/* ============================================================
   0. 여기만 고치면 됩니다
   ============================================================ */

// 프로필 아래 표시할 아주 짧은 한 줄 소개. 비워두면 표시되지 않습니다.
const profile = {
  statusLine: "",
  pfpCredit: {
    name: "@rmflawoddl_",
    url: "",
  },
};

// 프로필 사진 경로. 웹 최적화 이미지(예: assets/images/profile-web.webp)가
// 있다면 이 한 줄만 바꾸면 됩니다.
const PROFILE_IMAGE_SRC = "assets/images/profile.png";

// 홈 화면에 가로로 표시할 외부 링크. url을 비워두면 해당 항목은 표시되지 않습니다.
// icon 값은 아래 ICONS 객체의 키 중 하나: github, discord, email, spotify, roblox, link
const links = [
  { name: "GitHub", url: "https://github.com/DimChi-0104", icon: "github" },
  { name: "Discord", url: "https://discord.com/users/662509817234980895", icon: "discord" },
  { name: "Email", url: "mailto:wwwkgiok@gmail.com", icon: "email" },
  {
    name: "Spotify",
    url: "https://open.spotify.com/user/31xc2lzuh2ejdtq3zvtqdohpvxze?si=efc5b222b7f64cd9",
    icon: "spotify",
  },
  { name: "Roblox", url: "https://www.roblox.com/ko/users/1495054308/profile", icon: "roblox" },
];

// 활동. 내가 직접 한 일을 짧게 남기는 곳 — 샘플 데이터는 넣지 않았습니다.
// 추가 예시: { date: "2026.09.13", title: "웹사이트 개편", text: "구조를 다시 짰다." }
const activities = [];

/* ============================================================
   여기서부터는 위 값들을 화면에 반영하는 코드입니다
   ============================================================ */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ------------------------------------------------------------------
     1. 라이트 / 다크 테마 (사이드바 버튼 + 모바일 하단 바 버튼 동시 반영)
     ------------------------------------------------------------------ */
  const THEME_KEY = "dimchi-theme";
  const themeButtons = [
    document.getElementById("themeToggle"),
    document.getElementById("themeToggleMobile"),
  ].filter(Boolean);

  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function currentTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return systemPrefersDark() ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeButtons.forEach((btn) => (btn.textContent = theme === "dark" ? "라이트" : "다크"));
    localStorage.setItem(THEME_KEY, theme);
  }

  applyTheme(currentTheme());

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  });

  /* ------------------------------------------------------------------
     2. 페이지 전환 (홈 / 활동 / 소설) + 소설 목록 ↔ 읽기 전환
     ------------------------------------------------------------------
     세 개의 <section class="page">를 hash(#home,#activity,#novels)에 따라
     하나씩만 보여준다. 소설 안에서는 #novels/<id> 형태로 특정 작품을 열고,
     같은 슬라이드 전환 방식을 소설 목록<->읽기 화면 사이에도 그대로 쓴다. */
  const PAGES = ["home", "activity", "novels"];
  const LEAVE_MS = 150; // style.css .page-leaving 전환 시간과 맞춰져 있음
  const ENTER_MS = 220; // style.css 기본 .page 전환 시간과 맞춰져 있음 (합쳐서 약 370ms)
  const SLIDE_PX = 16; // "살짝 밀리는" 정도의 슬라이드 거리

  const navLinks = document.querySelectorAll(".sidebar-nav a, .bottom-nav a");
  let activePage = null;

  function getPageEl(name) {
    return document.getElementById("page-" + name);
  }

  function setActiveNav(name) {
    navLinks.forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-page") === name);
    });
  }

  // "#novels/example" -> { page: "novels", sub: "example" }
  function parseHash() {
    const raw = (location.hash || "").replace("#", "");
    const [page, sub] = raw.split("/");
    return { page: PAGES.includes(page) ? page : "home", sub: sub || null };
  }

  // 공용 슬라이드 전환: 하나의 컨테이너 안에서 current -> next로 바꾼다.
  // 최상위 페이지 전환과 소설 목록<->읽기 전환이 이 함수를 함께 쓴다.
  function slideSwap(current, next, forward, onSwapped) {
    if (current === next) return;
    const slideOut = forward ? -SLIDE_PX : SLIDE_PX;
    const slideIn = forward ? SLIDE_PX : -SLIDE_PX;

    function enterNext() {
      if (next) {
        next.style.setProperty("--slide-in", slideIn + "px");
        next.hidden = false;
        next.classList.add("page-entering-start");
        void next.offsetWidth; // 강제 reflow: 시작 위치가 반영된 뒤에 transition이 걸리도록
        next.classList.remove("page-entering-start");
      }
      if (onSwapped) onSwapped();
    }

    if (prefersReducedMotion) {
      if (current) current.hidden = true;
      enterNext();
      return;
    }

    if (current) {
      current.style.setProperty("--slide-out", slideOut + "px");
      current.classList.add("page-leaving");
      setTimeout(() => {
        current.hidden = true;
        current.classList.remove("page-leaving");
        enterNext();
      }, LEAVE_MS);
    } else {
      enterNext();
    }
    void ENTER_MS; // 실제 지속시간은 style.css에서 관리 (여기서는 참고용 상수)
  }

  function showPage(name) {
    if (!PAGES.includes(name)) name = "home";
    if (name === activePage) return;

    const current = getPageEl(activePage);
    const next = getPageEl(name);
    if (!next) return;

    // 메뉴 순서상 뒤에 있는 페이지로 가면 왼쪽으로, 앞으로 돌아가면 오른쪽으로 민다
    const forward = PAGES.indexOf(name) > PAGES.indexOf(activePage);
    setActiveNav(name);
    activePage = name;
    slideSwap(current, next, forward);
  }

  /* --- 소설 목록 ↔ 읽기 화면 (novels 페이지 내부 전용 미니 전환) --- */
  const novelsListEl = document.getElementById("novels-list");
  const novelsReaderEl = document.getElementById("novels-reader");
  let novelView = "list"; // "list" | "reader"

  function showNovelView(view, novelId) {
    if (view === novelView && view === "list") return;
    const forward = view === "reader"; // 목록 -> 읽기는 오른쪽에서, 반대는 왼쪽에서
    const current = novelView === "reader" ? novelsReaderEl : novelsListEl;
    const next = view === "reader" ? novelsReaderEl : novelsListEl;

    if (view === "reader" && novelId) renderNovelReader(novelId);

    novelView = view;
    slideSwap(current, next, forward);
  }

  // 처음 로드할 때는 애니메이션 없이 맞는 화면만 바로 보이게 한다
  function initRouter() {
    const { page, sub } = parseHash();
    PAGES.forEach((name) => {
      const el = getPageEl(name);
      if (el) el.hidden = name !== page;
    });
    activePage = page;
    setActiveNav(page);

    if (page === "novels" && sub) {
      renderNovelReader(sub);
      novelView = "reader";
      novelsListEl.hidden = true;
      novelsReaderEl.hidden = false;
    } else {
      novelView = "list";
      novelsListEl.hidden = false;
      novelsReaderEl.hidden = true;
    }
  }

  initRouter();

  window.addEventListener("hashchange", () => {
    const { page, sub } = parseHash();
    showPage(page);
    if (page === "novels") showNovelView(sub ? "reader" : "list", sub);
  });

  /* 모바일 좌우 스와이프로도 페이지를 넘길 수 있게 한다.
     세로 스크롤을 방해하면 안 되므로 preventDefault는 전혀 호출하지 않고,
     제스처가 끝난 뒤(touchend) 이동 거리/방향만 보고 판단한다. */
  const SWIPE_MIN_DISTANCE = 60;
  const SWIPE_MAX_OFF_AXIS = 70;
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;

      if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
      if (Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;

      const currentIndex = PAGES.indexOf(activePage);
      const targetIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      if (targetIndex < 0 || targetIndex >= PAGES.length) return;

      location.hash = PAGES[targetIndex];
    },
    { passive: true }
  );

  /* ------------------------------------------------------------------
     3. 홈 링크 아이콘 / 활동 / 소설 렌더링
     ------------------------------------------------------------------ */
  const ICONS = {
    github:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.68.42.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/></svg>',
    discord:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V6A1.5 1.5 0 0 1 4 4.5Z"/></svg>',
    email:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3.5 5.5h17A1 1 0 0 1 21.5 6.5v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"/><path d="M3.8 6.2 12 12.5l8.2-6.3"/></svg>',
    spotify:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15V4.8l10-2v10" fill="none"/><path d="M9 18a3 3 0 1 1-2.12-5.12A3 3 0 0 1 9 15v3Z" fill="currentColor" stroke="none"/><path d="M19 12.8a3 3 0 1 1-2.12-5.12A3 3 0 0 1 19 9.8v3Z" fill="currentColor" stroke="none"/></svg>',
    roblox:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M12 4 19 8 19 16 12 20 5 16 5 8 Z"/><path d="M12 12 12 4 M12 12 19 16 M12 12 5 16"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5l1.6-1.6a3.5 3.5 0 0 1 5 5L16 12.5"/><path d="M13 16.5l-1.6 1.6a3.5 3.5 0 0 1-5-5L8 11.5"/></svg>',
  };

  function renderLinks() {
    const row = document.getElementById("linkRow");
    if (!row) return;

    links
      .filter((l) => l.url)
      .forEach((l) => {
        const isMailto = l.url.startsWith("mailto:");
        const a = document.createElement("a");
        a.className = "link-item";
        a.href = l.url;
        if (!isMailto) {
          // mailto는 새 탭이 필요 없으므로 실제 외부 웹 링크에만 적용한다
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        a.setAttribute("aria-label", l.name);

        const icon = document.createElement("span");
        icon.className = "link-icon";
        icon.innerHTML = ICONS[l.icon] || ICONS.link;

        const label = document.createElement("span");
        label.className = "link-label";
        label.textContent = l.name;

        a.appendChild(icon);
        a.appendChild(label);
        row.appendChild(a);
      });
  }

  function renderProfileExtras() {
    const photo = document.getElementById("profilePhoto");
    if (photo) photo.src = PROFILE_IMAGE_SRC;

    if (profile.statusLine) {
      const bioEl = document.getElementById("homeBio");
      bioEl.textContent = profile.statusLine;
      bioEl.hidden = false;
    }

    const creditNameEl = document.getElementById("pfpCreditName");
    if (creditNameEl) {
      creditNameEl.textContent = profile.pfpCredit.name;
      if (profile.pfpCredit.url) {
        const link = document.createElement("a");
        link.id = "pfpCreditName";
        link.href = profile.pfpCredit.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = profile.pfpCredit.name;
        creditNameEl.replaceWith(link);
      }
    }
  }

  function renderActivities() {
    const list = document.getElementById("activityList");
    const empty = document.getElementById("activitiesEmpty");
    if (!list) return;

    if (activities.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const sorted = activities.slice().sort((a, b) => b.date.localeCompare(a.date));
    sorted.forEach((entry) => {
      const item = document.createElement("div");
      item.className = "activity-entry";

      const date = document.createElement("p");
      date.className = "activity-date";
      date.textContent = entry.date;
      item.appendChild(date);

      if (entry.title) {
        const title = document.createElement("p");
        title.className = "activity-title";
        title.textContent = entry.title;
        item.appendChild(title);
      }

      const text = document.createElement("p");
      text.className = "activity-text";
      text.textContent = entry.text;
      item.appendChild(text);

      list.appendChild(item);
    });
  }

  function renderNovelList() {
    const list = document.getElementById("novelList");
    const empty = document.getElementById("novelsEmpty");
    if (!list) return;

    if (!novels || novels.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const sorted = novels.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    sorted.forEach((novel) => {
      const item = document.createElement("div");
      item.className = "novel-item";

      const title = document.createElement("a");
      title.className = "novel-item-title";
      title.href = "#novels/" + encodeURIComponent(novel.id);
      title.textContent = novel.title;
      item.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "novel-item-meta";
      meta.textContent = [novel.subtitle, novel.date].filter(Boolean).join(" · ");
      item.appendChild(meta);

      if (novel.description) {
        const desc = document.createElement("p");
        desc.className = "novel-item-desc";
        desc.textContent = novel.description;
        item.appendChild(desc);
      }

      list.appendChild(item);
    });
  }

  function renderNovelReader(id) {
    const novel = (novels || []).find((n) => n.id === id);
    const titleEl = document.getElementById("novelReaderTitle");
    const subtitleEl = document.getElementById("novelReaderSubtitle");
    const dateEl = document.getElementById("novelReaderDate");
    const contentEl = document.getElementById("novelReaderContent");
    if (!titleEl) return;

    if (!novel) {
      titleEl.textContent = "찾을 수 없는 작품입니다.";
      subtitleEl.textContent = "";
      dateEl.textContent = "";
      contentEl.innerHTML = "";
      return;
    }

    titleEl.textContent = novel.title || "";
    subtitleEl.textContent = novel.subtitle || "";
    dateEl.textContent = novel.date || "";

    contentEl.innerHTML = "";
    (novel.content || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        contentEl.appendChild(p);
      });
  }

  renderLinks();
  renderProfileExtras();
  renderActivities();
  renderNovelList();

  /* ------------------------------------------------------------------
     4. Spotify: 지금 재생 중인 곡 + 같이 듣기
     ------------------------------------------------------------------ */
  function formatClock(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const spotifyBox = document.getElementById("spotifyBox");
  const npQuiet = document.getElementById("nowPlayingQuiet");
  const npTrackBox = document.getElementById("nowPlayingTrack");
  const npCover = document.getElementById("npCover");
  const npTitle = document.getElementById("npTitle");
  const npArtist = document.getElementById("npArtist");
  const npProgressBar = document.getElementById("npProgressBar");
  const npCurrent = document.getElementById("npCurrent");
  const npDuration = document.getElementById("npDuration");
  const listenTogetherBtn = document.getElementById("listenTogetherBtn");

  let npIsPlaying = false;
  let npProgressMs = 0;
  let npDurationMs = 0;

  function renderNpProgress() {
    if (!npIsPlaying || npDurationMs === 0) return;
    const pct = Math.min(100, (npProgressMs / npDurationMs) * 100);
    npProgressBar.style.width = pct + "%";
    npCurrent.textContent = formatClock(npProgressMs);
  }

  async function pollSpotify() {
    if (!npQuiet) return;
    try {
      const res = await fetch("/api/spotify/now-playing");
      const data = await res.json();
      const playing = Boolean(data.connected && data.isPlaying && data.track);

      npIsPlaying = playing;
      npQuiet.hidden = playing;
      npTrackBox.hidden = !playing;
      // 곡이 없을 때는 박스 테두리/배경 없이 문구만 보이게 한다
      spotifyBox.classList.toggle("is-quiet", !playing);

      // "같이 듣기": 재생 중이고 공식 링크가 있을 때만 보여준다 (독립 기능)
      if (playing && data.track.url) {
        listenTogetherBtn.href = data.track.url;
        listenTogetherBtn.hidden = false;
      } else {
        listenTogetherBtn.hidden = true;
      }

      if (!playing) return;

      npProgressMs = data.progressMs || 0;
      npDurationMs = data.durationMs || 0;

      npTitle.textContent = data.track.name;
      npArtist.textContent = data.track.artist;
      npDuration.textContent = formatClock(npDurationMs);

      if (data.track.albumArt) {
        npCover.src = data.track.albumArt;
        npCover.alt = `${data.track.name} 앨범 커버`;
      }

      renderNpProgress();
    } catch {
      npIsPlaying = false;
      npQuiet.hidden = false;
      npTrackBox.hidden = true;
      spotifyBox.classList.add("is-quiet");
      listenTogetherBtn.hidden = true;
    }
  }

  pollSpotify();
  setInterval(pollSpotify, 5000);
  setInterval(() => {
    if (!npIsPlaying) return;
    npProgressMs = Math.min(npDurationMs, npProgressMs + 1000);
    renderNpProgress();
  }, 1000);

  /* ------------------------------------------------------------------
     5. Discord: 온라인 상태 + 접속 시간
     ------------------------------------------------------------------ */
  const discordDot = document.getElementById("discordDot");
  const discordStatusText = document.getElementById("discordStatusText");
  const discordUptimeText = document.getElementById("discordUptimeText");
  const discordStatusDesc = document.getElementById("discordStatusDesc");

  const STATUS_LABELS = { online: "온라인", idle: "자리 비움", dnd: "방해 금지", offline: "오프라인" };
  const STATUS_DESCRIPTIONS = {
    online: "지금 활동하고 있어요.",
    idle: "잠시 자리를 비웠어요.",
    dnd: "방해받고 싶지 않은 시간이에요.",
    offline: "지금은 오프라인 상태예요.",
  };

  let discordOnlineSince = null;

  function formatUptime(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) return "방금";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
  }

  function renderDiscordUptime() {
    if (!discordUptimeText) return;
    discordUptimeText.textContent = discordOnlineSince
      ? formatUptime(Date.now() - discordOnlineSince)
      : "";
  }

  async function pollDiscord() {
    if (!discordDot) return;
    try {
      const res = await fetch("/api/discord/status");
      const data = await res.json();
      const status = ["online", "idle", "dnd", "offline"].includes(data.status)
        ? data.status
        : "offline";

      discordDot.className = "discord-dot " + status;
      discordStatusText.textContent = STATUS_LABELS[status];
      discordStatusDesc.textContent = STATUS_DESCRIPTIONS[status];
      discordOnlineSince = status === "offline" ? null : data.onlineSince;
      renderDiscordUptime();
    } catch {
      discordDot.className = "discord-dot offline";
      discordStatusText.textContent = STATUS_LABELS.offline;
      discordStatusDesc.textContent = STATUS_DESCRIPTIONS.offline;
      discordOnlineSince = null;
      renderDiscordUptime();
    }
  }

  pollDiscord();
  setInterval(pollDiscord, 15000);
  setInterval(renderDiscordUptime, 60000);

  /* ------------------------------------------------------------------
     6. 마우스 / 터치 인터랙션
     ------------------------------------------------------------------ */
  const photoWrap = document.getElementById("profilePhotoWrap");
  const photo = document.getElementById("profilePhoto");

  if (!prefersReducedMotion) {
    document.addEventListener("touchstart", function () {}, { passive: true });

    const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    /* --- 프로필 사진: 마우스를 올리면 아주 살짝 따라가고, 누르면 살짝 눌린다 --- */
    if (photo && photoWrap) {
      const HOVER_MAX_PX = 5;
      let hoverX = 0;
      let hoverY = 0;
      let pressed = false;

      function applyPhotoTransform() {
        const scale = pressed ? 0.94 : 1;
        photo.style.transform = `translate(${hoverX}px, ${hoverY}px) scale(${scale})`;
      }

      if (hasFinePointer) {
        photoWrap.addEventListener("mousemove", (e) => {
          const rect = photoWrap.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = ((e.clientX - cx) / (rect.width / 2)) * HOVER_MAX_PX;
          const dy = ((e.clientY - cy) / (rect.height / 2)) * HOVER_MAX_PX;
          hoverX = Math.max(-HOVER_MAX_PX, Math.min(HOVER_MAX_PX, dx));
          hoverY = Math.max(-HOVER_MAX_PX, Math.min(HOVER_MAX_PX, dy));
          applyPhotoTransform();
        });

        photoWrap.addEventListener("mouseleave", () => {
          hoverX = 0;
          hoverY = 0;
          applyPhotoTransform();
        });
      }

      const press = () => {
        pressed = true;
        applyPhotoTransform();
      };
      const release = () => {
        pressed = false;
        applyPhotoTransform();
      };

      photoWrap.addEventListener("mousedown", press);
      photoWrap.addEventListener("mouseup", release);
      photoWrap.addEventListener("mouseleave", release);
      photoWrap.addEventListener("touchstart", press, { passive: true });
      photoWrap.addEventListener("touchend", release, { passive: true });
      photoWrap.addEventListener("touchcancel", release, { passive: true });
    }

    /* --- 패널 전체 mouse parallax: PC에서만, 아주 약하게 --- */
    if (hasFinePointer) {
      const decorEl = document.getElementById("discordDot");
      const contentEl = document.getElementById("app");

      let targetX = 0;
      let targetY = 0;
      let rafScheduled = false;

      function applyParallax() {
        rafScheduled = false;
        if (photoWrap) photoWrap.style.transform = `translate(${targetX * 5}px, ${targetY * 5}px)`;
        if (decorEl) decorEl.style.transform = `translate(${targetX * 8}px, ${targetY * 8}px)`;
        if (contentEl) contentEl.style.transform = `translate(${targetX * 2}px, ${targetY * 2}px)`;
      }

      window.addEventListener(
        "mousemove",
        (e) => {
          targetX = e.clientX / window.innerWidth - 0.5;
          targetY = e.clientY / window.innerHeight - 0.5;
          if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(applyParallax);
          }
        },
        { passive: true }
      );
    }
  }

  /* ------------------------------------------------------------------
     7. 프로필 이미지 복사 억제 (완전한 보호는 아님, 최소한의 번거로움만 추가)
     ------------------------------------------------------------------
     사이트 전체 우클릭은 막지 않고, 이 이미지 하나에만 적용한다. */
  if (photo) {
    photo.addEventListener("dragstart", (e) => e.preventDefault());
    photo.addEventListener("contextmenu", (e) => e.preventDefault());
  }
})();
