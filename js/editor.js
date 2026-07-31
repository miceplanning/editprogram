/*
  =====================================================================
   콘텐츠 편집기 로직 (editor.js)
  =====================================================================
  ✅ 이 파일은 editor.html의 폼을 동작시키는 코드입니다. 운영팀은 이 파일을
     건드릴 필요가 없습니다 — editor.html 화면에서 값만 입력하면 됩니다.
  ✅ 동작 방식:
     1) 페이지가 열리면 이미 로드된 js/content.js(window.CONTENT)의 값을
        폼에 채워 넣습니다.
     2) 폼을 수정하면 메모리상의 state 객체가 함께 바뀝니다.
     3) "content.js 파일 저장" 버튼을 누르면 state를 새 content.js 텍스트로
        만들어 다운로드합니다. (서버 없이 브라우저에서만 동작)
  =====================================================================
*/

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// "2026-07-02" 같은 날짜 값을 목록 제목에 보여줄 "7/2(목)" 형태로 바꿔줍니다.
function formatDateLabel(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + days[d.getDay()] + ")";
}

// window.CONTENT에 없는 값이 있어도 편집기가 깨지지 않도록 기본값을 채워줍니다.
function withDefaults(src) {
  src = src || {};
  return {
    eventName: src.eventName || "",
    eventSubtitle: src.eventSubtitle || "",
    date: src.date || "",
    dateDisplay: src.dateDisplay || "",
    heroImage: src.heroImage || "",
    heroTagline: src.heroTagline || "",
    sectionsEnabled: Object.assign(
      { rainPlan: true, staff: true, meetingSummary: true, checklist: true, faq: true, survey: true, flight: false, location: true },
      src.sectionsEnabled || {}
    ),
    notice: Object.assign({ active: false, text: "" }, src.notice || {}),
    rainPlan: Object.assign(
      { hasIndoorAlternative: false, description: "", decisionTime: "" },
      src.rainPlan || {}
    ),
    contact: Object.assign({ name: "", role: "", phone: "" }, src.contact || {}),
    staff: src.staff ? deepClone(src.staff) : [],
    meetingSummary: Object.assign({ time: "", location: "", mapUrl: "" }, src.meetingSummary || {}),
    schedule: src.schedule ? deepClone(src.schedule) : [],
    locations: src.locations ? deepClone(src.locations) : [],
    mapEmbedQuery: src.mapEmbedQuery || "",
    checklist: src.checklist ? deepClone(src.checklist) : [],
    faq: src.faq ? deepClone(src.faq) : [],
    survey: Object.assign({ url: "", duration: "" }, src.survey || {}),
    flight: Object.assign({ formUrl: "", notice: "", records: [] }, src.flight || {}, {
      records: src.flight && src.flight.records ? deepClone(src.flight.records) : []
    })
  };
}

// URL이 editor.html?project=xxxx 형태면 "프로젝트 모드"로 동작합니다.
// projects.html(프로젝트 목록)에서 저장해둔 초안을 불러와서 편집하고,
// 수정할 때마다 자동으로 이 브라우저에 다시 저장합니다.
const PROJECT_ID = new URLSearchParams(location.search).get("project");
const PROJECT_SOURCE = PROJECT_ID ? getProjectContent(PROJECT_ID) || {} : window.CONTENT;

const state = withDefaults(PROJECT_SOURCE);
let dirty = false;

let _autosaveTimer = null;
function markDirty() {
  dirty = true;
  if (!PROJECT_ID) return;
  // 타이핑할 때마다 바로바로 저장하지 않고, 잠깐 멈췄을 때 한 번만 저장합니다.
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => {
    saveProjectContent(PROJECT_ID, buildExportObject());
    const badge = document.getElementById("autosave-badge");
    if (badge) {
      badge.textContent = "✅ 자동 저장됨";
      clearTimeout(badge._resetTimer);
      badge._resetTimer = setTimeout(() => { badge.textContent = "🗂️ 이 브라우저에 자동 저장돼요"; }, 1500);
    }
  }, 600);
}

window.addEventListener("beforeunload", function (e) {
  if (dirty && !PROJECT_ID) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---------------------------------------------------------------
// 단일 값 입력칸을 state와 연결하는 공통 함수
// ---------------------------------------------------------------
function bindInput(id, obj, key) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") {
    el.checked = !!obj[key];
    const handler = () => { obj[key] = el.checked; markDirty(); };
    el.addEventListener("change", handler);
  } else {
    el.value = obj[key] || "";
    el.addEventListener("input", () => { obj[key] = el.value; markDirty(); });
  }
}

// ---------------------------------------------------------------
// 반복 목록(스태프/일정/장소/FAQ) 카드를 만드는 공통 도우미들
// ---------------------------------------------------------------
function moveInArray(arr, item, dir) {
  const i = arr.indexOf(item);
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

function moveIndex(arr, idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= arr.length) return;
  const tmp = arr[idx];
  arr[idx] = arr[j];
  arr[j] = tmp;
}

function setCount(id, n) {
  const el = document.getElementById(id);
  if (el) el.textContent = n + "개";
}

function smallBtn(text, onClick, danger) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  if (danger) b.classList.add("danger");
  b.addEventListener("click", onClick);
  return b;
}

