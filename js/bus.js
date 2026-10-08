/*
  버스 호차 조회 페이지 (bus.js) — content.js 의 bus.groups 에서 이름으로 호차를 찾아 보여줍니다.
  공통 로직은 group-lookup.js, 명단은 편집기(editor.html)의 "버스 호차" 패널에서 관리합니다.
*/
document.addEventListener("DOMContentLoaded", function () {
  renderGroupLookup({
    rootId: "bus-content",
    data: window.CONTENT.bus,
    searchTitle: "🔍 내 버스 호차 조회",
    emptyText: "아직 등록된 버스 탑승 명단이 없습니다. 준비되는 대로 이 페이지에서 조회하실 수 있어요."
  });
});
