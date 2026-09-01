const CONFIG = window.CONFIG || { syncUrl: "" };

const DISPLAY_START_DATE = "2026-09-01";
const START_DATE = "2026-09-02";
const END_DATE = "2026-09-30";
const STORAGE_KEY = "team-challenge-2026-september-records";
const PENDING_KEY = "team-challenge-2026-september-pending";
const KOREA_TIME_ZONE = "Asia/Seoul";
const FAIL_FINE = 2000;
const ABSENT_FINE = 3000;

const participants = [
  {
    id: "geunje",
    name: "근제",
    goal: "매달리기 30초 · 스쿼트 30개 · 푸쉬업 30개 · 등 스트레칭",
    memo: "예: 전부 완료\n예: 매달리기 30초 / 스쿼트 30 / 푸쉬업 30 / 등 스트레칭 완료",
  },
  {
    id: "mingyeong",
    name: "민경",
    goal: "30분 운동 · 스쿼트 + 등/복부",
    memo: "예: 스쿼트 + 등 운동 30분 완료\n예: 스쿼트 + 복부 운동 30분 완료",
  },
  {
    id: "jaeseon",
    name: "재선",
    goal: "헬스장 주 3회 · 비헬스장 날 스쿼트 50개",
    memo: "예: 헬스장 완료\n예: 하체 운동 완료\n예: 오늘은 집에서 스쿼트 50개 완료",
  },
  {
    id: "geundo",
    name: "근도",
    goal: "평일 · 푸쉬업 50개 또는 러닝 30분",
    memo: "예: 푸쉬업 50개 완료\n예: 러닝 30분 완료\n예: 러닝 4.7km / 30분 완료",
  },
];

const statusMeta = {
  S: { label: "성공", badge: "badge-S", fine: 0 },
  F: { label: "실패", badge: "badge-F", fine: FAIL_FINE },
  P: { label: "패스", badge: "badge-P", fine: 0 },
  A: { label: "무단", badge: "badge-A", fine: ABSENT_FINE },
};

const els = {
  clearLocalButton: document.querySelector("#clearLocalButton"),
  closeEditorButton: document.querySelector("#closeEditorButton"),
  ddayText: document.querySelector("#ddayText"),
  deleteRecordButton: document.querySelector("#deleteRecordButton"),
  editorDateText: document.querySelector("#editorDateText"),
  editorGoalText: document.querySelector("#editorGoalText"),
  editorOverlay: document.querySelector("#editorOverlay"),
  editorTitle: document.querySelector("#editorTitle"),
  exportButton: document.querySelector("#exportButton"),
  gymVisitField: document.querySelector("#gymVisitField"),
  gymVisitInput: document.querySelector("#gymVisitInput"),
  importInput: document.querySelector("#importInput"),
  missionCards: document.querySelector("#missionCards"),
  noteCounter: document.querySelector("#noteCounter"),
  noteInput: document.querySelector("#noteInput"),
  rankingList: document.querySelector("#rankingList"),
  recordGrid: document.querySelector("#recordGrid"),
  refreshButton: document.querySelector("#refreshButton"),
  saveEditorButton: document.querySelector("#saveEditorButton"),
  syncDetailText: document.querySelector("#syncDetailText"),
  syncStatusText: document.querySelector("#syncStatusText"),
  statusBar: document.querySelector(".status-bar"),
  teamFineText: document.querySelector("#teamFineText"),
  todayCountText: document.querySelector("#todayCountText"),
  toast: document.querySelector("#toast"),
  todayText: document.querySelector("#todayText"),
};

let records = {};
let editorState = null;

init();

async function init() {
  records = readLocalRecords(STORAGE_KEY);
  bindEvents();
  render();
  await refreshFromServer({ silent: true });
}

function bindEvents() {
  addDomListener(els.refreshButton, "click", () => refreshFromServer({ silent: false }));
  addDomListener(els.exportButton, "click", exportJson);
  addDomListener(els.importInput, "change", importJson);
  addDomListener(els.clearLocalButton, "click", clearLocalRecords);
  addDomListener(els.closeEditorButton, "click", closeEditor);
  addDomListener(els.editorOverlay, "click", (event) => {
    if (event.target === els.editorOverlay) closeEditor();
  });
  addDomListener(els.noteInput, "input", () => {
    els.noteInput.value = els.noteInput.value.slice(0, 200);
    if (els.noteCounter) els.noteCounter.textContent = `${els.noteInput.value.length} / 200`;
  });
  addDomListener(els.saveEditorButton, "click", saveEditorRecord);
  addDomListener(els.deleteRecordButton, "click", deleteEditorRecord);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEditor();
  });
  document.addEventListener("click", handleDocumentClick);
}