function createRowShell(titleText, item, arr, rerender) {
  const row = document.createElement("div");
  row.className = "edit-row";
  const header = document.createElement("div");
  header.className = "edit-row-header";
  const titleSpan = document.createElement("span");
  titleSpan.textContent = titleText;
  const actions = document.createElement("div");
  actions.className = "edit-row-actions";
  actions.appendChild(smallBtn("↑", () => { moveInArray(arr, item, -1); rerender(); markDirty(); }));
  actions.appendChild(smallBtn("↓", () => { moveInArray(arr, item, 1); rerender(); markDirty(); }));
  actions.appendChild(smallBtn("삭제", () => { arr.splice(arr.indexOf(item), 1); rerender(); markDirty(); }, true));
  header.appendChild(titleSpan);
  header.appendChild(actions);
  const body = document.createElement("div");
  row.appendChild(header);
  row.appendChild(body);
  return { row, body };
}

function fieldGrid(...labels) {
  const div = document.createElement("div");
  div.className = "field-grid";
  labels.forEach((l) => div.appendChild(l));
  return div;
}

function fieldInput(labelText, item, key, opts) {
  opts = opts || {};
  const label = document.createElement("label");
  if (opts.span2) label.classList.add("span-2");
  label.appendChild(document.createTextNode(labelText));
  const input = document.createElement(opts.textarea ? "textarea" : "input");
  if (!opts.textarea) input.type = opts.type || "text";
  if (opts.rows) input.rows = opts.rows;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  input.value = item[key] || "";
  input.addEventListener("input", () => { item[key] = input.value; markDirty(); });
  label.appendChild(input);
  return label;
}

function fieldSelect(labelText, item, key, options) {
  const label = document.createElement("label");
  label.appendChild(document.createTextNode(labelText));
  const select = document.createElement("select");
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if ((item[key] || "") === opt.value) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener("input", () => { item[key] = select.value; markDirty(); });
  label.appendChild(select);
  return label;
}

function fieldCheckbox(labelText, obj, key) {
  const wrap = document.createElement("label");
  wrap.className = "checkbox-line";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!obj[key];
  input.addEventListener("change", () => { obj[key] = input.checked; markDirty(); });
  wrap.appendChild(input);
  wrap.appendChild(document.createTextNode(labelText));
  return wrap;
}

function fieldTextareaList(labelText, item, key) {
  const label = document.createElement("label");
  label.classList.add("span-2");
  label.appendChild(document.createTextNode(labelText));
  const ta = document.createElement("textarea");
  ta.rows = 3;
  ta.placeholder = "1순위: ...\n2순위: ...";
  ta.value = (item[key] || []).join("\n");
  ta.addEventListener("input", () => {
    item[key] = ta.value.split("\n").map((s) => s.trim()).filter(Boolean);
    markDirty();
  });
  label.appendChild(ta);
  return label;
}

// ---------------------------------------------------------------
// 사진 선택기 (컴퓨터에서 사진 선택 → 미리보기 → 가능하면 images 폴더에 자동 저장)
// ---------------------------------------------------------------
// 브라우저가 폴더에 직접 파일을 써주는 기능(File System Access API)을 지원하는지 여부.
// 크롬/엣지 데스크톱에서 http(s):// 또는 http://localhost 로 열었을 때만 지원됩니다.
// (파일을 더블클릭해서 file:// 로 열었거나 사파리/파이어폭스라면 지원되지 않습니다)
function supportsFolderSave() {
  return typeof window.showDirectoryPicker === "function";
}

let imagesDirHandle = null;

async function connectImagesFolder() {
  try {
    imagesDirHandle = await window.showDirectoryPicker({ id: "dreamtour-images", mode: "readwrite" });
    const statusEl = document.getElementById("folder-connect-status");
    if (statusEl) {
      statusEl.textContent = "✅ \"" + imagesDirHandle.name + "\" 폴더에 연결됨 — 이제 사진을 선택하면 자동 저장돼요";
      statusEl.className = "photo-status ok";
    }
  } catch (e) {
    // 사용자가 폴더 선택 대화상자를 취소한 경우 등 — 별도 처리 없이 무시합니다.
  }
}

function sanitizeFileName(name) {
  // 맥에서 고른 한글 파일명은 자모가 분리된 형태(NFD)로 들어올 때가 있는데,
  // git이 커밋할 때는 이걸 조합형(NFC)으로 자동 변환해버립니다. 그래서
  // 여기서 미리 NFC로 맞춰두지 않으면, 저장된 실제 파일명과 content.js에
  // 적힌 경로가 (눈에는 똑같아 보여도) 실제로는 달라서 사진이 안 뜨는
  // 문제가 생깁니다.
  return name.normalize("NFC").replace(/\s+/g, "-");
}

