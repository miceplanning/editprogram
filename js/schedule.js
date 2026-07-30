/*
  =====================================================================
   일정(타임테이블) 페이지 렌더링 (schedule.js)
  =====================================================================
  ✅ 세로 타임라인 + 클릭하면 펼쳐지는 아코디언 형태로 렌더링합니다.
  ✅ 일정 내용 자체를 바꾸려면 js/content.js 의 schedule 배열을 수정하세요.
  =====================================================================
*/

function scheduleItemHtml(item, index) {
  const chips = [];
  if (item.difficulty) chips.push('<span class="info-chip chip-difficulty">난이도 ' + escapeHtml(item.difficulty) + "</span>");
  if (item.distance) chips.push('<span class="info-chip chip-distance">🚶 ' + escapeHtml(item.distance) + "</span>");
  if (item.meal && item.meal.hasAllergyInfo) chips.push('<span class="info-chip chip-allergy">⚠️ 알레르기 주의</span>');
  if (item.meal && item.meal.vegetarianOption) chips.push('<span class="info-chip chip-veg">🥗 채식 옵션</span>');

  let mealHtml = "";
  if (item.meal) {
    mealHtml =
      '<div class="recommend-box" style="background:var(--color-danger-bg);">' +
      '<div class="rec-title" style="color:#991b1b;">🍽️ 식사 안내</div>' +
      (item.meal.allergyNote ? "<div>" + escapeHtml(item.meal.allergyNote) + "</div>" : "") +
      (item.meal.vegetarianOption
        ? '<div style="margin-top:4px; color:#166534; font-weight:700;">' + escapeHtml(item.meal.vegetarianOption) + "</div>"
        : "") +
      "</div>";
  }

  let recommendHtml = "";
  if (item.freeTimeRecommendation && item.freeTimeRecommendation.length) {
    recommendHtml =
      '<div class="recommend-box">' +
      '<div class="rec-title">✨ 추천 동선 (우선순위 순)</div>' +
      "<ol>" +
      item.freeTimeRecommendation.map((r) => "<li>" + escapeHtml(r) + "</li>").join("") +
      "</ol>" +
      "</div>";
  }

  const travelHtml = item.travelTimeToNext
    ? '<div class="travel-next">🚌 다음 장소까지: ' + escapeHtml(item.travelTimeToNext) + "</div>"
    : "";

  const photoHtml = item.photo
    ? '<img class="schedule-photo" src="' + escapeHtml(item.photo) + '" alt="' + escapeHtml(item.title) + '" onerror="this.remove()" />'
    : "";

  // 사진 업로드 자체는 하단 메뉴의 "사진업로드" 페이지에서 하고, 여기서는
  // 그 페이지로 안내하는 짧은 버튼만 보여줍니다 (같은 위젯을 두 곳에 중복해서
  // 두지 않기 위함입니다).
  const uploadPromptHtml =
    item.photoUpload && item.photoUpload.enabled
      ? '<a class="upload-prompt" href="upload.html">📸 이 활동 사진은 <b>사진업로드</b> 메뉴에서 올릴 수 있어요 →</a>'
      : "";

  // 투표 자체는 하단 메뉴의 "투표" 페이지에서 하고, 여기서는 그 페이지로
  // 안내하는 짧은 버튼만 보여줍니다 (사진 업로드 안내 버튼과 같은 패턴).
  const votePromptHtml = item.voteUrl
    ? '<a class="upload-prompt" href="vote.html">🗳️ 이 활동은 <b>투표</b> 메뉴에서 참여할 수 있어요 →</a>'
    : "";

  return (
    '<div class="timeline-item" id="schedule-item-' + item.id + '">' +
    '<div class="timeline-card">' +
    '<button class="timeline-head" onclick="this.closest(\'.timeline-item\').classList.toggle(\'open\')">' +
    '<div class="time-box"><div class="time">' + escapeHtml(item.time) + "</div>" +
    (item.endTime ? '<div class="time-end">~' + escapeHtml(item.endTime) + "</div>" : "") +
    "</div>" +
    '<div class="head-main">' +
    '<div class="title">' + escapeHtml(item.title) + "</div>" +
    '<div class="loc">' + escapeHtml(item.location) + "</div>" +
    "</div>" +
    '<span class="chevron">▾</span>' +
    "</button>" +
    '<div class="timeline-body"><div class="timeline-body-inner">' +
    photoHtml +
    (item.description ? '<div class="desc">' + escapeHtml(item.description) + "</div>" : "") +
    (chips.length ? '<div class="info-row">' + chips.join("") + "</div>" : "") +
    mapButtonHtml(item.mapUrl, "이 장소 지도 보기") +
    mealHtml +
    recommendHtml +
    travelHtml +
    uploadPromptHtml +
    votePromptHtml +
    "</div></div>" +
    "</div>" +
    "</div>"
  );
}

