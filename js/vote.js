/*
  =====================================================================
   투표 페이지 렌더링 (vote.js)
  =====================================================================
  ✅ js/content.js 의 schedule 배열에서 voteUrl 이 채워진 활동만 모아서,
     각각 투표 링크 카드를 보여줍니다.
  ✅ 어떤 활동에 투표 버튼을 달지는 편집기(editor.html)의 "시간별 일정"
     패널에서 "투표 링크" 칸에 링크를 넣으면 자동으로 켜집니다.
  =====================================================================
*/

document.addEventListener("DOMContentLoaded", function () {
  const c = window.CONTENT;
  const root = document.getElementById("vote-content");

  const voteItems = (c.schedule || []).filter((item) => item.voteUrl);

  if (!voteItems.length) {
    root.innerHTML = '<p style="color:var(--color-muted);">이번 회차는 진행 중인 투표가 없습니다.</p>';
    return;
  }

  voteItems.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    let html =
      '<div class="section-title">🕒 ' + escapeHtml(item.time) + " · " + escapeHtml(item.title) + "</div>" +
      (item.location ? '<p style="font-size:12.5px; color:var(--color-muted); margin-bottom:10px;">' + escapeHtml(item.location) + "</p>" : "");

    const pu = item.photoUpload;
    if (pu && pu.showGallery && pu.driveFolderUrl) {
      const embedUrl = driveFolderEmbedUrl(pu.driveFolderUrl);
      if (embedUrl) {
        html +=
          '<div class="upload-gallery-embed-label">🎬 모아보기</div>' +
          '<div class="upload-gallery-embed"><iframe src="' + embedUrl + '" loading="lazy" title="업로드된 파일 모아보기"></iframe></div>';
      }
    }

    html += '<a class="upload-pick-btn upload-form-link" href="' + escapeHtml(item.voteUrl) + '" target="_blank" rel="noopener noreferrer">🗳️ 투표하러 가기</a>';

    card.innerHTML = html;
    root.appendChild(card);
  });
});
