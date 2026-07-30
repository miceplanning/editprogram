/*
  =====================================================================
   공통 스크립트 (main.js)
  =====================================================================
  ✅ 이 파일은 "모든 페이지에서 공통으로 쓰는 부분"을 만듭니다.
     - 상단 공지사항 배너
     - 상단 헤더 (행사명 + 연락처)
     - 화면 우측 하단 플로팅 전화 버튼
     - 하단 탭 메뉴
  ✅ 콘텐츠 내용을 바꾸고 싶다면 이 파일이 아니라 js/content.js 를 수정하세요.
  =====================================================================
*/

// HTML 특수문자를 안전하게 처리하기 위한 간단한 함수 (XSS 방지용)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 전화번호를 tel: 링크에 쓸 수 있도록 하이픈/공백 제거
function telHref(phone) {
  return "tel:" + String(phone).replace(/[^0-9+]/g, "");
}

// "2026-07-02" 같은 날짜 값을 "7/2(목)" 형태의 표시용 문구로 바꿔줍니다.
function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + days[d.getDay()] + ")";
}

// 구글맵 버튼 HTML 조각 생성
function mapButtonHtml(mapUrl, label) {
  if (!mapUrl) return "";
  const text = label || "지도에서 보기";
  return (
    '<a class="btn btn-map" href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noopener noreferrer">' +
    "📍 " + escapeHtml(text) +
    "</a>"
  );
}

/**
 * 공통 레이아웃(공지 배너, 헤더, 플로팅 연락처, 하단 네비게이션)을 렌더링합니다.
 * @param {string} activePage - "home" | "schedule" | "location" | "faq" | "survey"
 */
function renderLayout(activePage) {
  const c = window.CONTENT;
  const body = document.body;

  // --- 1) 공지사항 배너 ---
  const noticeEl = document.createElement("div");
  noticeEl.id = "notice-banner";
  if (c.notice && c.notice.active && c.notice.text) {
    noticeEl.innerHTML =
      '<div class="notice-inner">' +
      '<span class="notice-icon">📢</span>' +
      "<span>" + escapeHtml(c.notice.text) + "</span>" +
      '<button class="notice-close" aria-label="공지 닫기" onclick="this.closest(\'#notice-banner\').style.display=\'none\'; document.documentElement.style.setProperty(\'--notice-h\',\'0px\');">✕</button>' +
      "</div>";
    body.prepend(noticeEl);
    // 배너 실제 높이를 측정해서 헤더/본문이 겹치지 않도록 CSS 변수에 반영
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--notice-h", noticeEl.offsetHeight + "px");
    });
  }

  // --- 2) 상단 헤더 ---
  const header = document.createElement("header");
  header.id = "site-header";
  header.innerHTML =
    '<div class="header-inner">' +
    '<div class="brand">' + escapeHtml(c.eventName) +
    "<small>" + escapeHtml(c.dateDisplay || c.date || "") + "</small>" +
    "</div>" +
    (c.contact
      ? '<a class="header-contact" href="' + telHref(c.contact.phone) + '">📞 ' + escapeHtml(c.contact.name) + "</a>"
      : "") +
    "</div>";
  body.prepend(header);
  // 공지 배너보다 위에 오면 순서가 꼬이므로, 배너 뒤에 헤더가 오도록 재정렬
  if (noticeEl.parentElement) body.insertBefore(noticeEl, header);

  // --- 3) 플로팅 연락처 버튼 (항상 화면에 노출) ---
  if (c.contact) {
    const floating = document.createElement("a");
    floating.id = "floating-contact";
    floating.href = telHref(c.contact.phone);
    floating.setAttribute("aria-label", "긴급연락처 " + c.contact.name + "에게 전화하기");
    floating.title = "긴급연락처 · " + c.contact.name;
    floating.innerHTML = '<span class="dot"></span><span>📞</span>';
    body.appendChild(floating);
  }

  // --- 4) 하단 탭 네비게이션 ---
  const nav = document.createElement("nav");
  nav.id = "bottom-nav";
  // "사진업로드"/"투표" 탭은 각각 해당하는 활동이 하나라도 있을 때만 보여줍니다.
  const hasUploadItems = !!(c.schedule && c.schedule.some((s) => s.photoUpload && s.photoUpload.enabled));
  const hasVoteItems = !!(c.schedule && c.schedule.some((s) => s.voteUrl));

  const tabs = [
    { key: "home", href: "index.html", icon: "🏠", label: "홈" },
    { key: "schedule", href: "schedule.html", icon: "🗓️", label: "일정" },
    { key: "flight", href: "flight.html", icon: "✈️", label: "항공권", sectionKey: "flight" },
    { key: "upload", href: "upload.html", icon: "📸", label: "사진업로드", show: hasUploadItems },
    { key: "vote", href: "vote.html", icon: "🗳️", label: "투표", show: hasVoteItems },
    { key: "location", href: "location.html", icon: "🗺️", label: "오시는길" },
    { key: "faq", href: "faq.html", icon: "❓", label: "FAQ", sectionKey: "faq" },
    { key: "survey", href: "survey.html", icon: "📝", label: "설문", sectionKey: "survey" }
  ].filter((t) => t.show !== false && (!t.sectionKey || (c.sectionsEnabled && c.sectionsEnabled[t.sectionKey]) !== false));
  nav.innerHTML = tabs
    .map(
      (t) =>
        '<a href="' + t.href + '" class="' + (t.key === activePage ? "active" : "") + '">' +
        '<span class="icon">' + t.icon + "</span><span>" + t.label + "</span>" +
        "</a>"
    )
    .join("");
  body.appendChild(nav);
}

document.addEventListener("DOMContentLoaded", function () {
  const page = document.body.getAttribute("data-page") || "home";
  renderLayout(page);
});
