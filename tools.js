const $ = (selector) => document.querySelector(selector);

export function initMersalTools({ supabase, getCurrentUser, announce, safeText }) {
  const home = $("#tools-home-view");
  const detail = $("#tool-detail-view");
  const title = $("#tool-detail-title");
  const back = $("#tool-back-button");
  const panels = ["calculator", "notes", "qr", "polls"].map((name) => $("#" + name + "-tool"));
  let activeTool = null;
  let returnFocus = null;

  function openTool(name) {
    const labels = {
      calculator: "الآلة الحاسبة",
      notes: "المفكرة السريعة",
      qr: "إنشاء رموز QR",
      polls: "استطلاعات الرأي"
    };
    if (!labels[name]) return;
    activeTool = name;
    returnFocus = document.activeElement;
    home.hidden = true;
    detail.hidden = false;
    panels.forEach((panel) => { panel.hidden = panel.id !== name + "-tool"; });
    title.textContent = labels[name];
    document.body.classList.add("tools-detail-open");
    title.focus();
    if (name === "notes") loadNotes();
    if (name === "polls") void loadPollGroups();
    if (name === "calculator") renderCalculator();
  }

  function closeTool() {
    activeTool = null;
    detail.hidden = true;
    home.hidden = false;
    document.body.classList.remove("tools-detail-open");
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }

  document.querySelectorAll(".tool-launch-button").forEach((button) => {
    button.addEventListener("click", () => openTool(button.dataset.tool));
  });
  back.addEventListener("click", closeTool);
  detail.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTool();
    }
  });

  // Calculator: a small parser is used instead of eval or Function.
  const calculatorDisplay = $("#calculator-display");
  let expression = "";
  let hasResult = false;

  function evaluate(source) {
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+*/%()-]/g) || [];
    if (tokens.join("") !== source.replace(/\s+/g, "")) throw new Error("invalid");
    let index = 0;
    function primary() {
      let sign = 1;
      while (tokens[index] === "+" || tokens[index] === "-") {
        if (tokens[index++] === "-") sign *= -1;
      }
      const token = tokens[index++];
      if (!token || (!/^\d/.test(token) && !/^\.\d/.test(token))) throw new Error("invalid");
      let value = sign * Number(token);
      while (tokens[index] === "%") { index++; value /= 100; }
      return value;
    }
    function term() {
      let value = primary();
      while (tokens[index] === "*" || tokens[index] === "/") {
        const operator = tokens[index++];
        const right = primary();
        if (operator === "/" && right === 0) throw new Error("zero");
        value = operator === "*" ? value * right : value / right;
      }
      return value;
    }
    function sum() {
      let value = term();
      while (tokens[index] === "+" || tokens[index] === "-") {
        const operator = tokens[index++];
        const right = term();
        value = operator === "+" ? value + right : value - right;
      }
      return value;
    }
    const result = sum();
    if (index !== tokens.length || !Number.isFinite(result)) throw new Error("invalid");
    return Number(result.toPrecision(12)).toString();
  }

  function renderCalculator() {
    calculatorDisplay.textContent = expression || "0";
  }

  function calculatorInput(key) {
    if (key === "clear") { expression = ""; hasResult = false; renderCalculator(); return; }
    if (key === "backspace") { expression = expression.slice(0, -1); hasResult = false; renderCalculator(); return; }
    if (key === "equals") {
      if (!expression) return;
      try {
        expression = evaluate(expression);
        hasResult = true;
        renderCalculator();
      } catch (error) {
        calculatorDisplay.textContent = error.message === "zero" ? "لا يمكن القسمة على صفر." : "عملية حسابية غير صحيحة.";
        expression = "";
        hasResult = false;
      }
      return;
    }
    if (key === "sign") {
      const match = expression.match(/(^|[+*/-])(-?(?:\d+(?:\.\d*)?|\.\d+))$/);
      if (match) {
        const start = expression.length - match[0].length;
        const operand = match[2];
        expression = expression.slice(0, start) + match[1] + (operand.startsWith("-") ? operand.slice(1) : "-" + operand);
      } else if (!expression) expression = "-";
      renderCalculator();
      return;
    }
    if (key === "percent") {
      if (/\d$/.test(expression)) expression += "%";
      renderCalculator();
      return;
    }
    if (/^[0-9.]$/.test(key)) {
      if (hasResult) { expression = ""; hasResult = false; }
      const current = (expression.match(/(?:\d+(?:\.\d*)?|\.\d+)$/) || [""])[0];
      if (key === "." && current.includes(".")) return;
      expression += key;
      renderCalculator();
      return;
    }
    if (["+", "-", "*", "/"].includes(key)) {
      hasResult = false;
      if (!expression && key !== "-") return;
      if (/[+*/-]$/.test(expression)) expression = expression.slice(0, -1);
      expression += key;
      renderCalculator();
    }
  }

  document.querySelectorAll("[data-calc-key]").forEach((button) => {
    button.addEventListener("click", () => calculatorInput(button.dataset.calcKey));
  });
  $("#calculator-tool").addEventListener("keydown", (event) => {
    if (event.target.closest("button")) return;
    if (/^[0-9.+*/%-]$/.test(event.key)) { event.preventDefault(); calculatorInput(event.key); }
    else if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculatorInput("equals"); }
    else if (event.key === "Backspace") { event.preventDefault(); calculatorInput("backspace"); }
  });

  // Quick notes stay on this device and are separated by signed-in account.
  const noteTitle = $("#note-title-input");
  const noteBody = $("#note-body-input");
  const noteSave = $("#note-save-button");
  const noteDelete = $("#note-delete-button");
  const notesSearch = $("#notes-search-input");
  const notesList = $("#notes-list");
  let notes = [];
  let activeNoteId = null;
  let originalNote = { title: "", body: "" };

  function notesKey() { return "mersal-notes-" + (getCurrentUser()?.id || "local"); }
  function readNotes() {
    try {
      const value = JSON.parse(localStorage.getItem(notesKey()) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function updateNoteButtons() {
    const nextTitle = noteTitle.value.trim();
    const nextBody = noteBody.value.trim();
    noteSave.disabled = !(nextTitle || nextBody) || (nextTitle === originalNote.title && nextBody === originalNote.body);
    noteDelete.disabled = !activeNoteId;
  }
  function renderNotes() {
    notesList.replaceChildren();
    const query = notesSearch.value.trim().toLocaleLowerCase();
    const matches = notes.filter((note) => (note.title + " " + note.body).toLocaleLowerCase().includes(query));
    if (!matches.length) {
      notesList.append(safeText("li", "empty-item", notes.length ? "لا توجد نتائج مطابقة." : "لا توجد ملاحظات محفوظة."));
      return;
    }
    matches.forEach((note) => {
      const item = document.createElement("li");
      const button = safeText("button", "note-list-button", note.title || note.body.slice(0, 55) || "ملاحظة بدون عنوان");
      button.type = "button";
      button.setAttribute("data-no-translate", "");
      button.addEventListener("click", () => {
        if (!noteSave.disabled && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تجاهلها؟")) return;
        activeNoteId = note.id;
        noteTitle.value = note.title;
        noteBody.value = note.body;
        originalNote = { title: note.title, body: note.body };
        updateNoteButtons();
        noteTitle.focus();
      });
      item.append(button);
      notesList.append(item);
    });
  }
  function loadNotes() {
    notes = readNotes();
    activeNoteId = null;
    originalNote = { title: "", body: "" };
    noteTitle.value = "";
    noteBody.value = "";
    noteDelete.disabled = true;
    updateNoteButtons();
    renderNotes();
  }
  noteTitle.addEventListener("input", updateNoteButtons);
  noteBody.addEventListener("input", updateNoteButtons);
  notesSearch.addEventListener("input", renderNotes);
  $("#note-new-button").addEventListener("click", () => {
    if (!noteSave.disabled && !window.confirm("لديك تغييرات غير محفوظة. هل تريد تجاهلها؟")) return;
    activeNoteId = null;
    originalNote = { title: "", body: "" };
    noteTitle.value = "";
    noteBody.value = "";
    updateNoteButtons();
    noteTitle.focus();
  });
  noteSave.addEventListener("click", () => {
    const titleValue = noteTitle.value.trim();
    const bodyValue = noteBody.value.trim();
    if (!(titleValue || bodyValue)) return;
    try {
      const now = new Date().toISOString();
      if (activeNoteId) {
        const note = notes.find((item) => item.id === activeNoteId);
        if (note) Object.assign(note, { title: titleValue, body: bodyValue, updated_at: now });
      } else {
        activeNoteId = crypto.randomUUID();
        notes.unshift({ id: activeNoteId, title: titleValue, body: bodyValue, updated_at: now });
      }
      localStorage.setItem(notesKey(), JSON.stringify(notes));
      originalNote = { title: titleValue, body: bodyValue };
      updateNoteButtons();
      renderNotes();
      announce("تم حفظ الملاحظة.");
    } catch { announce("تعذر حفظ الملاحظة.", "error"); }
  });
  noteDelete.addEventListener("click", () => {
    if (!activeNoteId) return;
    notes = notes.filter((note) => note.id !== activeNoteId);
    localStorage.setItem(notesKey(), JSON.stringify(notes));
    activeNoteId = null;
    originalNote = { title: "", body: "" };
    noteTitle.value = "";
    noteBody.value = "";
    updateNoteButtons();
    renderNotes();
    announce("تم حذف الملاحظة.");
  });

  // QR generation happens locally in the browser; the content is not sent to a QR service.
  const qrInput = $("#qr-content-input");
  const qrGenerate = $("#qr-generate-button");
  const qrCanvas = $("#qr-canvas");
  const qrResult = $("#qr-result");
  const qrStatus = $("#qr-status");
  let latestQrContent = "";
  qrGenerate.addEventListener("click", async () => {
    const value = qrInput.value.trim();
    if (!value) { qrStatus.textContent = "أدخل نصًا أو رابطًا أولًا."; qrResult.hidden = true; return; }
    qrGenerate.disabled = true;
    qrStatus.textContent = "جارٍ إنشاء رمز QR…";
    try {
      const qrModule = await import("https://esm.sh/qrcode@1.5.4");
      await qrModule.default.toCanvas(qrCanvas, value, { width: 280, margin: 2, errorCorrectionLevel: "M" });
      latestQrContent = value;
      $("#qr-content-preview").textContent = value;
      $("#qr-canvas").setAttribute("aria-label", "رمز QR للمحتوى: " + value.slice(0, 100));
      qrResult.hidden = false;
      qrStatus.textContent = "تم إنشاء رمز QR.";
    } catch (error) {
      qrResult.hidden = true;
      console.error("QR generation failed:", error);
      qrStatus.textContent = "تعذر إنشاء رمز QR. حاول مرة أخرى.";
    } finally { qrGenerate.disabled = false; }
  });
  $("#qr-download-button").addEventListener("click", () => {
    if (!latestQrContent) return;
    const link = document.createElement("a");
    link.href = qrCanvas.toDataURL("image/png");
    link.download = "mersal-qr.png";
    link.click();
  });
  $("#qr-copy-button").addEventListener("click", async () => {
    if (!latestQrContent) return;
    try { await navigator.clipboard.writeText(latestQrContent); announce("تم نسخ المحتوى."); }
    catch { announce("تعذر نسخ المحتوى.", "error"); }
  });

  // Group polls are stored in Supabase and protected by group-membership RLS.
  const groupSelect = $("#poll-group-select");
  const questionInput = $("#poll-question-input");
  const optionsEditor = $("#poll-options-editor");
  const createPollButton = $("#poll-create-button");
  const pollsList = $("#polls-list");
  let groups = [];
  let optionCount = 2;

  function addOptionInput(number) {
    const label = safeText("label", "", number === 1 ? "الخيار الأول" : number === 2 ? "الخيار الثاني" : "الخيار " + number);
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 120;
    input.className = "poll-option-input";
    input.id = "poll-option-" + number;
    input.placeholder = number === 1 ? "الخيار الأول" : number === 2 ? "الخيار الثاني" : "الخيار " + number;
    label.htmlFor = input.id;
    optionsEditor.append(label, input);
  }
  function resetOptions() {
    optionsEditor.replaceChildren();
    optionCount = 2;
    addOptionInput(1);
    addOptionInput(2);
  }
  $("#poll-add-option-button").addEventListener("click", () => {
    if (optionCount >= 10) { announce("لا يمكن أن يتجاوز الاستطلاع 10 خيارات.", "error"); return; }
    optionCount += 1;
    addOptionInput(optionCount);
    $("#poll-option-" + optionCount).focus();
  });
  async function loadPollGroups() {
    const user = getCurrentUser();
    if (!user) return;
    groupSelect.disabled = true;
    createPollButton.disabled = true;
    groupSelect.replaceChildren(safeText("option", "", "جارٍ تحميل المجموعات…"));
    try {
      const { data, error } = await supabase.from("conversations")
        .select("id,group_name,created_at").eq("is_group", true).order("created_at", { ascending: false });
      if (error) throw error;
      groups = data || [];
      groupSelect.replaceChildren();
      const placeholder = safeText("option", "", "اختر مجموعة");
      placeholder.value = "";
      groupSelect.append(placeholder);
      groups.forEach((group) => {
        const option = safeText("option", "", group.group_name || "مجموعة");
        option.value = group.id;
        option.setAttribute("data-no-translate", "");
        groupSelect.append(option);
      });
      if (!groups.length) {
        groupSelect.append(safeText("option", "", "لا توجد مجموعات متاحة لإنشاء استطلاع."));
        pollsList.replaceChildren(safeText("li", "empty-item", "لا توجد مجموعات متاحة لإنشاء استطلاع."));
        groupSelect.disabled = true;
        createPollButton.disabled = true;
        return;
      }
      groupSelect.disabled = false;
      createPollButton.disabled = false;
      groupSelect.value = groups[0].id;
      await loadGroupPolls();
    } catch (error) {
      groupSelect.replaceChildren(safeText("option", "", "تعذر تحميل المجموعات."));
      groupSelect.disabled = true;
      createPollButton.disabled = true;
      console.error("Loading poll groups failed:", error);
      announce("تعذر تحميل المجموعات. حاول مرة أخرى.", "error");
    }
  }
  async function loadGroupPolls() {
    const groupId = groupSelect.value;
    if (!groupId) { pollsList.replaceChildren(); return; }
    pollsList.replaceChildren(safeText("li", "empty-item", "جارٍ تحميل الاستطلاعات…"));
    try {
      const { data, error } = await supabase.from("group_polls")
        .select("id,conversation_id,question,options,created_at,closes_at,created_by,group_poll_votes(user_id,option_index)")
        .eq("conversation_id", groupId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      renderPolls(data || []);
    } catch (error) {
      pollsList.replaceChildren(safeText("li", "empty-item", "تعذر تحميل الاستطلاعات."));
      console.error("Loading group polls failed:", error);
      announce("تعذر تحميل الاستطلاعات. حاول مرة أخرى.", "error");
    }
  }
  function renderPolls(polls) {
    pollsList.replaceChildren();
    if (!polls.length) {
      pollsList.append(safeText("li", "empty-item", "لا توجد استطلاعات في هذه المجموعة بعد."));
      return;
    }
    polls.forEach((poll) => {
      const card = document.createElement("li");
      card.className = "poll-card";
      const question = safeText("h4", "poll-question", poll.question);
      question.setAttribute("data-no-translate", "");
      card.append(question);
      const votes = poll.group_poll_votes || [];
      const total = votes.length;
      const ownVote = votes.find((vote) => vote.user_id === getCurrentUser()?.id);
      const closed = Boolean(poll.closes_at && new Date(poll.closes_at) <= new Date());
      poll.options.forEach((option, index) => {
        const count = votes.filter((vote) => vote.option_index === index).length;
        const row = document.createElement("div");
        row.className = "poll-option-row";
        const button = safeText("button", "poll-vote-button", "");
        button.type = "button";
        button.disabled = closed;
        button.setAttribute("aria-pressed", String(ownVote?.option_index === index));
        const optionLabel = safeText("span", "poll-option-label", option);
        optionLabel.setAttribute("data-no-translate", "");
        const countLabel = safeText("span", "poll-option-count", " — " + count + (count === 1 ? " صوت" : " أصوات"));
        button.append(optionLabel, countLabel);
        button.addEventListener("click", () => void castVote(poll.id, index));
        const track = document.createElement("div");
        track.className = "poll-result-track";
        track.setAttribute("aria-hidden", "true");
        const fill = document.createElement("span");
        fill.className = "poll-result-fill";
        fill.style.width = (total ? count / total * 100 : 0) + "%";
        track.append(fill);
        row.append(button, track);
        card.append(row);
      });
      const meta = document.createElement("p");
      meta.className = "poll-meta";
      meta.append(safeText("span", "poll-total", total + (total === 1 ? " صوت" : " أصوات")));
      if (ownVote) {
        meta.append(safeText("span", "poll-own-vote-label", " · صوتك:"));
        const ownVoteText = safeText("span", "poll-own-vote-value", poll.options[ownVote.option_index] || "");
        ownVoteText.setAttribute("data-no-translate", "");
        meta.append(ownVoteText);
      }
      if (closed) meta.append(safeText("span", "poll-closed-label", " · انتهى الاستطلاع"));
      card.append(meta);
      pollsList.append(card);
    });
  }
  async function castVote(pollId, optionIndex) {
    const user = getCurrentUser();
    if (!user) return;
    try {
      const { error } = await supabase.from("group_poll_votes").upsert(
        { poll_id: pollId, user_id: user.id, option_index: optionIndex },
        { onConflict: "poll_id,user_id" }
      );
      if (error) throw error;
      await loadGroupPolls();
      announce("تم تسجيل صوتك.");
    } catch (error) { console.error("Casting poll vote failed:", error); announce("تعذر تسجيل التصويت. حاول مرة أخرى.", "error"); }
  }
  createPollButton.addEventListener("click", async () => {
    const user = getCurrentUser();
    if (!user || !groupSelect.value) return;
    const question = questionInput.value.trim();
    const options = [...optionsEditor.querySelectorAll("input")].map((input) => input.value.trim()).filter(Boolean);
    if (!question) { announce("أدخل سؤال الاستطلاع.", "error"); questionInput.focus(); return; }
    if (options.length < 2 || new Set(options.map((option) => option.toLocaleLowerCase())).size < 2) {
      announce("أدخل خيارين مختلفين على الأقل.", "error");
      return;
    }
    if (options.length > 10) { announce("لا يمكن أن يتجاوز الاستطلاع 10 خيارات.", "error"); return; }
    createPollButton.disabled = true;
    try {
      const { error } = await supabase.from("group_polls").insert({
        conversation_id: groupSelect.value,
        created_by: user.id,
        question,
        options
      });
      if (error) throw error;
      questionInput.value = "";
      resetOptions();
      await loadGroupPolls();
      announce("تم إنشاء الاستطلاع.");
    } catch (error) { console.error("Creating group poll failed:", error); announce("تعذر إنشاء الاستطلاع. حاول مرة أخرى.", "error"); }
    finally { createPollButton.disabled = false; }
  });
  groupSelect.addEventListener("change", () => void loadGroupPolls());
  $("#poll-refresh-button").addEventListener("click", () => void loadGroupPolls());
  resetOptions();

  return { closeTool, openTool };
}