function addDomListener(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function handleDocumentClick(event) {
  const todayStatusButton = event.target.closest("[data-today-status]");
  if (todayStatusButton) {
    openEditor(todayStatusButton.dataset.participantId, getTodayString(), todayStatusButton.dataset.todayStatus);
    return;
  }

  const memoButton = event.target.closest("[data-open-memo]");
  if (memoButton) {
    openEditor(memoButton.dataset.participantId, getTodayString());
    return;
  }

  const gridButton = event.target.closest("[data-grid-date]");
  if (gridButton) {
    handleGridClick(gridButton.dataset.participantId, gridButton.dataset.gridDate);
    return;
  }

  const editorStatusButton = event.target.closest("[data-editor-status]");
  if (editorStatusButton && editorState) {
    editorState.status = editorStatusButton.dataset.editorStatus;
    renderEditorStatusButtons();
  }
}

function render() {
  const today = getTodayString();
  if (els.todayText) els.todayText.textContent = formatKoreanDate(today);
  if (els.ddayText) els.ddayText.textContent = getDdayText(today);
  renderSyncStatus();
  renderMissionCards();
  renderRecordGrid();
  renderRankings();
}

function renderSyncStatus() {
  const hasSync = Boolean(getSyncUrl());
  if (!els.statusBar || !els.syncStatusText || !els.syncDetailText) return;
  els.statusBar.className = "status-bar";
  if (hasSync) {
    els.statusBar.classList.add("is-shared");
    els.syncStatusText.textContent = "팀 공유 켜짐 · 모든 기기 동기화";
    els.syncDetailText.textContent = "Google Sheets와 연결되어 있습니다.";
  } else {
    els.syncStatusText.textContent = "이 기기에만 저장 중";
    els.syncDetailText.textContent = "index.html의 syncUrl을 입력하면 공동 저장이 활성화됩니다.";
  }
}

function setSyncError() {
  if (!els.statusBar || !els.syncStatusText || !els.syncDetailText) return;
  els.statusBar.className = "status-bar is-error";
  els.syncStatusText.textContent = "서버 연결 실패, 이 기기에 임시 저장";
  els.syncDetailText.textContent = "기록 새로고침을 누르면 다시 연결을 시도합니다.";
}

function renderMissionCards() {
  if (!els.missionCards) return;
  const today = getTodayString();
  const withinPeriod = isWithinPeriod(today);
  const recordedCount = participants.filter((participant) => {
    const record = records[getKey(today, participant.id)];
    return Boolean(record?.status);
  }).length;
  if (els.todayCountText) {
    els.todayCountText.textContent = `${recordedCount} / ${participants.length} 기록`;
  }
  els.missionCards.innerHTML = participants
    .map((participant) => {
      const record = getEffectiveRecord(today, participant.id);
      const status = getDisplayStatus(record);
      const statusInfo = statusMeta[status] || { label: "미입력", badge: "badge-empty" };
      const streak = getSuccessStreak(participant.id, today);
      const editable = withinPeriod && isEditableDate(today) && !isAutoPassDate(today, participant.id);
      const note = record.note ? escapeHtml(collapseWhitespace(record.note)) : "메모 없음";
      const extra = getMissionExtra(participant.id, today);
      const lockedText = editable ? "" : `<span class="lock-note">${isAutoPassDate(today, participant.id) ? "오늘은 자동 패스" : "잠김"}</span>`;
      return `
        <article class="mission-card">
          <div class="card-top">
            <div class="participant-head">
              <span class="avatar">${participant.name.slice(0, 1)}</span>
              <div>
                <h3>${participant.name}</h3>
                <p class="mission-goal">${participant.goal}</p>
              </div>
            </div>
            <div class="streak-box">
              <strong>${streak}</strong>
              <span>연속 성공일</span>
            </div>
          </div>
          <div class="mission-meta">
            <span class="badge ${statusInfo.badge}">${statusInfo.label}</span>
            ${lockedText}
          </div>
          ${extra}
          <div class="card-actions">
            <button class="status-S" type="button" data-today-status="S" data-participant-id="${participant.id}" ${editable ? "" : "disabled"}>성공</button>
            <button class="status-F" type="button" data-today-status="F" data-participant-id="${participant.id}" ${editable ? "" : "disabled"}>실패</button>
            <button class="status-P" type="button" data-today-status="P" data-participant-id="${participant.id}" ${editable ? "" : "disabled"}>패스</button>
            <button class="memo-button" type="button" data-open-memo data-participant-id="${participant.id}" ${editable ? "" : "disabled"}>메모</button>
          </div>
          <p class="memo-preview">${note}</p>
        </article>
      `;
    })
    .join("");
}

function getMissionExtra(participantId, date) {
  if (participantId !== "jaeseon") return "";
  const week = getJaeseonWeeklyGymStats(date);
  return `<div class="sub-info"><span>이번 주 헬스장 방문 ${week.count} / 3회</span><span>${week.count >= 3 ? "주간 헬스장 목표 달성" : "진행 중"}</span></div>`;
}

function renderRecordGrid() {
  if (!els.recordGrid) return;
  const dates = getDateRange(DISPLAY_START_DATE, END_DATE);
  const header = `<div class="grid-name">이름</div>${dates
    .map((date) => `<div class="grid-day">${Number(date.slice(8))}<span>${getWeekday(date)}</span></div>`)
    .join("")}`;

  const rows = participants
    .map((participant) => {
      const cells = dates
        .map((date) => {
          if (!isWithinPeriod(date)) {
            return `
              <div class="grid-cell is-invalid">
                <button
                  type="button"
                  disabled
                  aria-label="${participant.name} ${date} 시작 전"
                >시작 전</button>
              </div>
            `;
          }

          const record = getEffectiveRecord(date, participant.id);
          const status = getDisplayStatus(record);
          const statusInfo = statusMeta[status] || { label: "미입력", badge: "badge-empty" };
          const stateClass = getCellStateClass(date, participant.id, record);
          const noteClass = record.note ? "has-note" : "";
          return `
            <div class="grid-cell ${stateClass} ${noteClass}">
              <button
                type="button"
                data-grid-date="${date}"
                data-participant-id="${participant.id}"
                ${isFutureDate(date) ? "disabled" : ""}
                aria-label="${participant.name} ${date} ${statusInfo.label}"
              >${status === "" ? "" : statusMeta[status].label.slice(0, 1)}</button>
            </div>
          `;
        })
        .join("");
      return `<div class="grid-name">${participant.name}</div>${cells}`;
    })
    .join("");

  els.recordGrid.innerHTML = `<div class="record-grid">${header}${rows}</div>`;
}

function getCellStateClass(date, participantId, record) {
  const status = getDisplayStatus(record);
  const classes = [];
  if (date === getTodayString()) classes.push("is-today");
  if (isFutureDate(date)) classes.push("is-future");
  if (isLockedDate(date)) classes.push("is-locked");
  if (status === "A") classes.push("is-absent");
  if (status && status !== "A") classes.push(`status-${status}`);
  if (isAutoPassDate(date, participantId)) classes.push("is-locked");
  return classes.join(" ");
}

function renderRankings() {
  if (!els.rankingList) return;
  const rankings = participants
    .map((participant) => ({ participant, stats: getParticipantStats(participant.id) }))
    .sort((a, b) => {
      if (b.stats.successRate !== a.stats.successRate) return b.stats.successRate - a.stats.successRate;
      if (b.stats.S !== a.stats.S) return b.stats.S - a.stats.S;
      if (a.stats.A !== b.stats.A) return a.stats.A - b.stats.A;
      return a.stats.fine - b.stats.fine;
    });

  const teamFine = rankings.reduce((sum, item) => sum + item.stats.fine, 0);
  if (els.teamFineText) els.teamFineText.textContent = formatMoney(teamFine);

  els.rankingList.innerHTML = rankings
    .map(
      (item, index) => `
        <article class="ranking-card">
          <div class="rank-top">
            <div class="card-top">
              <span class="rank-number">${index + 1}</span>
              <div>
                <h3>${item.participant.name}</h3>
                <p class="fine-detail">성공률 ${item.stats.successRate}% · 누적 벌금 ${formatMoney(item.stats.fine)}</p>
              </div>
            </div>
          </div>
          <div class="metrics">
            <div class="metric"><span>성공</span><strong>${item.stats.S}</strong></div>
            <div class="metric"><span>실패</span><strong>${item.stats.F}</strong></div>
            <div class="metric"><span>무단</span><strong>${item.stats.A}</strong></div>
            <div class="metric"><span>패스</span><strong>${item.stats.P}</strong></div>
          </div>
        </article>
      `,
    )
    .join("");
}

function handleGridClick(participantId, date) {
  if (!isWithinPeriod(date)) return;
  if (isFutureDate(date)) return;
  if (isEditableDate(date) && !isAutoPassDate(date, participantId)) {
    openEditor(participantId, date);
    return;
  }
  showToast("이미 마감된 기록입니다.");
}

function openEditor(participantId, date, presetStatus) {
  if (!isEditableDate(date) || !isWithinPeriod(date)) {
    showToast("이미 마감된 기록입니다.");
    return;
  }
  const participant = getParticipant(participantId);
  const savedRecord = records[getKey(date, participantId)];
  editorState = {
    date,
    participantId,
    status: presetStatus || savedRecord?.status || "",
    note: savedRecord?.note || "",
    gymVisit: participantId === "jaeseon" ? Boolean(savedRecord?.gymVisit) : false,
  };

  els.editorDateText.textContent = formatKoreanDate(date);
  els.editorTitle.textContent = `${participant.name} 기록 편집`;
  els.editorGoalText.textContent = participant.goal;
  els.noteInput.placeholder = `오늘의 수행 내용이나 사유를 입력하세요\n${participant.memo}`;
  els.noteInput.value = editorState.note;
  els.noteCounter.textContent = `${editorState.note.length} / 200`;
  els.gymVisitInput.checked = editorState.gymVisit;
  els.gymVisitField.classList.toggle("is-hidden", participantId !== "jaeseon");
  renderEditorStatusButtons();
  els.editorOverlay.classList.remove("is-hidden");
}

function renderEditorStatusButtons() {
  document.querySelectorAll("[data-editor-status]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.editorStatus === editorState?.status);
  });
}

