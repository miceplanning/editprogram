/*
  테이블 배치도 페이지 (seating.js) — content.js 의 seating 데이터로 행사장 테이블 배치를 그려줍니다.
  ✅ content.js 의 데이터 모양:
       seating = {
         title, notice,
         image: "",            // 완성된 배치도 이미지가 있으면 경로를 넣으면 그림 대신 이미지를 보여줍니다
         front: "무대 · 스크린", // 배치도 맨 위(앞쪽) 표시
         back: "다과 테이블",    // 배치도 맨 아래(뒤쪽) 표시
         rows: [               // 무대에서 가까운 줄부터, 각 줄은 왼쪽 → 오른쪽 순서
           { tables: [{ seats: [{ org: "북부", count: 9 }] }, ...], right: "입구" }
         ]
       }
     right / left 에 글자를 넣으면 그 줄 옆 벽에 표시됩니다(예: 입구).
  ✅ 소속을 검색하면 해당 테이블이 강조됩니다.
*/
document.addEventListener("DOMContentLoaded", function () {
  const root = document.getElementById("seating-content");
  const data = window.CONTENT.seating || {};
  const rows = data.rows || [];

  function tableLabel(t) {
    return (t.seats || []).map((s) => s.org).join(" ");
  }

  function tableHtml(t) {
    return (
      '<div class="seat-table" data-label="' + escapeHtml(tableLabel(t)) + '">' +
      (t.seats || [])
        .map(
          (s) =>
            '<div class="seat-org">' + escapeHtml(s.org) +
            (s.count ? ' <span class="seat-count">' + escapeHtml(String(s.count)) + "</span>" : "") +
            "</div>"
        )
        .join("") +
      "</div>"
    );
  }

  function sideHtml(text) {
    return '<div class="seat-side">' + (text ? '<span class="seat-door">' + escapeHtml(text) + "</span>" : "") + "</div>";
  }

  let html = "";
  if (data.notice) {
    html += '<div class="card"><div class="flight-notice">' + escapeHtml(data.notice) + "</div></div>";
  }

  if (data.image) {
    html += '<div class="card"><img class="seat-image" src="' + escapeHtml(data.image) + '" alt="테이블 배치도" /></div>';
    root.innerHTML = html;
    return;
  }

  if (!rows.length) {
    html += '<div class="card"><p class="flight-empty">테이블 배치도가 준비되는 대로 이 페이지에서 확인하실 수 있어요.</p></div>';
    root.innerHTML = html;
    return;
  }

  html +=
    '<div class="card">' +
    '<div class="section-title">🔍 내 테이블 찾기</div>' +
    '<div class="flight-search">' +
    '<input type="text" class="seat-input" placeholder="소속 (예: 경북, 본청)" />' +
    '<button type="button" class="btn btn-accent seat-btn">찾기</button>' +
    "</div>" +
    '<div class="seat-result flight-empty"></div>' +
    "</div>";

  html +=
    '<div class="card seat-card">' +
    (data.title ? '<div class="section-title">' + escapeHtml(data.title) + "</div>" : "") +
    (data.front ? '<div class="seat-front">' + escapeHtml(data.front) + "</div>" : "") +
    '<div class="seat-room">' +
    rows
      .map(
        (r) =>
          '<div class="seat-row">' +
          sideHtml(r.left) +
          '<div class="seat-row-tables" style="grid-template-columns: repeat(' + (r.tables || []).length + ', 1fr);">' +
          (r.tables || []).map(tableHtml).join("") +
          "</div>" +
          sideHtml(r.right) +
          "</div>"
      )
      .join("") +
    "</div>" +
    (data.back ? '<div class="seat-back">' + escapeHtml(data.back) + "</div>" : "") +
    "</div>";

  root.innerHTML = html;

  const input = root.querySelector(".seat-input");
  const result = root.querySelector(".seat-result");
  const tables = Array.from(root.querySelectorAll(".seat-table"));

  function search() {
    const q = input.value.replace(/\s+/g, "");
    tables.forEach((el) => el.classList.remove("hit", "dim"));
    if (!q) {
      result.textContent = "";
      return;
    }
    const hits = tables.filter((el) => el.dataset.label.replace(/\s+/g, "").indexOf(q) !== -1);
    if (!hits.length) {
      result.textContent = "'" + input.value.trim() + "' 소속 테이블을 찾지 못했어요. 소속명을 다시 확인해주세요.";
      return;
    }
    tables.forEach((el) => el.classList.add(hits.indexOf(el) !== -1 ? "hit" : "dim"));
    result.textContent = "노란색으로 표시된 테이블 " + hits.length + "곳이 배정된 자리입니다.";
    hits[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }

  root.querySelector(".seat-btn").addEventListener("click", search);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") search();
  });
});
