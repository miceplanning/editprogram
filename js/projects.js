/*
  =====================================================================
   프로젝트 목록 페이지 로직 (projects.js)
  =====================================================================
  ✅ js/project-store.js 의 localStorage 헬퍼로 저장된 프로젝트를 나열하고,
     "+ 새 프로젝트" / "열기" / "삭제" / "현재 content.js 불러오기"를 처리합니다.
  =====================================================================
*/

// main.js에 있는 것과 같은 간단한 이스케이프 함수 (이 페이지는 main.js를 불러오지 않아 따로 둡니다)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderProjectList() {
  const root = document.getElementById("projects-list");
  const projects = listProjects();

  if (!projects.length) {
    root.innerHTML =
      '<div class="projects-empty">아직 저장된 프로젝트가 없습니다.<br />' +
      "위의 \"+ 새 프로젝트\"를 눌러 시작하거나, 이미 만든 사이트가 있다면 " +
      '"현재 content.js 불러오기"로 가져와보세요.</div>';
    return;
  }

  root.innerHTML = "";
  projects.forEach((p) => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.innerHTML =
      '<div class="project-label">' + escapeHtml(p.label) + "</div>" +
      '<div class="project-meta">' +
      (p.dateDisplay ? escapeHtml(p.dateDisplay) + " · " : "") +
      "마지막 수정: " + formatRelativeTime(p.updatedAt) +
      "</div>" +
      '<div class="project-actions">' +
      '<a class="project-open" href="editor.html?project=' + encodeURIComponent(p.id) + '">열기</a>' +
      '<button type="button" class="project-rename" data-id="' + p.id + '">이름변경</button>' +
      '<button type="button" class="project-delete" data-id="' + p.id + '">삭제</button>' +
      "</div>";
    root.appendChild(card);
  });

  root.querySelectorAll(".project-rename").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const meta = projects.find((p) => p.id === id);
      const current = meta && meta.label !== "(제목 없음)" ? meta.label : "";
      const input = prompt("프로젝트 이름을 입력하세요 (실제 사이트의 행사명으로 저장됩니다):", current);
      if (input === null) return;
      const name = input.trim();
      if (!name) return;
      const content = getProjectContent(id) || {};
      content.eventName = name;
      saveProjectContent(id, content);
      renderProjectList();
    });
  });

  root.querySelectorAll(".project-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const meta = projects.find((p) => p.id === id);
      const ok = confirm('"' + (meta ? meta.label : "이 프로젝트") + '"를 삭제할까요? 되돌릴 수 없습니다.');
      if (!ok) return;
      deleteProject(id);
      renderProjectList();
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  renderProjectList();

  document.getElementById("btn-new-project").addEventListener("click", () => {
    const id = generateProjectId();
    saveProjectContent(id, { eventName: "", date: "", dateDisplay: "" });
    location.href = "editor.html?project=" + encodeURIComponent(id);
  });

  document.getElementById("btn-import-current").addEventListener("click", () => {
    const id = generateProjectId();
    saveProjectContent(id, window.CONTENT || {});
    location.href = "editor.html?project=" + encodeURIComponent(id);
  });
});