function closeEditor() {
  editorState = null;
  els.editorOverlay.classList.add("is-hidden");
}

async function saveEditorRecord() {
  if (!editorState?.status) {
    showToast("성공, 실패, 패스 중 하나를 선택하세요.");
    return;
  }
  const participant = getParticipant(editorState.participantId);
  const record = {
    date: editorState.date,
    participantId: participant.id,
    participantName: participant.name,
    status: editorState.status,
    note: els.noteInput.value.trim().slice(0, 200),
    gymVisit: participant.id === "jaeseon" ? Boolean(els.gymVisitInput.checked) : false,
    updatedAt: new Date().toISOString(),
  };

  try {
    await saveRecord(record);
    closeEditor();
    showToast("기록이 저장되었습니다.");
  } catch (error) {
    console.error(error);
    records[getKey(record.date, record.participantId)] = record;
    writeLocalRecords(STORAGE_KEY, records);
    writeLocalRecords(PENDING_KEY, { ...readLocalRecords(PENDING_KEY), [getKey(record.date, record.participantId)]: record });
    setSyncError();
    closeEditor();
    render();
    showToast("서버 연결 실패, 이 기기에 임시 저장했습니다.");
  }
}

async function deleteEditorRecord() {
  if (!editorState) return;
  const key = getKey(editorState.date, editorState.participantId);
  try {
    if (getSyncUrl()) {
      await postToServer({ action: "delete", date: editorState.date, participantId: editorState.participantId });
      await refreshFromServer({ silent: true });
    } else {
      delete records[key];
      writeLocalRecords(STORAGE_KEY, records);
    }
    closeEditor();
    render();
    showToast("기록을 비웠습니다.");
  } catch (error) {
    console.error(error);
    setSyncError();
    showToast("기록 비우기에 실패했습니다.");
  }
}