async function saveFileToImagesFolder(file, fileName) {
  const fileHandle = await imagesDirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

// pathInput(예: "대표 사진 경로" 입력칸) 바로 뒤에 [사진 선택] 버튼 + 미리보기 + 안내문구를 붙여줍니다.
// opts.prefix: 자동으로 채울 파일명 앞에 붙일 접두어 (예: 스태프 사진은 "staff-")
function attachPhotoPicker(pathInput, opts) {
  if (!pathInput) return;
  opts = opts || {};

  const wrap = document.createElement("div");
  wrap.className = "photo-picker";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;

  const pickBtn = document.createElement("button");
  pickBtn.type = "button";
  pickBtn.className = "photo-pick-btn";
  pickBtn.textContent = "🖼️ 사진 선택";
  pickBtn.addEventListener("click", () => fileInput.click());

  const thumb = document.createElement("img");
  thumb.className = "photo-thumb";
  thumb.hidden = true;
  thumb.alt = "선택한 사진 미리보기";

  const status = document.createElement("span");
  status.className = "photo-status";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    thumb.src = URL.createObjectURL(file);
    thumb.hidden = false;

    const fileName = (opts.prefix || "") + sanitizeFileName(file.name);
    pathInput.value = "images/" + fileName;
    pathInput.dispatchEvent(new Event("input", { bubbles: true }));

    if (imagesDirHandle) {
      try {
        await saveFileToImagesFolder(file, fileName);
        status.textContent = "✅ images 폴더에 자동 저장됨";
        status.className = "photo-status ok";
      } catch (e) {
        status.textContent = "⚠️ 자동 저장에 실패했어요. 이 사진을 직접 images 폴더에 복사해주세요.";
        status.className = "photo-status warn";
      }
    } else if (supportsFolderSave()) {
      status.textContent = "위 'images 폴더 연결하기' 버튼을 누르면 다음부터 자동 저장돼요";
      status.className = "photo-status hint";
    } else {
      status.textContent = "⚠️ 이 브라우저는 자동 저장을 지원하지 않아요. 이 사진을 직접 images 폴더에 복사해주세요.";
      status.className = "photo-status warn";
    }
  });

  wrap.appendChild(pickBtn);
  wrap.appendChild(fileInput);
  wrap.appendChild(thumb);
  wrap.appendChild(status);
  pathInput.insertAdjacentElement("afterend", wrap);
}

// ---------------------------------------------------------------
// ⑤ 스태프 목록
// ---------------------------------------------------------------
function renderStaffList() {
  const container = document.getElementById("staff-list");
  container.innerHTML = "";
  state.staff.forEach((item, idx) => {
    const { row, body } = createRowShell(
      "스태프 " + (idx + 1) + (item.name ? " · " + item.name : ""),
      item, state.staff, renderStaffList
    );
    const photoLabel = fieldInput("사진 경로", item, "photo", { placeholder: "images/staff-1.jpg" });
    body.appendChild(fieldGrid(
      fieldInput("이름", item, "name"),
      fieldInput("역할", item, "role"),
      fieldInput("전화번호", item, "phone", { placeholder: "010-0000-0000" }),
      photoLabel
    ));
    attachPhotoPicker(photoLabel.querySelector("input"), { prefix: "staff-" + (idx + 1) + "-" });
    container.appendChild(row);
  });
  setCount("count-staff", state.staff.length);
}

// 특정 일정 항목의 구글폼/드라이브 링크 입력칸 + 드라이브 폴더 미리보기(조회 전용)를 그립니다.
function renderUploadViewer(container, item) {
  container.innerHTML = "";
  if (!item.photoUpload || !item.photoUpload.enabled) return;
  if (!item.photoUpload.formUrl) item.photoUpload.formUrl = "";
  if (!item.photoUpload.driveFolderUrl) item.photoUpload.driveFolderUrl = "";
  if (!item.photoUpload.description) item.photoUpload.description = "";

  container.appendChild(fieldInput(
    "참가자에게 보여줄 안내 문구 (선택)", item.photoUpload, "description",
    { textarea: true, rows: 2, span2: true, placeholder: "예: 이 활동에서 찍은 사진을 팀별로 올려주세요!" }
  ));

  container.appendChild(fieldGrid(
    fieldInput("구글폼 링크 (참가자가 사진 올리는 곳)", item.photoUpload, "formUrl", { span2: true, placeholder: "https://forms.gle/..." }),
    fieldInput("구글 드라이브 폴더 링크 (응답 파일이 쌓이는 곳)", item.photoUpload, "driveFolderUrl", { span2: true, placeholder: "https://drive.google.com/drive/folders/..." })
  ));

  container.appendChild(fieldCheckbox(
    "🎬 참가자 화면에도 이 폴더 모아보기 갤러리 보여주기 (투표 등 모두가 결과물을 봐야 할 때만 켜세요 — 폴더가 \"링크가 있는 모든 사용자\"로 공유되어 있어야 합니다)",
    item.photoUpload, "showGallery"
  ));

  const preview = document.createElement("div");
  preview.className = "upload-viewer-preview";
  container.appendChild(preview);

  function renderPreview() {
    const embedUrl = driveFolderEmbedUrl(item.photoUpload.driveFolderUrl);
    preview.innerHTML = embedUrl
      ? '<iframe src="' + embedUrl + '" loading="lazy" title="업로드된 사진 폴더 미리보기"></iframe>'
      : '<div class="upload-viewer-note">드라이브 폴더 링크를 넣으면 여기서 업로드된 사진을 바로 확인할 수 있어요.</div>';
  }
  renderPreview();
  container.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", renderPreview));
}

