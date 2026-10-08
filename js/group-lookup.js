/*
  =====================================================================
   이름으로 조 편성 조회 공통 도우미 (group-lookup.js)
  =====================================================================
  ✅ 버스 호차 조회(bus.html)와 방 배정 조회(room.html)가 함께 씁니다.
  ✅ content.js 의 데이터 모양:
       bus   = { notice, groups: [{ label: "1호차", date: "", members: ["김OO", ...] }] }
       rooms = { notice, groups: [{ label: "1호",   date: "10/15(목)", members: [...] }] }
     members 의 각 항목은 "이름" 또는 "이름 (메모)" 형태로 적으면 됩니다.
     예: "한영숙 (2일차 제외)" — 조회 결과에 메모까지 그대로 보여줍니다.
  ✅ 한 사람이 여러 그룹에 들어 있으면(예: 1박째·2박째 방이 다름) 전부 보여줍니다.
  =====================================================================
*/

function renderGroupLookup(opts) {
  const root = document.getElementById(opts.rootId);
  const data = opts.data || { notice: "", groups: [] };
  const groups = (data.groups || []).filter((g) => g && (g.members || []).length);

  let html = "";
  if (data.notice) {
    html += '<div class="card"><div class="flight-notice">' + escapeHtml(data.notice) + "</div></div>";
  }
  if (!groups.length) {
    html += '<div class="card"><p class="flight-empty">' + escapeHtml(opts.emptyText) + "</p></div>";
    root.innerHTML = html;
    return;
  }

  html +=
    '<div class="card">' +
    '<div class="section-title">' + escapeHtml(opts.searchTitle) + "</div>" +
    '<div class="flight-search">' +
    '<input type="text" class="lookup-input" placeholder="성함을 입력하세요" />' +
    '<button type="button" class="btn btn-accent lookup-btn">조회</button>' +
    "</div>" +
    '<div class="lookup-result"></div>' +
    "</div>";
  root.innerHTML = html;

  const input = root.querySelector(".lookup-input");
  const btn = root.querySelector(".lookup-btn");
  const resultEl = root.querySelector(".lookup-result");

  // "이름 (메모)" → 이름 부분만
  function baseName(member) {
    return member.replace(/\s*\(.*\)\s*$/, "").trim();
  }

  function renderResults(query) {
    const q = query.trim();
    if (!q) {
      resultEl.innerHTML = '<p class="flight-empty">성함을 입력하고 조회 버튼을 눌러주세요.</p>';
      return;
    }
    const all = [];
    groups.forEach((g) => (g.members || []).forEach((m) => all.push({ group: g, member: String(m).trim() })));
    let matches = all.filter((x) => baseName(x.member) === q);
    if (!matches.length) matches = all.filter((x) => x.member.toLowerCase().includes(q.toLowerCase()));
    if (!matches.length) {
      resultEl.innerHTML = '<p class="flight-empty">일치하는 이름을 찾지 못했어요. 성함을 다시 확인해주세요.</p>';
      return;
    }

    // 같은 사람끼리 묶어서 한 카드에 보여줍니다.
    const byPerson = [];
    matches.forEach((x) => {
      const name = baseName(x.member);
      let entry = byPerson.find((p) => p.name === name);
      if (!entry) byPerson.push((entry = { name: name, rows: [] }));
      entry.rows.push(x);
    });

    resultEl.innerHTML = byPerson
      .map(
        (p) =>
          '<div class="flight-result-card">' +
          '<div class="flight-result-name">' + escapeHtml(p.name) + "</div>" +
          p.rows
            .map((x) => {
              const memo = x.member.match(/\((.*)\)\s*$/);
              return (
                '<div class="flight-leg">' +
                (x.group.date ? '<div class="flight-leg-label">' + escapeHtml(x.group.date) + "</div>" : "") +
                '<div class="lookup-label">' + escapeHtml(x.group.label) + "</div>" +
                (memo ? '<div class="flight-leg-sub">' + escapeHtml(memo[1]) + "</div>" : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>"
      )
      .join("");
  }

  btn.addEventListener("click", () => renderResults(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") renderResults(input.value);
  });
}
