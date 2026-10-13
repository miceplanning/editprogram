/*
  =====================================================================
   팀미션 페이지 렌더링 (mission.js)
  =====================================================================
  ✅ content.js 의 mission = { notice, items: [{ title, description, videoUrl, formUrl }] }
     를 읽어 미션마다 카드 하나씩 보여줍니다.
  ✅ videoUrl 에 유튜브 링크(youtu.be/..., youtube.com/watch?v=..., /shorts/...)를
     넣으면 참고 영상을 페이지 안에 바로 재생할 수 있게 넣어줍니다.
  ✅ formUrl(구글폼)이 비어 있으면 "제출 링크 준비 중" 으로 표시됩니다.
  ✅ 미션 내용은 편집기(editor.html)의 "팀미션" 패널에서 관리합니다.
  =====================================================================
*/

function youtubeEmbedUrl(url) {
  if (!url) return "";
  const m =
    url.match(/youtu\.be\/([\w-]{6,})/) ||
    url.match(/[?&]v=([\w-]{6,})/) ||
    url.match(/youtube\.com\/(?:shorts|embed|live)\/([\w-]{6,})/);
  return m ? "https://www.youtube.com/embed/" + m[1] : "";
}

document.addEventListener("DOMContentLoaded", function () {
  const c = window.CONTENT;
  const root = document.getElementById("mission-content");
  const mission = c.mission || { notice: "", items: [] };
  const items = (mission.items || []).filter((m) => m && (m.title || m.description));

  let html = "";
  if (mission.notice) {
    html += '<div class="card"><div class="flight-notice">' + escapeHtml(mission.notice) + "</div></div>";
  }
  if (!items.length) {
    html += '<div class="card"><p class="flight-empty">아직 등록된 팀미션이 없습니다.</p></div>';
    root.innerHTML = html;
    return;
  }

  items.forEach((m) => {
    const embed = youtubeEmbedUrl(m.videoUrl);
    html +=
      '<div class="card">' +
      '<div class="section-title">🎯 ' + escapeHtml(m.title || "팀미션") + "</div>" +
      (m.description ? '<p class="mission-desc">' + escapeHtml(m.description) + "</p>" : "") +
      (embed
        ? '<div class="upload-gallery-embed-label">🎬 참고 영상</div>' +
          '<div class="mission-video"><iframe src="' + embed + '" title="참고 영상" loading="lazy" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
        : m.videoUrl
          ? '<a class="btn btn-accent mission-video-link" href="' + escapeHtml(m.videoUrl) + '" target="_blank" rel="noopener noreferrer">🎬 참고 영상 보기</a>'
          : "") +
      (m.formUrl
        ? '<a class="upload-pick-btn upload-form-link" href="' + escapeHtml(m.formUrl) + '" target="_blank" rel="noopener noreferrer">📤 미션 제출하러 가기 (구글폼)</a>'
        : '<p class="flight-empty">제출 링크는 준비되는 대로 이곳에 열립니다.</p>') +
      "</div>";
  });
  root.innerHTML = html;
});