// ---------------------------------------------------------------
// ⑦ 시간별 일정
// ---------------------------------------------------------------
function renderScheduleList() {
  const container = document.getElementById("schedule-list");
  container.innerHTML = "";
  state.schedule.forEach((item, idx) => {
    const { row, body } = createRowShell(
      (idx + 1) + ". " + (item.date ? formatDateLabel(item.date) + " " : "") + (item.time || "--:--") + " " + (item.title || "(제목 없음)"),
      item, state.schedule, renderScheduleList
    );

    const photoLabel = fieldInput("관련 사진 경로 (선택)", item, "photo", { span2: true, placeholder: "images/schedule-1.jpg" });
    body.appendChild(fieldGrid(
      fieldInput("일자 (선택, 여러 날 행사만)", item, "date", { type: "date" }),
      fieldInput("시작 시각", item, "time", { placeholder: "13:00" }),
      fieldInput("종료 시각 (선택)", item, "endTime", { placeholder: "13:20" }),
      fieldInput("일정 제목", item, "title", { span2: true }),
      fieldInput("장소명", item, "location", { span2: true }),
      fieldInput("구글맵 링크", item, "mapUrl", { span2: true, placeholder: "https://maps.google.com/?q=..." }),
      fieldInput("투표 링크 (선택, 예: 팀별 미션 투표용 구글폼)", item, "voteUrl", { span2: true, placeholder: "https://docs.google.com/forms/..." }),
      fieldInput("상세 설명 (펼쳤을 때 보이는 내용)", item, "description", { textarea: true, rows: 2, span2: true }),
      photoLabel,
      fieldInput("다음 장소까지 이동시간 (선택)", item, "travelTimeToNext", { placeholder: "버스 이동 약 15분" }),
      fieldSelect("난이도 (도보 프로그램만)", item, "difficulty", [
        { value: "", label: "해당 없음" },
        { value: "쉬움", label: "쉬움" },
        { value: "보통", label: "보통" },
        { value: "약간 힘듦", label: "약간 힘듦" }
      ]),
      fieldInput("총 도보 거리 (선택)", item, "distance", { placeholder: "총 도보 2.3km" })
    ));
    attachPhotoPicker(photoLabel.querySelector("input"), { prefix: "schedule-" + (idx + 1) + "-" });

    // 식사 정보 (알레르기/채식) 토글 블록
    const mealToggle = document.createElement("label");
    mealToggle.className = "checkbox-line";
    const mealCheckbox = document.createElement("input");
    mealCheckbox.type = "checkbox";
    mealCheckbox.checked = !!item.meal;
    mealToggle.appendChild(mealCheckbox);
    mealToggle.appendChild(document.createTextNode("이 항목은 식사 일정입니다 (알레르기/채식 정보 표시)"));
    body.appendChild(mealToggle);

    const mealBlock = document.createElement("div");
    mealBlock.className = "meal-block";
    mealBlock.hidden = !item.meal;
    function renderMealBlock() {
      mealBlock.innerHTML = "";
      if (!item.meal) return;
      mealBlock.appendChild(fieldCheckbox("알레르기 주의 안내 표시", item.meal, "hasAllergyInfo"));
      mealBlock.appendChild(fieldInput("알레르기 안내 문구", item.meal, "allergyNote", { textarea: true, rows: 2 }));
      mealBlock.appendChild(fieldInput("채식 옵션 안내 (없으면 빈칸)", item.meal, "vegetarianOption"));
    }
    renderMealBlock();
    mealCheckbox.addEventListener("change", () => {
      item.meal = mealCheckbox.checked
        ? (item.meal || { hasAllergyInfo: true, allergyNote: "", vegetarianOption: "" })
        : null;
      mealBlock.hidden = !item.meal;
      renderMealBlock();
      markDirty();
    });
    body.appendChild(mealBlock);

    body.appendChild(fieldTextareaList("자유시간 추천 동선 (한 줄에 하나씩, 없으면 빈칸)", item, "freeTimeRecommendation"));

    // 참가자 사진 업로드 받기 토글 + (켜져 있으면) 업로드된 사진 확인 뷰어
    if (!item.photoUpload) item.photoUpload = { enabled: false };
    const uploadToggle = document.createElement("label");
    uploadToggle.className = "checkbox-line";
    const uploadCheckbox = document.createElement("input");
    uploadCheckbox.type = "checkbox";
    uploadCheckbox.checked = !!item.photoUpload.enabled;
    uploadToggle.appendChild(uploadCheckbox);
    uploadToggle.appendChild(document.createTextNode("📸 참가자에게 이 활동 사진 업로드 받기"));
    body.appendChild(uploadToggle);

    const uploadViewer = document.createElement("div");
    uploadViewer.className = "upload-viewer";
    uploadViewer.hidden = !item.photoUpload.enabled;
    body.appendChild(uploadViewer);
    renderUploadViewer(uploadViewer, item);

    uploadCheckbox.addEventListener("change", () => {
      item.photoUpload.enabled = uploadCheckbox.checked;
      uploadViewer.hidden = !item.photoUpload.enabled;
      renderUploadViewer(uploadViewer, item);
      markDirty();
    });

    container.appendChild(row);
  });
  setCount("count-schedule", state.schedule.length);
}

