/*
  =====================================================================
   홈 페이지 렌더링 (home.js)
  =====================================================================
  ✅ 이 파일은 코드 구조만 담당합니다. 실제 문구/사진/일정을 바꾸려면
     js/content.js 파일을 수정해주세요.
  =====================================================================
*/

document.addEventListener("DOMContentLoaded", function () {
  const c = window.CONTENT;
  const root = document.getElementById("home-content");

  // 이번 회차에 해당 섹션을 쓰는지 확인 (sectionsEnabled에 값이 없으면 기본적으로 사용함)
  function sectionOn(key) {
    return !(c.sectionsEnabled && c.sectionsEnabled[key] === false);
  }

  // ---------------- 히어로 영역 ----------------
  const heroHtml =
    '<div class="hero">' +
    '<img src="' + escapeHtml(c.heroImage) + '" alt="' + escapeHtml(c.eventName) + '" onerror="this.style.display=\'none\'" />' +
    '<div class="hero-text">' +
    '<span class="badge date">' + escapeHtml(c.dateDisplay || c.date) + "</span>" +
    "<h1>" + escapeHtml(c.eventName) + "</h1>" +
    "<p>" + escapeHtml(c.heroTagline || c.eventSubtitle || "") + "</p>" +
    "</div>" +
    "</div>";

  // ---------------- 빠른 메뉴 ----------------
  const hasUploadItems = !!(c.schedule && c.schedule.some((s) => s.photoUpload && s.photoUpload.enabled));
  const hasVoteItems = !!(c.schedule && c.schedule.some((s) => s.voteUrl));
  const quickMenuItems = [
    '<a href="schedule.html"><span class="icon">🗓️</span>일정</a>',
    sectionOn("flight") ? '<a href="flight.html"><span class="icon">✈️</span>항공권</a>' : "",
    hasUploadItems ? '<a href="upload.html"><span class="icon">📸</span>사진업로드</a>' : "",
    hasVoteItems ? '<a href="vote.html"><span class="icon">🗳️</span>투표</a>' : "",
    '<a href="location.html"><span class="icon">🗺️</span>오시는길</a>',
    sectionOn("faq") ? '<a href="faq.html"><span class="icon">❓</span>FAQ</a>' : "",
    sectionOn("survey") ? '<a href="survey.html"><span class="icon">📝</span>설문조사</a>' : ""
  ].filter(Boolean);
  const quickMenuHtml =
    '<div class="quick-menu" style="grid-template-columns: repeat(' + quickMenuItems.length + ', 1fr);">' +
    quickMenuItems.join("") +
    "</div>";

  // ---------------- 집결 정보 요약 카드 ----------------
  let meetingHtml = "";
  if (c.meetingSummary && sectionOn("meetingSummary")) {
    meetingHtml =
      '<div class="card">' +
      '<div class="section-title">📍 집결 정보</div>' +
      '<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">' +
      '<div>' +
      '<div style="font-weight:800; font-size:16px;">' + escapeHtml(c.meetingSummary.time) + "</div>" +
      '<div style="font-size:13px; color:var(--color-muted);">' + escapeHtml(c.meetingSummary.location) + "</div>" +
      "</div>" +
      mapButtonHtml(c.meetingSummary.mapUrl, "집결지 지도") +
      "</div>" +
      "</div>";
  }

  // ---------------- 오늘의 타임라인 요약 (전체 중 앞 3개만 미리보기) ----------------
  let timelineHtml = "";
  if (c.schedule && c.schedule.length) {
    const preview = c.schedule.slice(0, 3);
    timelineHtml =
      '<div class="card">' +
      '<div class="section-title">🕒 오늘의 타임라인 요약</div>' +
      '<div class="timeline" style="margin-bottom:6px;">' +
      preview
        .map(
          (item) =>
            '<div class="timeline-item">' +
            '<div style="padding:2px 0 10px 4px;">' +
            '<div style="font-weight:800; color:var(--color-primary-dark); font-size:13px;">' +
            (item.date ? escapeHtml(formatDateLabel(item.date)) + " · " : "") + escapeHtml(item.time) + "</div>" +
            '<div style="font-weight:700; font-size:14px;">' + escapeHtml(item.title) + "</div>" +
            '<div style="font-size:12.5px; color:var(--color-muted);">' + escapeHtml(item.location) + "</div>" +
            "</div>" +
            "</div>"
        )
        .join("") +
      "</div>" +
      '<a class="btn btn-primary" href="schedule.html">전체 일정 보기 →</a>' +
      "</div>";
  }

  // ---------------- 우천 시 안내 ----------------
  let rainHtml = "";
  if (c.rainPlan && sectionOn("rainPlan")) {
    rainHtml =
      '<div class="rain-card ' + (c.rainPlan.hasIndoorAlternative ? "" : "inactive") + '">' +
      '<div class="rain-title">☔ 우천 시 안내</div>' +
      '<div class="rain-desc">' + escapeHtml(c.rainPlan.description) + "</div>" +
      (c.rainPlan.decisionTime
        ? '<div class="rain-time">⏰ ' + escapeHtml(c.rainPlan.decisionTime) + "</div>"
        : "") +
      "</div>";
  }

  // ---------------- 준비물 체크리스트 (UI용, 저장되지 않음) ----------------
  let checklistHtml = "";
  if (c.checklist && c.checklist.length && sectionOn("checklist")) {
    checklistHtml =
      '<div class="card">' +
      '<div class="section-title">🎒 준비물 체크리스트</div>' +
      '<ul class="checklist">' +
      c.checklist
        .map(
          (item, idx) =>
            '<li>' +
            '<input type="checkbox" id="chk-' + idx + '" onchange="document.getElementById(\'lbl-' + idx + '\').classList.toggle(\'checked\', this.checked)" />' +
            '<label id="lbl-' + idx + '" for="chk-' + idx + '">' + escapeHtml(item) + "</label>" +
            "</li>"
        )
        .join("") +
      "</ul>" +
      '<p style="font-size:11.5px; color:var(--color-muted); margin-top:8px;">※ 체크 표시는 화면에서만 확인용이며 별도로 저장되지 않습니다.</p>' +
      "</div>";
  }

  // ---------------- 현장 스태프 ----------------
  let staffHtml = "";
  if (c.staff && c.staff.length && sectionOn("staff")) {
    staffHtml =
      '<div class="card">' +
      '<div class="section-title">🙋 현장 스태프</div>' +
      '<div class="staff-grid">' +
      c.staff
        .map(
          (s) =>
            '<div class="staff-card">' +
            '<img class="photo" src="' + escapeHtml(s.photo || "") + '" alt="' + escapeHtml(s.name) + '" onerror="this.style.visibility=\'hidden\'" />' +
            '<div class="name">' + escapeHtml(s.name) + "</div>" +
            '<div class="role">' + escapeHtml(s.role) + "</div>" +
            (s.phone ? '<a class="call" href="' + telHref(s.phone) + '">📞 전화</a>' : "") +
            "</div>"
        )
        .join("") +
      "</div>" +
      "</div>";
  }

  // ---------------- 설문조사 유도 ----------------
  let surveyHtml = "";
  if (c.survey && sectionOn("survey")) {
    surveyHtml =
      '<div class="card" style="text-align:center;">' +
      '<div class="section-title" style="justify-content:center;">📝 설문조사에 참여해주세요</div>' +
      '<p style="font-size:13px; color:var(--color-muted); margin-bottom:12px;">소중한 의견을 남겨주시면 다음 행사 준비에 큰 도움이 됩니다.</p>' +
      '<a class="btn btn-accent" href="survey.html">설문 참여하기 (' + escapeHtml(c.survey.duration) + " 소요)</a>" +
      "</div>";
  }

  root.innerHTML =
    heroHtml + quickMenuHtml + meetingHtml + timelineHtml + rainHtml + checklistHtml + staffHtml + surveyHtml;
});
