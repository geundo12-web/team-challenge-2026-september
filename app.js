(function () {
  "use strict";

  const START_DATE = "2026-07-25";
  const END_DATE = "2026-08-25";
  const STORAGE_KEY = "team-challenge-2026.records.v1";
  const OUTBOX_KEY = "team-challenge-2026.outbox.v1";
  const VALID_STATUSES = new Set(["S", "F", "P"]);
  const STATUS_LABELS = { S: "성공", F: "실패", P: "패스", U: "무단" };
  const STATUS_SYMBOLS = { S: "✓", F: "×", P: "—", U: "!" };
  const PARTICIPANTS = [
    {
      id: "geunje",
      name: "근제",
      challenge: "매달리기 30초 + 푸쉬업/스쿼트 60개",
      shortChallenge: "매달리기 30초 + 푸쉬업/스쿼트 60개"
    },
    {
      id: "mingyeong",
      name: "민경",
      challenge: "루틴 운동",
      shortChallenge: "루틴 운동"
    },
    {
      id: "jaeseon",
      name: "재선",
      challenge: "16시간 간헐적 단식",
      shortChallenge: "16시간 간헐적 단식"
    },
    {
      id: "geundo",
      name: "근도",
      challenge: "평일 주 3회 러닝",
      shortChallenge: "평일 주 3회 러닝"
    }
  ];
  const PARTICIPANT_BY_ID = Object.fromEntries(PARTICIPANTS.map((person) => [person.id, person]));
  const ALL_DATES = buildDateRange(START_DATE, END_DATE);

  let records = loadRecordMap();
  let outbox = loadOutbox();
  let editing = null;
  let dialogStatus = "";
  let saveBusy = false;
  let toastTimer = null;
  let pollTimer = null;

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    renderAll();
    scrollTodayIntoView();

    if (getSyncUrl()) {
      setSyncState("connecting");
      syncFromServer({ silent: true });
      pollTimer = window.setInterval(() => {
        if (!isEditorOpen()) syncFromServer({ silent: true });
      }, 30000);
    } else {
      setSyncState("local");
    }
  }

  function cacheElements() {
    [
      "dday", "syncStatus", "syncStatusText", "todayLabel", "todayProgress", "missionList",
      "recordTable", "tableScroll", "rankingList", "weeklyPanel", "exportButton", "importButton",
      "resetButton", "importFile", "recordDialog", "recordForm", "dialogDate", "dialogTitle",
      "dialogChallenge", "dialogStatusButtons", "noteInput", "noteCount", "clearRecordButton",
      "dialogDone", "dialogClose", "toast"
    ].forEach((id) => { elements[id] = document.getElementById(id); });
  }

  function bindEvents() {
    elements.missionList.addEventListener("click", onMissionClick);
    elements.recordTable.addEventListener("click", onTableClick);
    elements.dialogStatusButtons.addEventListener("click", onDialogStatusClick);
    elements.noteInput.addEventListener("input", updateNoteCount);
    elements.recordForm.addEventListener("submit", saveDialogRecord);
    elements.clearRecordButton.addEventListener("click", clearDialogRecord);
    elements.dialogClose.addEventListener("click", closeEditor);
    elements.recordDialog.addEventListener("click", (event) => {
      if (event.target === elements.recordDialog) closeEditor();
    });
    elements.exportButton.addEventListener("click", exportRecords);
    elements.importButton.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", importRecords);
    elements.resetButton.addEventListener("click", resetLocalData);
    window.addEventListener("online", () => {
      if (getSyncUrl()) syncFromServer({ silent: true });
    });
    window.addEventListener("beforeunload", () => {
      if (pollTimer) window.clearInterval(pollTimer);
    });
  }

  function renderAll() {
    renderHeader();
    renderTodayCards();
    renderRecordTable();
    renderStats();
  }

  function renderHeader() {
    const today = getKstToday();
    elements.todayLabel.textContent = `${formatKoreanDate(today)} · 오늘`;
    if (compareDates(today, START_DATE) < 0) {
      elements.dday.textContent = `시작 D-${daysBetween(today, START_DATE)}`;
    } else if (compareDates(today, END_DATE) > 0) {
      elements.dday.textContent = "종료";
    } else {
      const remaining = daysBetween(today, END_DATE);
      elements.dday.textContent = remaining === 0 ? "D-DAY" : `D-${remaining}`;
    }
  }

  function renderTodayCards() {
    const today = getKstToday();
      const editable = isWithinChallenge(today) && !saveBusy;
    let recordedCount = 0;

    const html = PARTICIPANTS.map((person) => {
      const explicitRecord = getRecord(today, person.id);
      const status = getDisplayStatus(today, person.id);
      if (status) recordedCount += 1;
      const streak = calculateStreak(person.id, today);
      const note = explicitRecord ? explicitRecord.note : "";
      const weekly = person.id === "geundo" ? getWeekSummaryForDate(today) : null;
      const autoPass = person.id === "geundo" && isWeekend(today) && !explicitRecord;

      return `
        <article class="mission-card">
          <div class="mission-card__top">
            <div class="mission-card__person">
              <span class="avatar" aria-hidden="true">${escapeHtml(person.name.slice(0, 1))}</span>
              <div>
                <h3>${escapeHtml(person.name)}</h3>
                <p class="mission-card__challenge">${escapeHtml(person.shortChallenge)}</p>
              </div>
            </div>
            <div class="streak"><strong>${streak}</strong>연속 성공일</div>
          </div>
          ${weekly ? `
            <div class="weekly-mini">
              <span>이번 주 ${weekly.successCount} / 3회</span>
              <span class="${weekly.successCount >= 3 ? "weekly-mini__done" : ""}">${weekly.successCount >= 3 ? "주간 목표 달성" : "진행 중"}</span>
            </div>` : ""}
          <div class="status-actions" aria-label="${escapeHtml(person.name)} 오늘의 상태">
            ${renderTodayStatusButton(person.id, "S", status, editable, autoPass)}
            ${renderTodayStatusButton(person.id, "F", status, editable, autoPass)}
            ${renderTodayStatusButton(person.id, "P", status, editable, autoPass)}
            <button type="button" class="memo-button ${note ? "has-note" : ""}" data-action="memo" data-participant-id="${person.id}" ${editable ? "" : "disabled"} aria-label="${escapeHtml(person.name)} 메모 편집">메모</button>
          </div>
          ${note ? `<p class="memo-summary">${escapeHtml(note)}</p>` : ""}
        </article>`;
    }).join("");

    elements.missionList.innerHTML = html;
    elements.todayProgress.textContent = `${recordedCount} / 4 기록`;
  }

  function renderTodayStatusButton(participantId, buttonStatus, currentStatus, editable, autoPass) {
    const isSelected = currentStatus === buttonStatus;
    const autoLabel = autoPass && buttonStatus === "P" ? " (주말 자동 패스)" : "";
    return `<button type="button" class="status-button ${isSelected ? "is-selected" : ""}" data-action="status" data-participant-id="${participantId}" data-status="${buttonStatus}" ${editable ? "" : "disabled"} aria-pressed="${isSelected}" aria-label="${STATUS_LABELS[buttonStatus]}${autoLabel}">${STATUS_LABELS[buttonStatus]}</button>`;
  }

  function renderRecordTable() {
    const today = getKstToday();
    const headCells = ALL_DATES.map((date) => {
      const weekend = isWeekend(date);
      const isToday = date === today;
      return `<th scope="col" class="date-head ${weekend ? "is-weekend-head" : ""} ${isToday ? "is-today-head" : ""}" data-date-head="${date}"><span>${Number(date.slice(8, 10))}</span><small>${getWeekdayLabel(date)}</small></th>`;
    }).join("");

    const bodyRows = PARTICIPANTS.map((person) => {
      const cells = ALL_DATES.map((date) => {
        const explicitRecord = getRecord(date, person.id);
        const displayStatus = getDisplayStatus(date, person.id);
        const isFuture = compareDates(date, today) > 0;
        const weekend = isWeekend(date);
        const isToday = date === today;
        const symbol = isFuture ? "" : (STATUS_SYMBOLS[displayStatus] || "·");
        const stateClass = isFuture ? "cell-button--future" : (displayStatus ? `cell-button--${displayStatus}` : "");
        const stateLabel = isFuture ? "미래 날짜, 수정 불가" : (STATUS_LABELS[displayStatus] || (isToday ? "오늘 미입력" : "미입력"));
        return `<td class="record-cell ${weekend ? "is-weekend" : ""} ${isToday ? "is-today" : ""}">
          <button type="button" class="cell-button ${stateClass}" data-date="${date}" data-participant-id="${person.id}" ${isFuture ? "disabled" : ""} aria-label="${formatKoreanDate(date)} ${escapeHtml(person.name)} ${stateLabel}">${symbol}</button>
          ${explicitRecord && explicitRecord.note ? '<span class="note-dot" aria-hidden="true"></span>' : ""}
        </td>`;
      }).join("");
      return `<tr><th scope="row" class="name-cell">${escapeHtml(person.name)}</th>${cells}</tr>`;
    }).join("");

    elements.recordTable.innerHTML = `<thead><tr><th class="name-cell" scope="col">이름</th>${headCells}</tr></thead><tbody>${bodyRows}</tbody>`;
  }

  function renderStats() {
    const stats = PARTICIPANTS.map((person) => ({ person, ...calculateStats(person.id) }));
    stats.sort((a, b) => b.successRate - a.successRate || b.success - a.success || a.absent - b.absent || a.person.name.localeCompare(b.person.name, "ko"));

    elements.rankingList.innerHTML = stats.map((item, index) => `
      <div class="rank-row">
        <span class="rank-number">${index + 1}</span>
        <div class="rank-person"><strong>${escapeHtml(item.person.name)}</strong><small>연속 ${item.streak}일</small></div>
        <div class="rank-counts">성공 ${item.success} · 실패 ${item.fail}<br>패스 ${item.pass} · 무단 ${item.absent}</div>
        <div class="rank-rate">${formatRate(item.successRate)}%</div>
      </div>`).join("");

    const weeks = buildChallengeWeeks();
    elements.weeklyPanel.innerHTML = `
      <h3>근도 · 주별 러닝 현황</h3>
      <div class="week-grid">
        ${weeks.map((week, index) => {
          const status = getWeeklyGoalStatus(week);
          const statusClass = status === "주간 목표 달성" ? "week-card__status--done" : (status === "미달성" ? "week-card__status--missed" : "");
          return `<div class="week-card">
            <div class="week-card__top"><span>${index + 1}주차</span><span>${formatShortDate(week.start)}–${formatShortDate(week.end)}</span></div>
            <strong>${week.successCount} / 3회</strong>
            <span class="week-card__status ${statusClass}">${status}</span>
          </div>`;
        }).join("")}
      </div>`;
  }

  function onMissionClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled || saveBusy) return;
    const participantId = button.dataset.participantId;
    const today = getKstToday();

    if (button.dataset.action === "memo") {
      openEditor(today, participantId);
      return;
    }

    const chosenStatus = button.dataset.status;
    const existing = getRecord(today, participantId);
    const explicitStatus = existing ? existing.status : "";
    const nextStatus = explicitStatus === chosenStatus ? "" : chosenStatus;
    commitRecord(today, participantId, nextStatus, existing ? existing.note : "", { quietSuccess: true });
  }

  function onTableClick(event) {
    const button = event.target.closest("button[data-date][data-participant-id]");
    if (!button || button.disabled) return;
    openEditor(button.dataset.date, button.dataset.participantId);
  }

  function openEditor(date, participantId) {
    const person = PARTICIPANT_BY_ID[participantId];
    if (!person || !isWithinChallenge(date) || compareDates(date, getKstToday()) > 0) return;
    const record = getRecord(date, participantId);
    editing = { date, participantId };
    dialogStatus = record ? record.status : "";
    elements.dialogDate.textContent = `${formatKoreanDate(date)} · ${getWeekdayLabel(date)}요일`;
    elements.dialogTitle.textContent = `${person.name} 기록`;
    elements.dialogChallenge.textContent = person.challenge;
    elements.noteInput.value = record ? record.note : "";
    updateDialogStatusButtons();
    updateNoteCount();
    elements.recordDialog.showModal();
    window.setTimeout(() => elements.noteInput.focus(), 40);
  }

  function closeEditor() {
    if (elements.recordDialog.open) elements.recordDialog.close();
    editing = null;
    dialogStatus = "";
  }

  function onDialogStatusClick(event) {
    const button = event.target.closest("button[data-dialog-status]");
    if (!button) return;
    const chosen = button.dataset.dialogStatus;
    dialogStatus = dialogStatus === chosen ? "" : chosen;
    updateDialogStatusButtons();
  }

  function updateDialogStatusButtons() {
    elements.dialogStatusButtons.querySelectorAll("button[data-dialog-status]").forEach((button) => {
      const selected = button.dataset.dialogStatus === dialogStatus;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function updateNoteCount() {
    elements.noteCount.textContent = `${elements.noteInput.value.length} / 200`;
  }

  async function saveDialogRecord(event) {
    event.preventDefault();
    if (!editing || saveBusy) return;
    const note = elements.noteInput.value.trim();
    if (note.length > 200) {
      showToast("메모는 200자 이하로 입력해주세요.");
      return;
    }
    const target = { ...editing, status: dialogStatus };
    closeEditor();
    await commitRecord(target.date, target.participantId, target.status, note);
  }

  async function clearDialogRecord() {
    if (!editing || saveBusy) return;
    const target = { ...editing };
    closeEditor();
    await commitRecord(target.date, target.participantId, "", "");
  }

  async function commitRecord(date, participantId, status, note, options = {}) {
    if (saveBusy) return;
    const person = PARTICIPANT_BY_ID[participantId];
    const cleanNote = String(note || "").trim();

    if (!person || !isWithinChallenge(date) || compareDates(date, getKstToday()) > 0) {
      showToast("이 날짜에는 기록할 수 없습니다.");
      return;
    }
    if (status && !VALID_STATUSES.has(status)) {
      showToast("허용되지 않은 상태입니다.");
      return;
    }
    if (cleanNote.length > 200) {
      showToast("메모는 200자 이하로 입력해주세요.");
      return;
    }

    saveBusy = true;
    renderTodayCards();
    try {
      const updatedAt = new Date().toISOString();
      const record = {
        date,
        participantId,
        participantName: person.name,
        status: status || "",
        note: cleanNote,
        updatedAt
      };
      const key = makeKey(date, participantId);
      if (!record.status && !record.note) {
        delete records[key];
      } else {
        records[key] = record;
      }
      outbox[key] = { ...record, action: "save" };
      persistState();
      renderAll();

      if (!getSyncUrl()) {
        setSyncState("local");
        if (!options.quietSuccess) showToast("이 기기에 기록했어요.");
        return;
      }

      const saved = await postRecord(outbox[key]);
      if (outbox[key] && outbox[key].updatedAt === updatedAt) {
        delete outbox[key];
        saveOutbox();
      }
      setSyncState("online");
      if (!options.quietSuccess) showToast(saved && saved.deleted ? "기록을 비웠어요." : "팀 기록에 저장했어요.");
    } catch (error) {
      console.error("Record save failed:", error);
      setSyncState("error");
      showToast("서버 저장에 실패했지만 이 기기에는 안전하게 보관했어요.");
    } finally {
      saveBusy = false;
      renderTodayCards();
    }
  }

  async function syncFromServer(options = {}) {
    if (!getSyncUrl() || isEditorOpen()) return;
    try {
      const response = await fetch(getSyncUrl(), { method: "GET", cache: "no-store", redirect: "follow" });
      const payload = await parseJsonResponse(response);
      if (!response.ok || payload.ok !== true) throw new Error(payload.error || `HTTP ${response.status}`);
      const incomingArray = Array.isArray(payload.records) ? payload.records : (Array.isArray(payload.data) ? payload.data : null);
      if (!incomingArray) throw new Error("서버 응답에 records 또는 data 배열이 없습니다.");

      const serverMap = {};
      incomingArray.forEach((item) => {
        const normalized = normalizeRecord(item);
        if (normalized) serverMap[makeKey(normalized.date, normalized.participantId)] = normalized;
      });

      const localKeys = Object.keys(records);
      const serverKeys = Object.keys(serverMap);
      if (serverKeys.length > 0 || localKeys.length === 0) {
        const merged = { ...serverMap };
        Object.keys(outbox).forEach((key) => {
          if (records[key]) merged[key] = records[key];
          else delete merged[key];
        });
        records = merged;
        saveRecordMap();
        renderAll();
      }

      setSyncState("online");
      await flushOutbox();
    } catch (error) {
      console.error("Server sync failed:", error);
      setSyncState("error");
      if (!options.silent) showToast("서버 기록을 불러오지 못해 로컬 기록을 사용합니다.");
    }
  }

  async function flushOutbox() {
    const entries = Object.entries(outbox);
    for (const [key, pending] of entries) {
      const sentVersion = pending.updatedAt;
      try {
        await postRecord(pending);
        if (outbox[key] && outbox[key].updatedAt === sentVersion) delete outbox[key];
      } catch (error) {
        saveOutbox();
        throw error;
      }
    }
    saveOutbox();
  }

  async function postRecord(record) {
    const payload = {
      action: "save",
      date: record.date,
      participantId: record.participantId,
      participantName: record.participantName,
      status: record.status,
      note: record.note,
      updatedAt: record.updatedAt
    };
    const response = await fetch(getSyncUrl(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const result = await parseJsonResponse(response);
    if (!response.ok || result.ok !== true) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }

  async function parseJsonResponse(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("서버 응답을 JSON으로 해석할 수 없습니다.");
    }
  }

  function setSyncState(state) {
    elements.syncStatus.classList.remove("sync-status--online", "sync-status--error", "sync-status--local");
    if (state === "online") {
      elements.syncStatus.classList.add("sync-status--online");
      elements.syncStatusText.textContent = "팀 공유 켜짐 · 모든 기기 동기화";
    } else if (state === "error") {
      elements.syncStatus.classList.add("sync-status--error");
      elements.syncStatusText.textContent = "서버 연결 실패 · 이 기기에 임시 저장";
    } else if (state === "connecting") {
      elements.syncStatus.classList.add("sync-status--local");
      elements.syncStatusText.textContent = "팀 공유 연결 중…";
    } else {
      elements.syncStatus.classList.add("sync-status--local");
      elements.syncStatusText.textContent = "이 기기에만 저장 중 · 팀 공유 미설정";
    }
  }

  function getDisplayStatus(date, participantId) {
    const record = getRecord(date, participantId);
    if (record && record.status) return record.status;
    if (participantId === "geundo" && isWeekend(date)) return "P";
    if (compareDates(date, getKstToday()) < 0) return "U";
    return "";
  }

  function calculateStats(participantId) {
    const counts = { success: 0, fail: 0, pass: 0, absent: 0 };
    const today = getKstToday();
    ALL_DATES.forEach((date) => {
      if (compareDates(date, today) > 0) return;
      const status = getDisplayStatus(date, participantId);
      if (status === "S") counts.success += 1;
      if (status === "F") counts.fail += 1;
      if (status === "P") counts.pass += 1;
      if (status === "U") counts.absent += 1;
    });
    const denominator = counts.success + counts.fail + counts.absent;
    return {
      ...counts,
      successRate: denominator ? (counts.success / denominator) * 100 : 0,
      streak: calculateStreak(participantId, today)
    };
  }

  function calculateStreak(participantId, today) {
    if (compareDates(today, START_DATE) < 0) return 0;
    let cursor = compareDates(today, END_DATE) > 0 ? END_DATE : today;
    let streak = 0;
    while (compareDates(cursor, START_DATE) >= 0) {
      const status = getDisplayStatus(cursor, participantId);
      if (!status && cursor === today) {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (status === "P") {
        cursor = addDays(cursor, -1);
        continue;
      }
      if (status === "S") {
        streak += 1;
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    return streak;
  }

  function getWeekSummaryForDate(date) {
    const day = parseDateUtc(date).getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addDays(date, mondayOffset);
    const sunday = addDays(monday, 6);
    const start = maxDate(monday, START_DATE);
    const end = minDate(sunday, END_DATE);
    return makeWeekSummary(start, end);
  }

  function buildChallengeWeeks() {
    const weeks = [];
    let cursor = START_DATE;
    while (compareDates(cursor, END_DATE) <= 0) {
      const summary = getWeekSummaryForDate(cursor);
      if (!weeks.some((week) => week.start === summary.start)) weeks.push(summary);
      cursor = addDays(summary.end, 1);
    }
    return weeks;
  }

  function makeWeekSummary(start, end) {
    let successCount = 0;
    buildDateRange(start, end).forEach((date) => {
      if (!isWeekend(date) && getDisplayStatus(date, "geundo") === "S") successCount += 1;
    });
    return { start, end, successCount };
  }

  function getWeeklyGoalStatus(week) {
    if (week.successCount >= 3) return "주간 목표 달성";
    if (compareDates(week.end, getKstToday()) < 0) return "미달성";
    return "진행 중";
  }

  function exportRecords() {
    const data = {
      project: "team-challenge-2026",
      exportedAt: new Date().toISOString(),
      records: Object.values(records).sort(sortRecords)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `team-challenge-2026-backup-${getKstToday()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("JSON 백업 파일을 만들었어요.");
  }

  function importRecords(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const list = Array.isArray(parsed) ? parsed : parsed.records;
        if (!Array.isArray(list)) throw new Error("records 배열이 없습니다.");
        const imported = {};
        list.forEach((item) => {
          const normalized = normalizeRecord(item);
          if (!normalized) throw new Error("허용되지 않은 날짜, 참가자 또는 상태가 포함되어 있습니다.");
          imported[makeKey(normalized.date, normalized.participantId)] = normalized;
        });
        if (!window.confirm(`${Object.keys(imported).length}개의 기록을 이 기기에 불러올까요? 같은 날짜의 기록은 백업 내용으로 바뀝니다.`)) return;
        records = { ...records, ...imported };
        Object.entries(imported).forEach(([key, record]) => {
          outbox[key] = { ...record, action: "save", updatedAt: new Date().toISOString() };
          records[key].updatedAt = outbox[key].updatedAt;
        });
        persistState();
        renderAll();
        showToast(`${Object.keys(imported).length}개 기록을 불러왔어요.`);
        if (getSyncUrl()) {
          try {
            await flushOutbox();
            setSyncState("online");
          } catch (error) {
            console.error("Imported record sync failed:", error);
            setSyncState("error");
          }
        }
      } catch (error) {
        console.error("Import failed:", error);
        showToast(`JSON 불러오기 실패: ${error.message}`);
      }
    };
    reader.onerror = () => showToast("파일을 읽지 못했습니다.");
    reader.readAsText(file, "utf-8");
  }

  function resetLocalData() {
    const confirmed = window.confirm("이 브라우저의 로컬 기록만 지울까요? 공동 서버의 기록은 삭제되지 않습니다.");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OUTBOX_KEY);
    records = {};
    outbox = {};
    renderAll();
    showToast("이 기기의 기록만 초기화했습니다. 공동 서버 기록은 그대로예요.");
  }

  function normalizeRecord(input) {
    if (!input || typeof input !== "object") return null;
    const date = normalizeDate(input.date);
    const participantId = String(input.participantId || "").trim();
    const person = PARTICIPANT_BY_ID[participantId];
    const status = String(input.status || "").trim().toUpperCase();
    const note = String(input.note || "").trim();
    if (!date || !isWithinChallenge(date) || !person) return null;
    if (status && !VALID_STATUSES.has(status)) return null;
    if (note.length > 200 || (!status && !note)) return null;
    return {
      date,
      participantId,
      participantName: person.name,
      status,
      note,
      updatedAt: String(input.updatedAt || new Date().toISOString())
    };
  }

  function loadRecordMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const map = {};
      const values = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      values.forEach((item) => {
        const record = normalizeRecord(item);
        if (record) map[makeKey(record.date, record.participantId)] = record;
      });
      return map;
    } catch (error) {
      console.error("Local record JSON parse failed:", error);
      window.setTimeout(() => showToast("로컬 기록을 읽지 못해 빈 기록판으로 시작합니다."), 0);
      return {};
    }
  }

  function loadOutbox() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.error("Outbox JSON parse failed:", error);
      return {};
    }
  }

  function persistState() {
    saveRecordMap();
    saveOutbox();
  }

  function saveRecordMap() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function saveOutbox() {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  }

  function getRecord(date, participantId) {
    return records[makeKey(date, participantId)] || null;
  }

  function makeKey(date, participantId) {
    return `${date}::${participantId}`;
  }

  function getSyncUrl() {
    return String((window.CONFIG && window.CONFIG.syncUrl) || "").trim();
  }

  function isEditorOpen() {
    return Boolean(elements.recordDialog && elements.recordDialog.open);
  }

  function getKstToday(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return getKstToday(value);
    }
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const normalized = `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = parseDateUtc(normalized);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized ? "" : normalized;
  }

  function parseDateUtc(date) {
    return new Date(`${date}T12:00:00Z`);
  }

  function buildDateRange(start, end) {
    const dates = [];
    let cursor = start;
    while (compareDates(cursor, end) <= 0) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return dates;
  }

  function addDays(date, amount) {
    const parsed = parseDateUtc(date);
    parsed.setUTCDate(parsed.getUTCDate() + amount);
    return parsed.toISOString().slice(0, 10);
  }

  function daysBetween(from, to) {
    return Math.round((parseDateUtc(to) - parseDateUtc(from)) / 86400000);
  }

  function compareDates(a, b) {
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  function minDate(a, b) { return compareDates(a, b) <= 0 ? a : b; }
  function maxDate(a, b) { return compareDates(a, b) >= 0 ? a : b; }

  function isWithinChallenge(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && compareDates(date, START_DATE) >= 0 && compareDates(date, END_DATE) <= 0;
  }

  function isWeekend(date) {
    const day = parseDateUtc(date).getUTCDay();
    return day === 0 || day === 6;
  }

  function getWeekdayLabel(date) {
    return ["일", "월", "화", "수", "목", "금", "토"][parseDateUtc(date).getUTCDay()];
  }

  function formatKoreanDate(date) {
    return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
  }

  function formatShortDate(date) {
    return `${Number(date.slice(5, 7))}.${String(Number(date.slice(8, 10))).padStart(2, "0")}`;
  }

  function formatRate(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function sortRecords(a, b) {
    return a.date.localeCompare(b.date) || a.participantId.localeCompare(b.participantId);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function scrollTodayIntoView() {
    window.setTimeout(() => {
      const todayHead = elements.recordTable.querySelector(`[data-date-head="${getKstToday()}"]`);
      if (todayHead) elements.tableScroll.scrollLeft = Math.max(0, todayHead.offsetLeft - 130);
    }, 0);
  }

  function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 3000);
  }
})();
