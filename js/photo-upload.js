/*
  =====================================================================
   참가자 사진 업로드 공용 모듈 (photo-upload.js)
  =====================================================================
  ✅ 일정 항목별로 참가자가 활동 사진을 올리고, 운영팀이 모아볼 수 있게
     해주는 기능입니다. 별도 서버 없이 "구글폼 + 구글 드라이브"를 이용합니다.
     (참가자 → 구글폼의 파일 업로드 질문으로 사진 제출 → 자동으로 구글
     드라이브 폴더에 쌓임 → 그 폴더를 사이트에 지도처럼 임베드해서 보여줍니다)
  ✅ 설정 방법은 README.md의 "📸 참가자 사진 업로드 기능 설정하기" 섹션을
     참고하세요. 이 파일 자체는 손댈 필요가 없습니다.
  ✅ editor.html(운영팀 - 미리보기용)과 upload.html(참가자 - 업로드용)
     양쪽에서 공통으로 불러 씁니다.
  =====================================================================
*/

// 구글 드라이브 폴더 링크(또는 폴더 ID)에서 폴더 ID만 뽑아냅니다.
// 예: https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing → 1AbCdEfGhIjKlMnOp
function extractDriveFolderId(urlOrId) {
  if (!urlOrId) return "";
  const match = String(urlOrId).match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : String(urlOrId).trim();
}

// API 키 없이 쓸 수 있는 구글 드라이브 폴더 "그리드 보기" 임베드 주소를 만듭니다.
// (지도 페이지의 구글맵 embed와 같은 방식 - 폴더가 "링크가 있는 모든 사용자에게 공개"로
// 설정되어 있어야 보입니다)
function driveFolderEmbedUrl(urlOrId) {
  const id = extractDriveFolderId(urlOrId);
  return id ? "https://drive.google.com/embeddedfolderview?id=" + encodeURIComponent(id) + "#grid" : "";
}

// 사진 업로드가 켜진 일정이 하나라도 있는지 확인 (하단 메뉴에 "사진업로드" 탭을 보여줄지 결정할 때 씁니다)
function hasAnyUploadSection(schedule) {
  return !!(schedule && schedule.some((item) => item.photoUpload && item.photoUpload.enabled));
}

// ---------------------------------------------------------------
// 참가자용 업로드 카드 UI (폼 열기 버튼 + 업로드된 사진 미리보기)
// upload.html(참가자용 사진업로드 페이지)에서 사용합니다.
// ---------------------------------------------------------------
function buildUploadCard(item) {
  const wrap = document.createElement("div");
  wrap.className = "upload-widget";

  const pu = item.photoUpload || {};

  if (!pu.formUrl) {
    wrap.innerHTML = '<div class="upload-disabled-note">📸 이 활동의 사진 업로드 링크가 아직 준비되지 않았습니다.</div>';
    return wrap;
  }

  // 참가자 화면에는 기본적으로 업로드 폴더 미리보기를 보여주지 않습니다 (드라이브
  // 폴더가 "링크가 있는 모든 사용자"로 공유되어 있지 않으면 "액세스 권한 필요"
  // 에러가 보이는 문제도 있고, 다른 참가자의 사진을 공개로 노출하고 싶지 않은
  // 경우가 많기 때문입니다). 투표 등 모두가 결과물을 봐야 하는 활동에 한해서만
  // photoUpload.showGallery 를 true로 켜서 갤러리를 보여줍니다.
  let html = pu.description
    ? '<div class="upload-description">' + escapeHtml(pu.description) + "</div>"
    : "";
  html += '<a class="upload-pick-btn upload-form-link" href="' + pu.formUrl + '" target="_blank" rel="noopener noreferrer">📸 사진 올리러 가기 (구글폼 열기)</a>';

  if (pu.showGallery) {
    const embedUrl = driveFolderEmbedUrl(pu.driveFolderUrl);
    html += embedUrl
      ? '<div class="upload-gallery-embed-label">🎬 모아보기</div><div class="upload-gallery-embed"><iframe src="' + embedUrl + '" loading="lazy" title="업로드된 파일 모아보기"></iframe></div>'
      : '<div class="upload-viewer-note">업로드된 파일이 여기에 모여서 보일 예정입니다.</div>';
  }

  wrap.innerHTML = html;
  return wrap;
}