// ---------------------------------------------------------------
// ⑧ 오시는 길 장소 목록
// ---------------------------------------------------------------
function renderLocationsList() {
  const container = document.getElementById("locations-list");
  container.innerHTML = "";
  state.locations.forEach((item, idx) => {
    const { row, body } = createRowShell(
      (idx + 1) + ". " + (item.name || "(이름 없음)"),
      item, state.locations, renderLocationsList
    );
    body.appendChild(fieldGrid(
      fieldInput("장소명", item, "name", { span2: true }),
      fieldInput("설명", item, "description", { span2: true }),
      fieldInput("주소", item, "address", { span2: true }),
      fieldInput("구글맵 링크", item, "mapUrl", { span2: true, placeholder: "https://maps.google.com/?q=..." })
    ));
    container.appendChild(row);
  });
  setCount("count-locations", state.locations.length);
}

// ---------------------------------------------------------------
// ⑨ 준비물 체크리스트 (문자열 배열)
// ---------------------------------------------------------------
function renderChecklistList() {
  const container = document.getElementById("checklist-list");
  container.innerHTML = "";
  state.checklist.forEach((val, idx) => {
    const row = document.createElement("div");
    row.className = "simple-row";
    const input = document.createElement("input");
    input.type = "text";
    input.value = val;
    input.addEventListener("input", () => { state.checklist[idx] = input.value; markDirty(); });
    row.appendChild(input);
    row.appendChild(smallBtn("↑", () => { moveIndex(state.checklist, idx, -1); renderChecklistList(); markDirty(); }));
    row.appendChild(smallBtn("↓", () => { moveIndex(state.checklist, idx, 1); renderChecklistList(); markDirty(); }));
    row.appendChild(smallBtn("삭제", () => { state.checklist.splice(idx, 1); renderChecklistList(); markDirty(); }, true));
    container.appendChild(row);
  });
  setCount("count-checklist", state.checklist.length);
}

// ---------------------------------------------------------------
// ⑩ FAQ
// ---------------------------------------------------------------
function renderFaqList() {
  const container = document.getElementById("faq-list");
  container.innerHTML = "";
  state.faq.forEach((item, idx) => {
    const { row, body } = createRowShell(
      "Q" + (idx + 1) + ". " + (item.q || "(질문 없음)"),
      item, state.faq, renderFaqList
    );
    body.appendChild(fieldInput("질문", item, "q", { span2: true }));
    body.appendChild(fieldInput("답변", item, "a", { textarea: true, rows: 2, span2: true }));
    container.appendChild(row);
  });
  setCount("count-faq", state.faq.length);
}

// ---------------------------------------------------------------
// ⑫ 항공권 정보
// ---------------------------------------------------------------
const FLIGHT_PASTE_FIELDS = [
  "name", "departureDate", "departureAirline", "departureTime", "departureLocation", "departureFlight", "departureReservation",
  "returnDate", "returnAirline", "returnTime", "returnLocation", "returnFlight", "returnReservation"
];

// 엑셀/구글시트에서 표를 복사해 붙여넣으면 탭으로 구분된 텍스트가 들어옵니다.
// "NO." 순번 칸이 같이 복사돼 있어도, 머리글(제목) 줄이 섞여 있어도 알아서 걸러냅니다.
function parseFlightPasteText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cols) => cols.some(Boolean))
    .filter((cols) => !/^(no\.?|번호)$/i.test(cols[0] || ""));

  return lines
    .map((cols) => {
      let values = cols;
      if (values.length > FLIGHT_PASTE_FIELDS.length && /^\d+$/.test(values[0])) {
        values = values.slice(1);
      }
      const record = {};
      FLIGHT_PASTE_FIELDS.forEach((key, idx) => { record[key] = values[idx] || ""; });
      return record;
    })
    .filter((r) => r.name && r.name !== "성함(한글)" && r.name !== "성함" && r.name !== "이름");
}

function renderFlightList() {
  const container = document.getElementById("flight-list");
  container.innerHTML = "";
  state.flight.records.forEach((item, idx) => {
    const { row, body } = createRowShell(
      (idx + 1) + ". " + (item.name || "(이름 없음)"),
      item, state.flight.records, renderFlightList
    );
    body.appendChild(fieldInput("성함", item, "name", { span2: true }));
    body.appendChild(fieldGrid(
      fieldInput("출발일자", item, "departureDate", { placeholder: "7/2(목)" }),
      fieldInput("출발항공사", item, "departureAirline"),
      fieldInput("출발시각", item, "departureTime", { placeholder: "06:35" }),
      fieldInput("출발지", item, "departureLocation"),
      fieldInput("출발편명", item, "departureFlight", { placeholder: "KE1007" }),
      fieldInput("출발 예약번호", item, "departureReservation")
    ));
    body.appendChild(fieldGrid(
      fieldInput("복귀일자", item, "returnDate", { placeholder: "7/4(토)" }),
      fieldInput("복귀항공사", item, "returnAirline"),
      fieldInput("복귀시각", item, "returnTime", { placeholder: "10:25" }),
      fieldInput("복귀지", item, "returnLocation"),
      fieldInput("복귀편명", item, "returnFlight", { placeholder: "KE1174" }),
      fieldInput("복귀 예약번호", item, "returnReservation")
    ));
    container.appendChild(row);
  });
  setCount("count-flight", state.flight.records.length);
}