async function saveRecord(record) {
  const key = getKey(record.date, record.participantId);
  if (!getSyncUrl()) {
    records[key] = record;
    writeLocalRecords(STORAGE_KEY, records);
    render();
    return;
  }

  const payload = { action: "save", ...record };
  console.log("저장 요청", payload);
  const result = await postToServer(payload);
  console.log("서버 응답", result);
  if (!result.ok) throw new Error(result.error || "Server save failed");

  const serverRecords = await fetchServerRecords();
  if (!serverRecords[key]) {
    throw new Error("Server save verification failed");
  }
  records = serverRecords;
  writeLocalRecords(STORAGE_KEY, records);
  renderSyncStatus();
  render();
}

async function refreshFromServer({ silent }) {
  if (!getSyncUrl()) {
    renderSyncStatus();
    if (!silent) showToast("이 기기에만 저장 중입니다.");
    return;
  }

  try {
    await flushPendingRecords();
    records = await fetchServerRecords();
    writeLocalRecords(STORAGE_KEY, records);
    renderSyncStatus();
    render();
    if (!silent) showToast("최신 기록을 불러왔습니다.");
  } catch (error) {
    console.error(error);
    records = { ...readLocalRecords(STORAGE_KEY), ...readLocalRecords(PENDING_KEY) };
    setSyncError();
    render();
    if (!silent) showToast("서버 연결 실패, 이 기기 기록을 유지합니다.");
  }
}

