/*
  =====================================================================
   FAQ 페이지 렌더링 (faq.js)
  =====================================================================
  ✅ 질문/답변을 추가하거나 수정하려면 js/content.js 의 faq 배열을 수정하세요.
  =====================================================================
*/

document.addEventListener("DOMContentLoaded", function () {
  const c = window.CONTENT;
  const root = document.getElementById("faq-content");

  if (c.sectionsEnabled && c.sectionsEnabled.faq === false) {
    root.innerHTML = '<p style="color:var(--color-muted);">이번 회차는 FAQ가 준비되어 있지 않습니다.</p>';
    return;
  }

  if (!c.faq || !c.faq.length) {
    root.innerHTML = '<p style="color:var(--color-muted);">등록된 FAQ가 없습니다.</p>';
    return;
  }

  root.innerHTML = c.faq
    .map(
      (item, idx) =>
        '<div class="faq-item" id="faq-' + idx + '">' +
        '<button class="faq-q" onclick="this.closest(\'.faq-item\').classList.toggle(\'open\')">' +
        "<span>Q. " + escapeHtml(item.q) + "</span>" +
        '<span class="chevron">▾</span>' +
        "</button>" +
        '<div class="faq-a"><div class="faq-a-inner">A. ' + escapeHtml(item.a) + "</div></div>" +
        "</div>"
    )
    .join("");

  // 담당자 연락 카드
  if (c.contact && c.contact.phone) {
    const contactCard = document.createElement("div");
    contactCard.className = "card";
    contactCard.style.textAlign = "center";
    contactCard.innerHTML =
      '<div class="section-title" style="justify-content:center;">더 궁금한 점이 있으신가요?</div>' +
      '<a class="btn btn-primary" href="' + telHref(c.contact.phone) + '">📞 ' + escapeHtml(c.contact.name) + " (" + escapeHtml(c.contact.role || "담당자") + ") 에게 전화하기</a>";
    root.appendChild(contactCard);
  }
});
