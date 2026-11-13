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
    home.inert = true;
    detail.hidden = false;
    detail.inert = false;
    panels.forEach((panel) => { panel.hidden = panel.id !== name + "-tool"; });
    title.textContent = labels[name];
    detail.setAttribute("aria-labelledby", "tool-detail-title");
    detail.removeAttribute("aria-label");
    document.body.classList.add("tools-detail-open");
    title.focus();
    if (name === "notes") loadNotes();
    if (name === "polls") void loadPollGroups();
    if (name === "calculator") renderCalculator();
  }

  function closeTool(restoreFocus = true) {
    activeTool = null;
    detail.hidden = true;
    detail.inert = true;
    home.hidden = false;
    home.inert = false;
    document.body.classList.remove("tools-detail-open");
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
    else if (restoreFocus) $("#tools-title")?.focus();
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
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...detail.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.hidden && element.getClientRects().length);
    if (!focusable.length) {
      event.preventDefault();
      title.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
    calculatorDisplay.setAttribute("aria-label", document.documentElement.lang === "en" ? "Calculator display: " + (expression || "0") : "شاشة الآلة الحاسبة: " + (expression || "0"));
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
        calculatorDisplay.textContent = document.documentElement.lang === "en"
        ? (error.message === "zero" ? "Cannot divide by zero." : "Invalid calculation.")
        : (error.message === "zero" ? "لا يمكن القسمة على صفر." : "عملية حسابية غير صحيحة.");
      calculatorDisplay.setAttribute("aria-label", document.documentElement.lang === "en" ? "Calculation error" : "خطأ في العملية الحسابية");
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
    if (event.target.matches("input,textarea,select")) return;
    if (/^[0-9.+*/%-]$/.test(event.key)) { event.preventDefault(); calculatorInput(event.key); return; }
    if (event.target.closest("button")) return;
    if (event.key === "Enter" || event.key === "=") { event.preventDefault(); calculatorInput("equals"); }
    else if (event.key === "Backspace") { event.preventDefault(); calculatorInput("backspace"); }
    else if (event.key === "Escape") { event.preventDefault(); calculatorInput("clear"); }
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
        if (!noteSave.disabled && !window.confirm(document.documentElement.lang === "en" ? "You have unsaved changes. Do you want to discard them?" : "لديك تغييرات غير محفوظة. هل تريد تجاهلها؟")) return;
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
    if (!noteSave.disabled && !window.confirm(document.documentElement.lang === "en" ? "You have unsaved changes. Do you want to discard them?" : "لديك تغييرات غير محفوظة. هل تريد تجاهلها؟")) return;
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
    if (!activeNoteId || !window.confirm(document.documentElement.lang === "en" ? "Do you want to delete this note?" : "هل تريد حذف هذه الملاحظة؟")) return;
    notes = notes.filter((note) => note.id !== activeNoteId);
    try { localStorage.setItem(notesKey(), JSON.stringify(notes)); }
    catch { announce(document.documentElement.lang === "en" ? "Could not delete the note." : "تعذر حذف الملاحظة.", "error"); return; }
    activeNoteId = null;
    originalNote = { title: "", body: "" };
    noteTitle.value = "";
    noteBody.value = "";
    updateNoteButtons();
    renderNotes();
    announce("تم حذف الملاحظة.");
  });

  // Split a bill evenly, with an optional tip percentage.
  const billTotalInput = $("#bill-total-input");
  const billPeopleInput = $("#bill-people-input");
  const billTipInput = $("#bill-tip-input");
  const billSplitResult = $("#bill-split-result");
  $("#bill-split-calculate").addEventListener("click", () => {
    const amount = Number(billTotalInput.value);
    const peopleCount = Number(billPeopleInput.value);
    const tipPercent = Number(billTipInput.value || 0);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(peopleCount) || peopleCount < 1 ||
        !Number.isFinite(tipPercent) || tipPercent < 0 || tipPercent > 100) {
      billSplitResult.textContent = document.documentElement.lang === "en" ? "Check the entered values." : "تحقق من البيانات المدخلة.";
      return;
    }
    const totalWithTip = amount * (1 + tipPercent / 100);
    const format = new Intl.NumberFormat(document.documentElement.lang === "en" ? "en" : "ar", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    billSplitResult.replaceChildren();
    billSplitResult.append(
      safeText("span", "bill-share-label", document.documentElement.lang === "en" ? "Each person's share:" : "نصيب كل شخص:"),
      document.createTextNode(" "),
      safeText("strong", "bill-share-value", format.format(totalWithTip / peopleCount)),
      safeText("span", "bill-split-separator", " — "),
      safeText("span", "bill-total-label", document.documentElement.lang === "en" ? "Total including tip:" : "الإجمالي مع الإكرامية:"),
      document.createTextNode(" "),
      safeText("strong", "bill-total-value", format.format(totalWithTip))
    );
  });

  // QR generation happens locally in the browser; the content is not sent to a QR service.
  const qrInput = $("#qr-content-input");
  const qrGenerate = $("#qr-generate-button");
  const qrCanvas = $("#qr-canvas");
  const qrResult = $("#qr-result");
  const qrStatus = $("#qr-status");
  const qrDownload = $("#qr-download-button");
  const qrCopy = $("#qr-copy-button");
  let latestQrContent = "";
  function resetQrResult() {
    latestQrContent = "";
    qrResult.hidden = true;
    qrDownload.disabled = true;
    qrCopy.disabled = true;
  }
  qrInput.addEventListener("input", () => {
    if (latestQrContent && qrInput.value.trim() !== latestQrContent) {
      resetQrResult();
      qrStatus.textContent = "";
    }
  });
  qrGenerate.addEventListener("click", async () => {
    const value = qrInput.value.trim();
    if (!value) {
      resetQrResult();
      qrStatus.textContent = "أدخل نصًا أو رابطًا أولًا.";
      return;
    }
    resetQrResult();
    qrGenerate.disabled = true;
    qrStatus.textContent = "جارٍ إنشاء رمز QR…";
    try {
      const qrModule = await import("https://esm.sh/qrcode@1.5.4");
      const qrLibrary = qrModule.default || qrModule;
      if (typeof qrLibrary.toCanvas !== "function") throw new Error("QR library unavailable");
      await qrLibrary.toCanvas(qrCanvas, value, { width: 280, margin: 2, errorCorrectionLevel: "M", color: { dark: "#111827", light: "#ffffff" } });
      if (qrInput.value.trim() !== value) return;
      latestQrContent = value;
      $("#qr-content-preview").textContent = value;
      $("#qr-canvas").setAttribute("aria-label", (document.documentElement.lang === "en" ? "QR code for content: " : "رمز QR للمحتوى: ") + value.slice(0, 100));
      qrResult.hidden = false;
      qrDownload.disabled = false;
      qrCopy.disabled = false;
      qrStatus.textContent = "تم إنشاء رمز QR.";
    } catch (error) {
      resetQrResult();
      console.error("QR generation failed:", error);
      qrStatus.textContent = "تعذر إنشاء رمز QR. حاول مرة أخرى.";
    } finally { qrGenerate.disabled = false; }
  });
  qrDownload.addEventListener("click", () => {
    if (!latestQrContent) return;
    const link = document.createElement("a");
    link.href = qrCanvas.toDataURL("image/png");
    link.download = "mersal-qr.png";
    link.click();
  });
  qrCopy.addEventListener("click", async () => {
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

  const addOptionButton = $("#poll-add-option-button");
  const removeOptionButton = $("#poll-remove-option-button");
  function updateOptionButtons() {
    addOptionButton.disabled = optionCount >= 10;
    removeOptionButton.disabled = optionCount <= 2;
  }
  function addOptionInput(number) {
    const english = document.documentElement.lang === "en";
    const labelText = english ? "Option " + number : number === 1 ? "الخيار الأول" : number === 2 ? "الخيار الثاني" : "الخيار " + number;
    const label = safeText("label", "", labelText);
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 120;
    input.className = "poll-option-input";
    input.id = "poll-option-" + number;
    input.placeholder = labelText;
    input.setAttribute("aria-label", labelText);
    label.htmlFor = input.id;
    optionsEditor.append(label, input);
  }
  function resetOptions() {
    optionsEditor.replaceChildren();
    optionCount = 2;
    addOptionInput(1);
    addOptionInput(2);
    updateOptionButtons();
  }
  addOptionButton.addEventListener("click", () => {
    if (optionCount >= 10) return;
    optionCount += 1;
    addOptionInput(optionCount);
    updateOptionButtons();
    $("#poll-option-" + optionCount).focus();
  });
  removeOptionButton.addEventListener("click", () => {
    if (optionCount <= 2) return;
    const lastId = "poll-option-" + optionCount;
    optionsEditor.querySelector('label[for="' + lastId + '"]')?.remove();
    $("#" + lastId)?.remove();
    optionCount -= 1;
    updateOptionButtons();
    $("#poll-option-" + optionCount)?.focus();
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
    const english = document.documentElement.lang === "en";
    polls.forEach((poll) => {
      const card = document.createElement("li");
      card.className = "poll-card";
      const question = safeText("h3", "poll-question", poll.question);
      question.setAttribute("data-no-translate", "");
      card.append(question);
      const votes = poll.group_poll_votes || [];
      const total = votes.length;
      const ownVote = votes.find((vote) => vote.user_id === getCurrentUser()?.id);
      const closed = Boolean(poll.closes_at && new Date(poll.closes_at) <= new Date());
      (Array.isArray(poll.options) ? poll.options : []).forEach((option, index) => {
        const count = votes.filter((vote) => vote.option_index === index).length;
        const percent = total ? Math.round(count * 100 / total) : 0;
        const row = document.createElement("div");
        row.className = "poll-option-row";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "poll-vote-button";
        button.disabled = closed;
        button.setAttribute("aria-pressed", String(ownVote?.option_index === index));
        const optionLabel = safeText("span", "poll-option-label", option);
        optionLabel.setAttribute("data-no-translate", "");
        const countLabel = safeText("span", "poll-option-count",
          english ? count + " of " + total + " votes · " + percent + "%" : count + " من " + total + " أصوات · " + percent + "%");
        button.setAttribute("aria-label", (english ? "Vote for " : "التصويت لخيار ") + option + ". " + countLabel.textContent);
        button.append(optionLabel, countLabel);
        button.addEventListener("click", () => void castVote(poll.id, index));
        const track = document.createElement("div");
        track.className = "poll-result-track";
        track.setAttribute("aria-hidden", "true");
        const fill = document.createElement("span");
        fill.className = "poll-result-fill";
        fill.style.width = percent + "%";
        track.append(fill);
        row.append(button, track);
        card.append(row);
      });
      const meta = safeText("p", "poll-meta", english
        ? "Total votes: " + total + (ownVote ? " · Your vote: " + (poll.options[ownVote.option_index] || "") : "") + (closed ? " · Poll closed" : "")
        : "إجمالي الأصوات: " + total + (ownVote ? " · تصويتك: " + (poll.options[ownVote.option_index] || "") : "") + (closed ? " · انتهى الاستطلاع" : ""));
      meta.setAttribute("data-no-translate", "");
      card.append(meta);
      if (poll.created_by === getCurrentUser()?.id) {
        const deleteButton = safeText("button", "danger-button", english ? "Delete poll" : "حذف الاستطلاع");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => void deletePoll(poll.id));
        card.append(deleteButton);
      }
      pollsList.append(card);
    });
  }
  async function deletePoll(pollId) {
    const english = document.documentElement.lang === "en";
    if (!window.confirm(english ? "Do you want to delete this poll?" : "هل تريد حذف هذا الاستطلاع؟")) return;
    try {
      const { error } = await supabase.from("group_polls").delete().eq("id", pollId);
      if (error) throw error;
      announce(english ? "Poll deleted." : "تم حذف الاستطلاع.");
      await loadGroupPolls();
    } catch (error) {
      console.error("Deleting poll failed:", error);
      announce(english ? "Could not delete the poll. Please try again." : "تعذر حذف الاستطلاع. حاول مرة أخرى.", "error");
    }
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
    const english = document.documentElement.lang === "en";
    const question = questionInput.value.trim();
    const options = [...optionsEditor.querySelectorAll("input")].map((input) => input.value.trim());
    if (!question) { announce(english ? "Enter a poll question." : "أدخل سؤال الاستطلاع.", "error"); questionInput.focus(); return; }
    if (options.length < 2) { announce(english ? "Add at least two options." : "أضف خيارين على الأقل.", "error"); return; }
    if (options.length > 10) { announce(english ? "A poll can have no more than ten options." : "لا يمكن أن يتجاوز الاستطلاع 10 خيارات.", "error"); return; }
    if (options.some((option) => !option)) {
      announce(english ? "Fill in every poll option." : "املأ جميع خيارات الاستطلاع.", "error");
      optionsEditor.querySelector("input:placeholder-shown")?.focus();
      return;
    }
    if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
      announce(english ? "Poll options must be different." : "يجب أن تكون خيارات الاستطلاع مختلفة.", "error");
      return;
    }
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
      announce(english ? "Poll created." : "تم إنشاء الاستطلاع.");
    } catch (error) {
      console.error("Creating group poll failed:", error);
      announce(english ? "Could not create the poll. Please try again." : "تعذر إنشاء الاستطلاع. حاول مرة أخرى.", "error");
    } finally {
      createPollButton.disabled = false;
    }
  });

  groupSelect.addEventListener("change", () => void loadGroupPolls());
  $("#poll-refresh-button").addEventListener("click", () => void loadGroupPolls());
  const pollLanguageObserver = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === "lang") && activeTool === "polls" && groupSelect.value) {
      void loadGroupPolls();
    }
  });
  pollLanguageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  resetOptions();

  return { closeTool, openTool };
}
