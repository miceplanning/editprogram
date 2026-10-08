/*
  방 배정 조회 페이지 (room.js) — content.js 의 rooms.groups 에서 이름으로 방 번호를 찾아 보여줍니다.
  공통 로직은 group-lookup.js, 명단은 편집기(editor.html)의 "방 배정" 패널에서 관리합니다.
*/
document.addEventListener("DOMContentLoaded", function () {
  renderGroupLookup({
    rootId: "room-content",
    data: window.CONTENT.rooms,
    searchTitle: "🔍 내 객실 조회",
    emptyText: "아직 등록된 객실 배정 명단이 없습니다. 준비되는 대로 이 페이지에서 조회하실 수 있어요."
  });
});