// ---------------------------------------------------------------
// content.js 파일 텍스트 생성 + 다운로드
// ---------------------------------------------------------------
function buildExportObject() {
  return {
    eventName: state.eventName,
    eventSubtitle: state.eventSubtitle,
    date: state.date,
    dateDisplay: state.dateDisplay,
    sectionsEnabled: {
      rainPlan: !!state.sectionsEnabled.rainPlan,
      staff: !!state.sectionsEnabled.staff,
      meetingSummary: !!state.sectionsEnabled.meetingSummary,
      checklist: !!state.sectionsEnabled.checklist,
      faq: !!state.sectionsEnabled.faq,
      survey: !!state.sectionsEnabled.survey,
      flight: !!state.sectionsEnabled.flight,
      location: !!state.sectionsEnabled.location
    },
    heroImage: state.heroImage,
    heroTagline: state.heroTagline,
    notice: { active: !!state.notice.active, text: state.notice.text },
    rainPlan: {
      hasIndoorAlternative: !!state.rainPlan.hasIndoorAlternative,
      description: state.rainPlan.description,
      decisionTime: state.rainPlan.decisionTime
    },
    contact: { name: state.contact.name, role: state.contact.role, phone: state.contact.phone },
    staff: state.staff.map((s) => ({ name: s.name || "", role: s.role || "", phone: s.phone || "", photo: s.photo || "" })),
    meetingSummary: {
      time: state.meetingSummary.time,
      location: state.meetingSummary.location,
      mapUrl: state.meetingSummary.mapUrl
    },
    schedule: state.schedule.map((it, idx) => ({
      id: idx + 1,
      date: it.date || "",
      time: it.time || "",
      endTime: it.endTime || null,
      title: it.title || "",
      location: it.location || "",
      mapUrl: it.mapUrl || "",
      voteUrl: it.voteUrl || "",
      description: it.description || "",
      travelTimeToNext: it.travelTimeToNext || null,
      difficulty: it.difficulty || null,
      distance: it.distance || null,
      meal: it.meal
        ? {
            hasAllergyInfo: !!it.meal.hasAllergyInfo,
            allergyNote: it.meal.allergyNote || "",
            vegetarianOption: it.meal.vegetarianOption || ""
          }
        : null,
      freeTimeRecommendation: it.freeTimeRecommendation && it.freeTimeRecommendation.length ? it.freeTimeRecommendation : null,
      photo: it.photo || null,
      photoUpload: {
        enabled: !!(it.photoUpload && it.photoUpload.enabled),
        formUrl: (it.photoUpload && it.photoUpload.formUrl) || "",
        driveFolderUrl: (it.photoUpload && it.photoUpload.driveFolderUrl) || "",
        description: (it.photoUpload && it.photoUpload.description) || "",
        showGallery: !!(it.photoUpload && it.photoUpload.showGallery)
      }
    })),
    locations: state.locations.map((loc, idx) => ({
      order: idx + 1,
      name: loc.name || "",
      description: loc.description || "",
      address: loc.address || "",
      mapUrl: loc.mapUrl || ""
    })),
    mapEmbedQuery: state.mapEmbedQuery,
    checklist: state.checklist.filter((s) => s && s.trim()),
    faq: state.faq.map((f) => ({ q: f.q || "", a: f.a || "" })),
    survey: { url: state.survey.url, duration: state.survey.duration },
    flight: {
      formUrl: state.flight.formUrl || "",
      notice: state.flight.notice || "",
      records: state.flight.records.map((r) => ({
        name: r.name || "",
        departureDate: r.departureDate || "",
        departureAirline: r.departureAirline || "",
        departureTime: r.departureTime || "",
        departureLocation: r.departureLocation || "",
        departureFlight: r.departureFlight || "",
        departureReservation: r.departureReservation || "",
        returnDate: r.returnDate || "",
        returnAirline: r.returnAirline || "",
        returnTime: r.returnTime || "",
        returnLocation: r.returnLocation || "",
        returnFlight: r.returnFlight || "",
        returnReservation: r.returnReservation || ""
      }))
    }
  };
}

function generateFileText() {
  const json = JSON.stringify(buildExportObject(), null, 2);
  return (
    "/*\n" +
    "  =====================================================================\n" +
    "   [운영팀 전용] 행사 콘텐츠 데이터 파일\n" +
    "  =====================================================================\n" +
    "  이 파일은 editor.html(콘텐츠 편집기)에서 자동으로 생성되었습니다.\n" +
    "  editor.html을 열어 다시 수정하거나, 이 파일을 텍스트 편집기로 직접 열어\n" +
    "  큰따옴표 안의 값을 고쳐도 됩니다.\n" +
    "  =====================================================================\n" +
    "*/\n\n" +
    "window.CONTENT = " + json + ";\n"
  );
}

