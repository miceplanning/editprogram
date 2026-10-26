/*
  =====================================================================
   참석 조사 안내 페이지 렌더링 (rsvp.js)
  =====================================================================
  ✅ content.js 의 rsvp = { title, description, url, deadline, duration } 를 읽어
     구글폼 등 참석 조사 링크로 안내합니다. (만족도 설문은 survey 섹션을 쓰세요)
  ✅ sectionsEnabled.rsvp === true 인 행사에서만 탭/홈 카드가 보입니다.
  =====================================================================
*/

document.addEventListener("DOMContentLoaded", function () {
  const c = window.CONTENT;
  const root = document.getElementById("rsvp-content");
  const r = c.rsvp;

  if (!r || !r.url) {
    root.innerHTML = '<p style="color:var(--color-muted); padding:20px;">등록된 참석 조사가 없습니다.</p>';
    return;
  }

  root.innerHTML =
    '<div class="card survey-box">' +
    '<div class="emoji">📋</div>' +
    "<h2>" + escapeHtml(r.title || "참석 조사") + "</h2>" +
    (r.description ? "<p>" + escapeHtml(r.description) + "</p>" : "") +
    '<a class="btn btn-accent" href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener noreferrer">참석 조사 응답하기</a>' +
    (r.deadline ? '<div class="survey-duration">📅 응답 마감: ' + escapeHtml(r.deadline) + "</div>" : "") +
    (r.duration ? '<div class="survey-duration">⏱️ 예상 소요시간: ' + escapeHtml(r.duration) + "</div>" : "") +
    "</div>";
});
