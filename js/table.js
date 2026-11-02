/*
  테이블 번호 조회 페이지 (table.js) — content.js 의 tables.groups 에서 이름으로 테이블 번호를 찾아 보여줍니다.
  공통 로직은 group-lookup.js 를 씁니다. 데이터 모양은 rooms 와 같습니다: { notice, emptyText, groups: [{ label, date, members[] }] }
*/
document.addEventListener("DOMContentLoaded", function () {
  renderGroupLookup({
    rootId: "table-content",
    data: window.CONTENT.tables,
    searchTitle: "🔍 내 테이블 조회",
    emptyText: (window.CONTENT.tables && window.CONTENT.tables.emptyText) || "아직 등록된 테이블 배정 명단이 없습니다. 준비되는 대로 이 페이지에서 조회하실 수 있어요."
  });
});