async function flushPendingRecords() {
  const pending = readLocalRecords(PENDING_KEY);
  const keys = Object.keys(pending);
  for (const key of keys) {
    const payload = { action: "save", ...pending[key] };
    console.log("저장 요청", payload);
    const result = await postToServer(payload);
    console.log("서버 응답", result);
    if (!result.ok) throw new Error(result.error || "Pending save failed");
    delete pending[key];
  }
  writeLocalRecords(PENDING_KEY, pending);
}

async function fetchServerRecords() {
  const url = `${getSyncUrl()}${getSyncUrl().includes("?") ? "&" : "?"}action=list&t=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  const rawRecords = Array.isArray(result.records) ? result.records : Array.isArray(result.data) ? result.data : null;
  if (!response.ok || !result.ok || !Array.isArray(rawRecords)) {
    throw new Error(result.error || "Server records load failed");
  }
  const normalized = normalizeRecords(rawRecords);
  console.log("서버에서 불러온 원본 기록", rawRecords);
  console.log("정규화된 기록", normalized);
  return normalized;
}

async function postToServer(payload) {
  const response = await fetch(getSyncUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Server request failed");
  }
  return result;
}

function normalizeRecords(rawRecords) {
  const normalized = {};
  if (!Array.isArray(rawRecords)) return normalized;
  for (const raw of rawRecords) {
    const record = normalizeRecord(raw);
    if (!record) continue;
    normalized[getKey(record.date, record.participantId)] = record;
  }
  return normalized;
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date || "").trim();
  const participantId = String(raw.participantId || "").trim();
  const participant = getParticipant(participantId);
  const status = String(raw.status || "").trim();
  if (!isWithinPeriod(date) || !participant || !["S", "F", "P"].includes(status)) return null;
  return {
    date,
    participantId,
    participantName: participant.name,
    status,
    note: String(raw.note || "").slice(0, 200),
    gymVisit: participantId === "jaeseon" ? Boolean(raw.gymVisit) : false,
    updatedAt: String(raw.updatedAt || ""),
  };
}

function getEffectiveRecord(date, participantId) {
  if (!isWithinPeriod(date)) {
    return {
      date,
      participantId,
      participantName: getParticipant(participantId).name,
      status: "",
      note: "",
      gymVisit: false,
      updatedAt: "",
      invalid: true,
    };
  }

  const saved = records[getKey(date, participantId)];
  if (saved) return saved;
  if (isAutoPassDate(date, participantId)) {
    const participant = getParticipant(participantId);
    return {
      date,
      participantId,
      participantName: participant.name,
      status: "P",
      note: "",
      gymVisit: false,
      updatedAt: "",
      autoPass: true,
    };
  }
  if (isLockedDate(date) && !isFutureDate(date)) {
    const participant = getParticipant(participantId);
    return {
      date,
      participantId,
      participantName: participant.name,
      status: "A",
      note: "",
      gymVisit: false,
      updatedAt: "",
      absent: true,
    };
  }
  return {
    date,
    participantId,
    participantName: getParticipant(participantId).name,
    status: "",
    note: "",
    gymVisit: false,
    updatedAt: "",
  };
}

function getDisplayStatus(record) {
  return record.status || "";
}

function getParticipantStats(participantId) {
  const stats = { S: 0, F: 0, P: 0, A: 0, fine: 0, successRate: 0 };
  for (const date of getDateRange(START_DATE, END_DATE)) {
    if (isFutureDate(date)) continue;
    const record = getEffectiveRecord(date, participantId);
    const status = getDisplayStatus(record);
    if (!status) continue;
    if (record.autoPass) continue;
    stats[status] += 1;
    stats.fine += statusMeta[status]?.fine || 0;
  }
  const denominator = stats.S + stats.F + stats.A;
  stats.successRate = denominator === 0 ? 0 : Math.round((stats.S / denominator) * 100);
  return stats;
}

function getSuccessStreak(participantId, baseDate) {
  let count = 0;
  let cursor = baseDate;
  while (cursor >= START_DATE) {
    const record = getEffectiveRecord(cursor, participantId);
    if (record.autoPass) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (record.status !== "S") break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function getJaeseonWeeklyGymStats(date) {
  const weekStart = maxDate(getWeekStart(date), START_DATE);
  const weekEnd = minDate(addDays(weekStart, 6), END_DATE);
  let count = 0;
  for (const day of getDateRange(weekStart, weekEnd)) {
    if (isFutureDate(day)) continue;
    const record = records[getKey(day, "jaeseon")];
    if (record?.status === "S" && record.gymVisit) count += 1;
  }
  return { count, weekStart, weekEnd };
}

function isAutoPassDate(date, participantId) {
  return isWithinPeriod(date) && participantId === "geundo" && isWeekend(date);
}

function isEditableDate(date) {
  return date === getTodayString();
}

function isLockedDate(date) {
  return date < getTodayString();
}

function isFutureDate(date) {
  return date > getTodayString();
}

function isWithinPeriod(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= START_DATE && date <= END_DATE;
}

function getTodayString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDdayText(today) {
  if (today < START_DATE) return `D-${diffDays(today, START_DATE)}`;
  if (today > END_DATE) return "종료";
  return `D+${diffDays(START_DATE, today) + 1}`;
}

function parseDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateString(dateObject) {
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, "0");
  const day = String(dateObject.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = parseDate(date);
  next.setDate(next.getDate() + amount);
  return toDateString(next);
}

function diffDays(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 86400000);
}

function getDateRange(start, end) {
  const dates = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function getWeekday(date) {
  return ["일", "월", "화", "수", "목", "금", "토"][parseDate(date).getDay()];
}

function isWeekend(date) {
  const day = parseDate(date).getDay();
  return day === 0 || day === 6;
}

function getWeekStart(date) {
  const value = parseDate(date);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateString(value);
}

function minDate(left, right) {
  return left < right ? left : right;
}

function maxDate(left, right) {
  return left > right ? left : right;
}

function getParticipant(participantId) {
  return participants.find((participant) => participant.id === participantId);
}

function getKey(date, participantId) {
  return `${date}_${participantId}`;
}

function getSyncUrl() {
  return String(CONFIG.syncUrl || "").trim();
}

function readLocalRecords(key) {
  try {
    return normalizeRecords(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch (error) {
    console.error(error);
    return {};
  }
}

function writeLocalRecords(key, value) {
  localStorage.setItem(key, JSON.stringify(Object.values(value)));
}

function exportJson() {
  const blob = new Blob([JSON.stringify(Object.values(records), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "team-challenge-2026-september-records.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = normalizeRecords(JSON.parse(String(reader.result || "[]")));
      records = { ...records, ...imported };
      writeLocalRecords(STORAGE_KEY, records);
      render();
      showToast("JSON 기록을 불러왔습니다.");
    } catch (error) {
      console.error(error);
      showToast("JSON 파일을 불러오지 못했습니다.");
    }
  });
  reader.readAsText(file);
  event.target.value = "";
}

function clearLocalRecords() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  records = {};
  render();
  showToast("이 기기의 로컬 기록을 초기화했습니다.");
}

function formatKoreanDate(date) {
  return `${date} ${getWeekday(date)}요일`;
}

function formatMoney(value) {
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function collapseWhitespace(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 42 ? `${text.slice(0, 41)}…` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("is-hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.add("is-hidden");
  }, 2400);
}