// 여러 날에 걸친 행사라면(일정 항목에 date가 하나라도 있으면) 날짜별로 묶어서
// 그룹 제목을 보여주고, 하루짜리 행사라면 지금까지처럼 하나의 타임라인으로 보여줍니다.
function scheduleContentHtml(schedule) {
  const hasDates = schedule.some((item) => item.date);
  if (!hasDates) {
    return '<div class="timeline">' + schedule.map(scheduleItemHtml).join("") + "</div>";
  }

  const groups = [];
  schedule.forEach((item) => {
    const date = item.date || "";
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup.date !== date) {
      groups.push({ date: date, items: [item] });
    } else {
      lastGroup.items.push(item);
    }
  });

  return groups
    .map(
      (g) =>
        (g.date ? '<div class="day-header">📅 ' + escapeHtml(formatDateLabel(g.date)) + "</div>" : "") +
        '<div class="timeline">' + g.items.map(scheduleItemHtml).join("") + "</div>"
    )
    .join("");
}

// 오늘 날짜를 "2026-07-02" 형태(로컬 기준)로 돌려줍니다.
function todayIso() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + mm + "-" + dd;
}

// 현재 시각(그리고 여러 날 행사라면 오늘 날짜까지) 기준으로 "다음 일정" 을 계산합니다.
// (당일 참가자가 스크롤하면서 확인하기 쉽도록)
function findNextScheduleItem(schedule) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const hasDates = schedule.some((item) => item.date);

  if (!hasDates) {
    for (const item of schedule) {
      const [h, m] = item.time.split(":").map(Number);
      if (h * 60 + m >= nowMinutes) return item;
    }
    return null; // 오늘 일정이 모두 지난 경우
  }

  const today = todayIso();
  // 오늘 날짜의 일정 중 아직 지나지 않은 다음 일정을 먼저 찾습니다.
  for (const item of schedule) {
    if (item.date !== today) continue;
    const [h, m] = item.time.split(":").map(Number);
    if (h * 60 + m >= nowMinutes) return item;
  }
  // 오늘 일정이 없거나(아직 행사 전, 또는 이미 다 지남) 모두 지났다면,
  // 앞으로 다가올 날짜의 첫 일정을 보여줍니다.
  return schedule.find((item) => item.date && item.date > today) || null;
}

document.addEventListener("DOMContentLoaded", function () {
  const c = window.CONTENT;
  const root = document.getElementById("schedule-content");

  if (!c.schedule || !c.schedule.length) {
    root.innerHTML = '<p style="color:var(--color-muted);">등록된 일정이 없습니다.</p>';
    return;
  }

  root.innerHTML = scheduleContentHtml(c.schedule);

  // --- "다음 일정" 스티키 바 세팅 ---
  const bar = document.getElementById("next-schedule-bar");
  const nextItem = findNextScheduleItem(c.schedule);
  if (nextItem) {
    bar.innerHTML =
      '<span class="tag">다음 일정</span>' +
      "<span>" +
      (nextItem.date ? escapeHtml(formatDateLabel(nextItem.date)) + " " : "") +
      escapeHtml(nextItem.time) + " · " + escapeHtml(nextItem.title) +
      "</span>";
  } else {
    bar.innerHTML = '<span class="tag">일정 종료</span><span>모든 일정이 종료되었습니다. 수고하셨습니다!</span>';
  }
  window.addEventListener("scroll", function () {
    if (window.scrollY > 120) bar.classList.add("show");
    else bar.classList.remove("show");
  });
});
