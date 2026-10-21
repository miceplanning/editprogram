/*
  =====================================================================
   미로 미션 페이지 (maze.js) — "삼다도 찾아 삼만리"
  =====================================================================
  ✅ content.js 의 maze = { title, notice, teams[], staffCode, draw, recognition, mazes[] }
     를 읽어 조 선택 → 미로 뽑기 → 미션 안내 → 타이머 → 탈출 완료 순서로 진행합니다.
  ✅ 서버가 없으므로 진행 상태는 이 휴대폰(localStorage)에만 저장됩니다.
     조장 한 명의 휴대폰으로 진행해주세요. 새로고침/화면 꺼짐에도 시간은 계속 흐릅니다.
  ✅ "인형 찾았다" 사진은 휴대폰 안에서 TensorFlow.js(MobileNet)로 미리 등록한
     인형 사진(dollRefs)과 비교해, 해당 미로의 인형으로 판단될 때만 보너스를 줍니다.
     사진은 어디에도 업로드되지 않습니다.
  ✅ 탈출 완료/기록 초기화는 스태프 코드(staffCode)를 입력해야 합니다.
  =====================================================================
*/

(function () {
  const TF_SRC = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js";
  const MOBILENET_SRC = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js";

  let c, cfg, root, state, storeKey, tickTimer, wakeLock;
  let model = null, modelPromise = null, refCache = null;

  // ---------------- 저장 ----------------
  function load() {
    try { return JSON.parse(localStorage.getItem(storeKey)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) { /* 저장 불가(사생활 보호 모드 등) */ }
  }

  function mazeOf(key) { return (cfg.mazes || []).find((m) => m.key === key); }
  function limitMs(m) { return (Number(m.timeLimitMin) || 0) * 60000; }
  function bonusMs(m) { return state.dollFound ? (Number(m.bonusMin) || 0) * 60000 : 0; }

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function stars(n) { return "⭐".repeat(Number(n) || 0); }
  function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  // ---------------- 인형 인식 ----------------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("load failed: " + src));
      document.head.appendChild(s);
    });
  }
  function loadModel() {
    if (!modelPromise) {
      modelPromise = (window.tf ? Promise.resolve() : loadScript(TF_SRC))
        .then(() => (window.mobilenet ? null : loadScript(MOBILENET_SRC)))
        .then(() => window.mobilenet.load({ version: 2, alpha: 1.0 }))
        .then((m) => { model = m; updateModelStatus(); return m; })
        .catch((e) => { modelPromise = null; updateModelStatus(true); throw e; });
    }
    return modelPromise;
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image: " + src));
      img.src = src;
    });
  }
  // 정사각형으로 잘라 224px 캔버스로 (s: 확대 비율, dy: 위아래 이동, flip: 좌우반전)
  function squareView(img, opt) {
    const o = opt || {};
    const cv = document.createElement("canvas");
    cv.width = cv.height = 224;
    const g = cv.getContext("2d");
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const side = Math.min(w, h) * (o.s || 1);
    const sx = (w - side) / 2, sy = (h - side) / 2 + (o.dy || 0) * h;
    if (o.flip) { g.translate(224, 0); g.scale(-1, 1); }
    g.drawImage(img, sx, sy, side, side, 0, 0, 224, 224);
    return cv;
  }
  function embed(canvas) {
    return window.tf.tidy(() => {
      const e = model.infer(canvas, true).flatten();
      return e.div(e.norm()).arraySync();
    });
  }
  function cosine(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

  // 미로별 등록 인형 사진 → 특징 벡터 (원본/확대/좌우반전 3개씩)
  async function refEmbeddings() {
    if (refCache) return refCache;
    const out = {};
    for (const m of cfg.mazes || []) {
      out[m.key] = [];
      for (const src of m.dollRefs || []) {
        const img = await loadImage(src);
        out[m.key].push(embed(squareView(img)));
        out[m.key].push(embed(squareView(img, { s: 0.75, dy: -0.05 })));
        out[m.key].push(embed(squareView(img, { flip: true })));
      }
    }
    refCache = out;
    return out;
  }
  // 사진을 전체/70%/50% 세 가지로 잘라 가장 비슷한 점수를 씁니다 (인형이 작게 찍혀도 잡히도록)
  async function scorePhoto(img) {
    const refs = await refEmbeddings();
    const scores = {};
    Object.keys(refs).forEach((k) => (scores[k] = 0));
    for (const s of [1, 0.7, 0.5]) {
      const e = embed(squareView(img, { s }));
      Object.keys(refs).forEach((k) => {
        refs[k].forEach((r) => { scores[k] = Math.max(scores[k], cosine(e, r)); });
      });
    }
    return scores;
  }
  function isMatch(scores, key) {
    const rc = cfg.recognition || {};
    const threshold = rc.threshold != null ? rc.threshold : 0.62;
    const margin = rc.margin != null ? rc.margin : 0.05;
    const mine = scores[key] || 0;
    const other = Math.max(0, ...Object.keys(scores).filter((k) => k !== key).map((k) => scores[k]));
    return mine >= threshold && mine - other >= margin;
  }
  function thumbnail(img) {
    const cv = document.createElement("canvas");
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const k = 240 / Math.max(w, h);
    cv.width = Math.round(w * k); cv.height = Math.round(h * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.7);
  }
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // ---------------- 페이지 안 확인창 ----------------
  // 일부 앱 내 브라우저는 confirm/prompt 를 막아두기 때문에 직접 만든 확인창을 씁니다.
  // onOk(box) 가 문자열을 돌려주면 그 문구를 오류로 보여주고 창을 닫지 않습니다.
  function openModal(title, bodyHtml, onOk, okText) {
    const wrap = document.createElement("div");
    wrap.className = "maze-modal";
    wrap.innerHTML =
      '<div class="maze-modal-box">' +
      '<div class="section-title">' + title + "</div>" +
      bodyHtml +
      '<p class="maze-hint maze-warn" data-err></p>' +
      '<div class="maze-modal-actions"><button type="button" class="btn btn-outline" data-cancel>취소</button>' +
      '<button type="button" class="btn btn-primary" data-ok>' + (okText || "확인") + "</button></div>" +
      "</div>";
    document.body.appendChild(wrap);
    wrap.querySelector("[data-cancel]").addEventListener("click", () => wrap.remove());
    wrap.querySelector("[data-ok]").addEventListener("click", () => {
      const err = onOk(wrap);
      if (typeof err === "string") { wrap.querySelector("[data-err]").textContent = err; return; }
      wrap.remove();
    });
    return wrap;
  }
  function staffCodeInputHtml() {
    return cfg.staffCode ? '<input type="password" inputmode="numeric" class="maze-code" data-code placeholder="스태프 코드" autocomplete="off" />' : "";
  }
  function staffCodeError(box) {
    const code = box.querySelector("[data-code]");
    return code && code.value.trim() !== String(cfg.staffCode) ? "스태프 코드가 맞지 않아요." : null;
  }

  // ---------------- 화면 그리기 ----------------
  function render() {
    clearInterval(tickTimer);
    if (!state.team || !state.mazeKey) return renderSetup();
    if (!state.startAt) return renderReady();
    if (!state.finishedAt) return renderRunning();
    return renderResult();
  }

  function headerHtml() {
    return (cfg.notice ? '<div class="card"><div class="flight-notice">' + escapeHtml(cfg.notice) + "</div></div>" : "");
  }

  function renderSetup() {
    const teams = cfg.teams || [];
    root.innerHTML =
      headerHtml() +
      '<div class="card maze-setup">' +
      '<div class="section-title">👥 우리 조 선택</div>' +
      '<div class="maze-team-grid">' +
      teams.map((t) => '<button type="button" class="maze-team' + (state.team === t ? " selected" : "") + '" data-team="' + escapeHtml(t) + '">' + escapeHtml(t) + "</button>").join("") +
      "</div>" +
      '<p class="maze-hint">조장 한 명의 휴대폰으로만 진행해주세요.</p>' +
      "</div>" +
      '<div class="card">' +
      '<div class="section-title">🎲 미로 뽑기</div>' +
      '<div class="maze-draw-box" id="maze-draw-box">?</div>' +
      (cfg.draw === false
        ? '<div class="maze-choice-row">' + (cfg.mazes || []).map((m) => '<button type="button" class="btn btn-outline" data-pick="' + escapeHtml(m.key) + '">' + escapeHtml(m.name) + "</button>").join("") + "</div>"
        : '<button type="button" class="btn btn-primary maze-big-btn" id="maze-draw-btn"' + (state.team ? "" : " disabled") + ">미로 뽑기!</button>" +
          '<p class="maze-hint">한 번 뽑으면 바꿀 수 없어요.</p>') +
      "</div>";

    root.querySelectorAll("[data-team]").forEach((b) =>
      b.addEventListener("click", () => { state.team = b.dataset.team; save(); renderSetup(); })
    );
    root.querySelectorAll("[data-pick]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!state.team) return openModal("👥 조 선택", '<p class="maze-hint">먼저 우리 조를 선택해주세요.</p>', () => null);
        state.mazeKey = b.dataset.pick; save(); render();
      })
    );
    const drawBtn = document.getElementById("maze-draw-btn");
    if (drawBtn) drawBtn.addEventListener("click", runDraw);
  }

  function runDraw() {
    const mazes = cfg.mazes || [];
    if (!state.team || !mazes.length) return;
    const box = document.getElementById("maze-draw-box");
    const btn = document.getElementById("maze-draw-btn");
    btn.disabled = true;
    root.querySelectorAll("[data-team]").forEach((b) => (b.disabled = true));
    const pick = mazes[Math.floor(Math.random() * mazes.length)];
    let i = 0, delay = 60;
    function spin() {
      const m = mazes[i++ % mazes.length];
      box.textContent = (m.emoji ? m.emoji + " " : "") + m.name;
      if (delay < 320) { delay *= 1.12; setTimeout(spin, delay); return; }
      box.textContent = (pick.emoji ? pick.emoji + " " : "") + pick.name;
      box.classList.add("done");
      vibrate(80);
      state.mazeKey = pick.key;
      state.drawnAt = Date.now();
      save();
      setTimeout(render, 1300);
    }
    spin();
  }

  function missionCardHtml(m) {
    const limit = Number(m.timeLimitMin) || 0, bonus = Number(m.bonusMin) || 0;
    return (
      '<div class="card maze-mission">' +
      '<div class="maze-title-row"><span class="maze-emoji">' + escapeHtml(m.emoji || "🧭") + "</span>" +
      "<div><div class=\"maze-name\">" + escapeHtml(m.name) + "</div>" +
      '<div class="maze-meta">난이도 ' + stars(m.difficulty) + (m.length ? " · 총 길이 " + escapeHtml(m.length) : "") + "</div></div></div>" +
      '<div class="maze-limit">⏱ 제한시간 <b>' + limit + "분</b>" +
      (bonus ? " · " + escapeHtml(m.character || "인형") + " 발견 시 <b>+" + bonus + "분</b> (총 " + (limit + bonus) + "분)" : "") + "</div>" +
      (m.story ? '<p class="maze-story">' + escapeHtml(m.story) + "</p>" : "") +
      ((m.missions || []).length ? '<div class="maze-sub">미션</div><ol class="maze-list">' + m.missions.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ol>" : "") +
      ((m.bonusRules || []).length ? '<div class="maze-sub">보너스</div><ul class="maze-list">' + m.bonusRules.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>" : "") +
      (m.photoSpotImage ? '<div class="maze-sub">사진 스팟</div><img class="maze-spot-img" src="' + escapeHtml(m.photoSpotImage) + '" alt="' + escapeHtml(m.name) + ' 사진 스팟" loading="lazy" />' : "") +
      ((m.cautions || []).length ? '<div class="maze-sub">주의사항</div><ul class="maze-list maze-caution">' + m.cautions.map((x) => "<li>⚠️ " + escapeHtml(x) + "</li>").join("") + "</ul>" : "") +
      (cfg.helpPhone ? '<a class="btn btn-outline maze-help" href="' + telHref(cfg.helpPhone) + '">📞 길을 잃었어요 (' + escapeHtml(cfg.helpPhone) + ")</a>" : "") +
      "</div>"
    );
  }

  function renderReady() {
    const m = mazeOf(state.mazeKey);
    root.innerHTML =
      headerHtml() +
      '<div class="card maze-team-banner">' + escapeHtml(state.team) + " · " + escapeHtml(m.name) + "</div>" +
      '<div class="card">' +
      '<button type="button" class="btn btn-primary maze-big-btn" id="maze-start">🚩 입장! 타이머 시작</button>' +
      '<p class="maze-hint">' + escapeHtml(cfg.startHint || "미로 입구에서 팀원 전원이 모이면 눌러주세요.") + "</p>" +
      '<p class="maze-hint" id="maze-model-status"></p>' +
      "</div>" +
      missionCardHtml(m) +
      staffResetHtml();
    document.getElementById("maze-start").addEventListener("click", () => {
      openModal("🚩 타이머 시작", '<p class="maze-hint">' + escapeHtml(state.team + " · " + m.name) + " 타이머를 시작할까요?<br>시작하면 멈출 수 없어요.</p>", () => {
        state.startAt = Date.now();
        save();
        vibrate(120);
        render();
      }, "시작");
    });
    bindStaffReset();
    loadModel().catch(() => {});
    updateModelStatus();
  }

  function updateModelStatus(failed) {
    const el = document.getElementById("maze-model-status");
    if (!el) return;
    el.textContent = failed
      ? "⚠️ 인형 인식을 불러오지 못했어요. 인형을 들고 나오면 출구에서 스태프가 보너스를 적용해드려요."
      : model ? "✅ 인형 인식 준비 완료" : "⏳ 인형 인식 준비 중… (데이터 연결 필요)";
  }

  function renderRunning() {
    const m = mazeOf(state.mazeKey);
    root.innerHTML =
      '<div class="card maze-team-banner">' + escapeHtml(state.team) + " · " + escapeHtml(m.name) + "</div>" +
      '<div class="card maze-timer-card" id="maze-timer-card">' +
      '<div class="maze-timer-label" id="maze-timer-label">남은 시간</div>' +
      '<div class="maze-timer" id="maze-timer">--:--</div>' +
      '<div class="maze-progress"><div id="maze-progress-bar"></div></div>' +
      '<div class="maze-timer-sub" id="maze-timer-sub"></div>' +
      "</div>" +
      '<div class="card">' +
      dollBlockHtml(m) +
      spotBlockHtml(m) +
      '<button type="button" class="btn btn-accent maze-big-btn" id="maze-finish">🏁 탈출 완료</button>' +
      '<p class="maze-hint">출구에서 스태프에게 확인받은 뒤 눌러주세요. 팀원 전원이 함께 나와야 해요.</p>' +
      '<p class="maze-hint" id="maze-model-status"></p>' +
      "</div>" +
      missionCardHtml(m) +
      staffResetHtml();

    bindPhotoInputs(m);
    document.getElementById("maze-finish").addEventListener("click", () => openFinishDialog(m));
    bindStaffReset();
    loadModel().catch(() => {});
    updateModelStatus();
    requestWakeLock();
    tick();
    tickTimer = setInterval(tick, 250);
  }

  function dollBlockHtml(m) {
    if (state.dollFound) {
      return '<div class="maze-done-row"><img src="' + (state.dollThumb || "") + '" alt="" />' +
        "<div><b>" + escapeHtml(m.character || "인형") + " 발견! +" + (Number(m.bonusMin) || 0) + "분</b><br><span>" + (state.dollBy === "staff" ? "스태프 확인" : "사진 인증 완료") + "</span></div></div>";
    }
    return '<label class="btn btn-primary maze-big-btn maze-file-btn">🔍 ' + escapeHtml(m.character || "인형") + " 찾았다! 사진 찍기" +
      '<input type="file" accept="image/*" capture="environment" id="maze-doll-input" hidden /></label>' +
      '<p class="maze-hint" id="maze-doll-msg">인형이 화면에 크게 나오도록 찍어주세요.</p>';
  }
  function spotBlockHtml(m) {
    if (state.spotThumb) {
      return '<div class="maze-done-row"><img src="' + state.spotThumb + '" alt="" /><div><b>사진 스팟 단체사진 완료</b><br><span>촬영자 제외 팀원 전원</span></div></div>';
    }
    return '<label class="btn btn-outline maze-file-btn">📸 사진 스팟 단체사진 찍기' +
      '<input type="file" accept="image/*" capture="environment" id="maze-spot-input" hidden /></label>';
  }

  function bindPhotoInputs(m) {
    const dollInput = document.getElementById("maze-doll-input");
    if (dollInput) dollInput.addEventListener("change", () => checkDoll(m, dollInput));
    const spotInput = document.getElementById("maze-spot-input");
    if (spotInput) spotInput.addEventListener("change", async () => {
      const f = spotInput.files && spotInput.files[0];
      if (!f) return;
      const img = await fileToImage(f);
      state.spotThumb = thumbnail(img);
      save();
      renderRunning();
    });
  }

  async function checkDoll(m, input) {
    const f = input.files && input.files[0];
    const msg = document.getElementById("maze-doll-msg");
    if (!f) return;
    input.value = "";
    msg.className = "maze-hint";
    msg.textContent = "🔎 인형 확인 중…";
    try {
      const img = await fileToImage(f);
      await loadModel();
      const scores = await scorePhoto(img);
      if (isMatch(scores, m.key)) {
        if (!state.dollFound) {
          state.dollFound = true;
          state.dollBy = "photo";
          state.dollAt = Date.now();
          state.dollThumb = thumbnail(img);
          save();
          vibrate([100, 60, 100]);
          flashBonus(m);
        }
        renderRunning();
      } else {
        const other = (cfg.mazes || []).find((x) => x.key !== m.key && isMatch(scores, x.key));
        msg.className = "maze-hint maze-warn";
        msg.textContent = other
          ? "이 인형은 " + other.name + "의 " + (other.character || "인형") + "이에요. " + m.name + "의 " + (m.character || "인형") + "을 찾아주세요!"
          : "인형을 찾지 못했어요. 인형이 화면 가운데에 크게 나오도록 다시 찍어주세요.";
      }
    } catch (e) {
      msg.className = "maze-hint maze-warn";
      msg.textContent = "인형 인식을 사용할 수 없어요. 인형을 들고 나오면 출구에서 스태프가 보너스를 적용해드려요.";
    }
  }

  function flashBonus(m) {
    const el = document.createElement("div");
    el.className = "maze-bonus-flash";
    el.textContent = "+" + (Number(m.bonusMin) || 0) + ":00";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  function tick() {
    const m = mazeOf(state.mazeKey);
    const total = limitMs(m) + bonusMs(m);
    const elapsed = Date.now() - state.startAt;
    const remain = total - elapsed;
    const timer = document.getElementById("maze-timer");
    if (!timer) return clearInterval(tickTimer);
    const card = document.getElementById("maze-timer-card");
    const label = document.getElementById("maze-timer-label");
    if (remain >= 0) {
      label.textContent = "남은 시간";
      timer.textContent = fmt(remain);
    } else {
      label.textContent = "⏰ 시간 초과";
      timer.textContent = "+" + fmt(-remain);
    }
    card.classList.toggle("warn", remain < 5 * 60000 && remain >= 60000);
    card.classList.toggle("danger", remain < 60000);
    document.getElementById("maze-progress-bar").style.width = Math.max(0, Math.min(100, (remain / total) * 100)) + "%";
    document.getElementById("maze-timer-sub").textContent =
      "경과 " + fmt(elapsed) + " · 제한 " + fmt(total) + (state.dollFound ? " (보너스 포함)" : "");
    // 5분 / 1분 / 0분 알림 진동 (한 번씩만)
    [[5, "a5"], [1, "a1"], [0, "a0"]].forEach(([min, k]) => {
      if (remain <= min * 60000 && !state[k]) { state[k] = true; save(); vibrate(min === 0 ? [300, 100, 300] : 200); }
    });
  }

  function openFinishDialog(m) {
    const needsBonus = !state.dollFound && Number(m.bonusMin) > 0;
    const wrap = document.createElement("div");
    wrap.className = "maze-modal";
    wrap.innerHTML =
      '<div class="maze-modal-box">' +
      '<div class="section-title">🏁 탈출 완료 확인</div>' +
      '<p class="maze-hint">출구 스태프에게 이 화면을 보여주세요.</p>' +
      '<label class="maze-check"><input type="checkbox" id="mf-all" /> 팀원 전원이 함께 나왔습니다</label>' +
      (needsBonus ? '<label class="maze-check"><input type="checkbox" id="mf-doll" /> ' + escapeHtml(m.character || "인형") + "을 가지고 나왔습니다 (+" + m.bonusMin + "분)</label>" : "") +
      (cfg.staffCode ? '<input type="password" inputmode="numeric" class="maze-code" id="mf-code" placeholder="스태프 코드" autocomplete="off" />' : "") +
      '<p class="maze-hint maze-warn" id="mf-err"></p>' +
      '<div class="maze-modal-actions"><button type="button" class="btn btn-outline" id="mf-cancel">취소</button>' +
      '<button type="button" class="btn btn-primary" id="mf-ok">확인</button></div>' +
      "</div>";
    document.body.appendChild(wrap);
    // 시간은 버튼을 누른 순간 기준으로 멈춥니다 (스태프 확인하는 동안 흐르지 않도록)
    const pressedAt = Date.now();
    wrap.querySelector("#mf-cancel").addEventListener("click", () => wrap.remove());
    wrap.querySelector("#mf-ok").addEventListener("click", () => {
      const err = wrap.querySelector("#mf-err");
      if (!wrap.querySelector("#mf-all").checked) { err.textContent = "팀원 전원이 함께 나와야 탈출 완료할 수 있어요."; return; }
      const code = wrap.querySelector("#mf-code");
      if (code && code.value.trim() !== String(cfg.staffCode)) { err.textContent = "스태프 코드가 맞지 않아요."; return; }
      const doll = wrap.querySelector("#mf-doll");
      if (doll && doll.checked) { state.dollFound = true; state.dollBy = "staff"; }
      state.finishedAt = pressedAt;
      save();
      wrap.remove();
      releaseWakeLock();
      vibrate(150);
      render();
    });
  }

  function renderResult() {
    const m = mazeOf(state.mazeKey);
    const total = limitMs(m) + bonusMs(m);
    const elapsed = state.finishedAt - state.startAt;
    const ok = elapsed <= total;
    root.innerHTML =
      '<div class="card maze-result ' + (ok ? "ok" : "fail") + '">' +
      '<div class="maze-result-head">' + (ok ? "🎉 탈출 성공!" : "⏰ 시간 초과") + "</div>" +
      '<div class="maze-result-team">' + escapeHtml(state.team) + " · " + escapeHtml(m.name) + "</div>" +
      '<div class="maze-result-time">' + fmt(elapsed) + "</div>" +
      '<div class="maze-result-sub">' + (ok ? fmt(total - elapsed) + " 남기고 탈출" : fmt(elapsed - total) + " 초과") + "</div>" +
      '<ul class="maze-result-list">' +
      "<li>제한시간 " + fmt(total) + (state.dollFound ? " (보너스 +" + m.bonusMin + "분 포함)" : "") + "</li>" +
      "<li>" + (state.dollFound ? "✅" : "❌") + " " + escapeHtml(m.character || "인형") + " " + (state.dollFound ? (state.dollBy === "staff" ? "발견 (스태프 확인)" : "발견 (사진 인증)") : "못 찾음") + "</li>" +
      "<li>" + (state.spotThumb ? "✅" : "❌") + " 사진 스팟 단체사진</li>" +
      "<li>입장 " + new Date(state.startAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) +
      " · 탈출 " + new Date(state.finishedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) + "</li>" +
      "</ul>" +
      ((state.dollThumb || state.spotThumb)
        ? '<div class="maze-result-photos">' + (state.dollThumb ? '<img src="' + state.dollThumb + '" alt="인형 사진" />' : "") + (state.spotThumb ? '<img src="' + state.spotThumb + '" alt="단체사진" />' : "") + "</div>"
        : "") +
      '<p class="maze-hint">이 화면을 집결지 스태프에게 보여주세요.</p>' +
      "</div>" +
      staffResetHtml();
    bindStaffReset();
  }

  // ---------------- 스태프 초기화 ----------------
  function staffResetHtml() {
    return '<button type="button" class="maze-reset" id="maze-reset">스태프: 기록 초기화</button>';
  }
  function bindStaffReset() {
    const b = document.getElementById("maze-reset");
    if (!b) return;
    b.addEventListener("click", () => {
      openModal("🧹 기록 초기화", '<p class="maze-hint">이 휴대폰의 미로 미션 기록을 모두 지웁니다.</p>' + staffCodeInputHtml(), (box) => {
        const err = staffCodeError(box);
        if (err) return err;
        state = {};
        save();
        releaseWakeLock();
        render();
      }, "초기화");
    });
  }

  // ---------------- 화면 꺼짐 방지 ----------------
  async function requestWakeLock() {
    try { if ("wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch (e) {}
  }
  function releaseWakeLock() {
    try { wakeLock && wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state && state.startAt && !state.finishedAt) {
      wakeLock = null;
      requestWakeLock();
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    c = window.CONTENT;
    cfg = c.maze || { mazes: [] };
    root = document.getElementById("maze-content");
    if (cfg.title) {
      const t = document.querySelector(".page-title");
      if (t) t.textContent = "🧭 " + cfg.title;
    }
    storeKey = "maze_state_" + (c.eventName || "") + "_" + (c.date || "");
    state = load();
    if (!(cfg.mazes || []).length) {
      root.innerHTML = '<div class="card"><p class="flight-empty">아직 등록된 미로 미션이 없습니다.</p></div>';
      return;
    }
    if (state.mazeKey && !mazeOf(state.mazeKey)) state = {};
    // 조 목록이 바뀌었는데 아직 타이머를 시작하지 않은 기록이면 처음부터 다시 고르게 합니다.
    if (state.team && !state.startAt && (cfg.teams || []).indexOf(state.team) === -1) state = {};
    render();
  });
})();