// 헤더 실제 높이를 측정해서 사이드 메뉴가 헤더 뒤에 가려지지 않도록 맞춥니다.
// (글자 줄바꿈 등으로 헤더 높이가 화면 크기별로 달라질 수 있어 고정값 대신 매번 측정합니다)
function syncHeaderHeight() {
  const header = document.querySelector(".editor-header");
  if (!header) return;
  document.documentElement.style.setProperty("--editor-header-h", header.offsetHeight + "px");
}

function doDownload() {
  const text = generateFileText();
  const blob = new Blob([text], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "content.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  dirty = false;

  const floatBtn = document.getElementById("floating-save");
  if (floatBtn) {
    floatBtn.textContent = "✅";
    floatBtn.classList.add("saved");
    setTimeout(() => {
      floatBtn.textContent = "💾";
      floatBtn.classList.remove("saved");
    }, 1500);
  }
}

// ---------------------------------------------------------------
// 섹션 사용/사용안함 토글 ("이 섹션 사용" 체크박스가 있는 패널들)
// 데이터는 지우지 않고 sectionsEnabled 플래그만 꺼서, 참가자 사이트에서만
// 안 보이게 합니다 — 다음 회차에 다시 켜면 그대로 돌아옵니다.
// ---------------------------------------------------------------
function updateSectionToggleVisual(checkbox) {
  const key = checkbox.dataset.sectionKey;
  const enabled = checkbox.checked;
  const toggleWrap = checkbox.closest(".section-toggle");
  if (toggleWrap) toggleWrap.classList.toggle("is-off", !enabled);

  const panel = checkbox.closest(".editor-panel");
  if (!panel) return;
  const navBtn = document.querySelector('#editor-nav button[data-target="' + panel.id + '"]');
  if (!navBtn) return;
  navBtn.classList.toggle("section-off", !enabled);
  let badge = navBtn.querySelector(".off-badge");
  if (!enabled) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "off-badge";
      badge.textContent = "꺼짐";
      navBtn.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}

function initSectionToggles() {
  document.querySelectorAll("input[data-section-key]").forEach((checkbox) => {
    const key = checkbox.dataset.sectionKey;

    const note = document.createElement("div");
    note.className = "off-note";
    note.textContent = "⚠️ 지금 이 섹션은 꺼져 있어서 참가자 사이트에는 보이지 않습니다.";
    const toggleWrap = checkbox.closest(".section-toggle");
    if (toggleWrap) toggleWrap.appendChild(note);

    checkbox.checked = state.sectionsEnabled[key] !== false;
    updateSectionToggleVisual(checkbox);

    checkbox.addEventListener("change", () => {
      state.sectionsEnabled[key] = checkbox.checked;
      updateSectionToggleVisual(checkbox);
      markDirty();
    });
  });
}

// ---------------------------------------------------------------
// 좌측(모바일: 상단) 메뉴 + 패널 전환 + 이전/다음 내비게이션
// 패널 HTML에 있는 data-icon / data-label을 읽어서 메뉴를 자동으로 만듭니다.
// ---------------------------------------------------------------
function initWizardNav() {
  const panels = Array.from(document.querySelectorAll(".editor-panel"));
  const nav = document.getElementById("editor-nav");
  const footerNav = document.getElementById("panel-footer-nav");
  const progressFill = document.getElementById("progress-fill");
  const visited = new Set();

  panels.forEach((panel) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-item";
    btn.dataset.target = panel.id;
    btn.innerHTML =
      '<span class="nav-icon">' + panel.dataset.icon + "</span>" +
      '<span class="nav-label">' + panel.dataset.label + "</span>";
    btn.addEventListener("click", () => showPanel(panel.id));
    nav.appendChild(btn);
  });

  function showPanel(id) {
    const idx = panels.findIndex((p) => p.id === id);
    if (idx === -1) return;
    visited.add(id);

    panels.forEach((p) => { p.hidden = p.id !== id; });
    Array.from(nav.children).forEach((btn) => {
      const isActive = btn.dataset.target === id;
      btn.classList.toggle("active", isActive);
      btn.classList.toggle("visited", visited.has(btn.dataset.target) && !isActive);
      if (isActive) btn.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    });

    progressFill.style.width = Math.round(((idx + 1) / panels.length) * 100) + "%";

    footerNav.innerHTML = "";
    if (idx > 0) {
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.textContent = "← 이전";
      prevBtn.addEventListener("click", () => showPanel(panels[idx - 1].id));
      footerNav.appendChild(prevBtn);
    } else {
      footerNav.appendChild(document.createElement("span"));
    }
    footerNav.appendChild(Object.assign(document.createElement("div"), { className: "spacer" }));
    if (idx < panels.length - 1) {
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "primary-next";
      nextBtn.textContent = "다음 →";
      nextBtn.addEventListener("click", () => showPanel(panels[idx + 1].id));
      footerNav.appendChild(nextBtn);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  showPanel(panels[0].id);
}

document.addEventListener("DOMContentLoaded", function () {
  bindInput("f-eventName", state, "eventName");
  bindInput("f-eventSubtitle", state, "eventSubtitle");
  bindInput("f-date", state, "date");
  bindInput("f-dateDisplay", state, "dateDisplay");
  bindInput("f-heroImage", state, "heroImage");
  bindInput("f-heroTagline", state, "heroTagline");

  bindInput("f-notice-active", state.notice, "active");
  bindInput("f-notice-text", state.notice, "text");

  bindInput("f-rain-hasIndoor", state.rainPlan, "hasIndoorAlternative");
  bindInput("f-rain-desc", state.rainPlan, "description");
  bindInput("f-rain-decision", state.rainPlan, "decisionTime");

  bindInput("f-contact-name", state.contact, "name");
  bindInput("f-contact-role", state.contact, "role");
  bindInput("f-contact-phone", state.contact, "phone");

  bindInput("f-meet-time", state.meetingSummary, "time");
  bindInput("f-meet-location", state.meetingSummary, "location");
  bindInput("f-meet-mapUrl", state.meetingSummary, "mapUrl");

  bindInput("f-mapEmbedQuery", state, "mapEmbedQuery");

  bindInput("f-survey-url", state.survey, "url");
  bindInput("f-survey-duration", state.survey, "duration");

  bindInput("f-flight-formUrl", state.flight, "formUrl");
  bindInput("f-flight-notice", state.flight, "notice");

  renderStaffList();
  renderScheduleList();
  renderLocationsList();
  renderChecklistList();
  renderFaqList();
  renderFlightList();

  document.getElementById("add-staff").addEventListener("click", () => {
    state.staff.push({ name: "", role: "", phone: "", photo: "" });
    renderStaffList();
    markDirty();
  });
  document.getElementById("add-schedule").addEventListener("click", () => {
    state.schedule.push({
      id: 0, date: "", time: "", endTime: "", title: "", location: "", mapUrl: "", voteUrl: "",
      description: "", travelTimeToNext: "", difficulty: "", distance: "",
      meal: null, freeTimeRecommendation: [], photo: "", photoUpload: { enabled: false, formUrl: "", driveFolderUrl: "", description: "", showGallery: false }
    });
    renderScheduleList();
    markDirty();
  });
  document.getElementById("add-location").addEventListener("click", () => {
    state.locations.push({ name: "", description: "", address: "", mapUrl: "" });
    renderLocationsList();
    markDirty();
  });
  document.getElementById("add-checklist").addEventListener("click", () => {
    state.checklist.push("");
    renderChecklistList();
    markDirty();
  });
  document.getElementById("add-faq").addEventListener("click", () => {
    state.faq.push({ q: "", a: "" });
    renderFaqList();
    markDirty();
  });
  document.getElementById("add-flight").addEventListener("click", () => {
    state.flight.records.push({
      name: "", departureDate: "", departureAirline: "", departureTime: "", departureLocation: "",
      departureFlight: "", departureReservation: "", returnDate: "", returnAirline: "", returnTime: "",
      returnLocation: "", returnFlight: "", returnReservation: ""
    });
    renderFlightList();
    markDirty();
  });
  document.getElementById("btn-flight-import").addEventListener("click", () => {
    const ta = document.getElementById("f-flight-paste");
    const parsed = parseFlightPasteText(ta.value);
    if (!parsed.length) {
      alert("가져올 내용이 없어요. 엑셀에서 표를 복사해서 붙여넣어주세요.");
      return;
    }
    state.flight.records = state.flight.records.concat(parsed);
    ta.value = "";
    renderFlightList();
    markDirty();
  });
  document.getElementById("btn-flight-clear").addEventListener("click", () => {
    if (!state.flight.records.length) return;
    if (!confirm("등록된 항공권 명단을 전부 삭제할까요? (되돌릴 수 없어요)")) return;
    state.flight.records = [];
    renderFlightList();
    markDirty();
  });

  document.getElementById("btn-download").addEventListener("click", doDownload);
  document.getElementById("floating-save").addEventListener("click", doDownload);

  document.getElementById("btn-show-code").addEventListener("click", () => {
    const out = document.getElementById("code-output");
    if (out.hidden) {
      out.value = generateFileText();
      out.hidden = false;
      out.focus();
      out.select();
    } else {
      out.hidden = true;
    }
  });

  attachPhotoPicker(document.getElementById("f-heroImage"));

  const connectBtn = document.getElementById("btn-connect-folder");
  const connectStatus = document.getElementById("folder-connect-status");
  if (connectBtn) {
    if (supportsFolderSave()) {
      connectBtn.addEventListener("click", connectImagesFolder);
    } else {
      connectBtn.disabled = true;
      connectBtn.title = "이 브라우저(또는 file://로 연 페이지)에서는 지원되지 않아요. Chrome/Edge에서 로컬 서버로 열어주세요.";
      if (connectStatus) {
        connectStatus.textContent = "이 브라우저는 자동 저장을 지원하지 않아요 — 사진 선택 후 직접 images 폴더에 복사해주세요.";
        connectStatus.className = "photo-status warn";
      }
    }
  }

  if (PROJECT_ID) {
    document.getElementById("project-bar").hidden = false;
    document.getElementById("editor-notice").innerHTML =
      '🗂️ 이 초안은 지금 사용 중인 브라우저에 자동으로 저장됩니다. 다른 컴퓨터로 옮기거나 ' +
      '실제 사이트에 반영하려면 여전히 <b>우측 하단의 저장 버튼</b>으로 <code>content.js</code>를 ' +
      "다운로드해야 해요.";
  }

  initWizardNav();
  initSectionToggles();
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
});
