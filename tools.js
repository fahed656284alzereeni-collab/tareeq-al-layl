const $ = (selector) => document.querySelector(selector);

export function initMersalTools({ supabase, getCurrentUser, announce, safeText }) {
  const home = $("#tools-home-view");
  const detail = $("#tool-detail-view");
  const title = $("#tool-detail-title");
  const back = $("#tool-back-button");
  const panels = ["calculator", "notes", "qr"].map((name) => $("#" + name + "-tool"));
  let activeTool = null;
  let returnFocus = null;

  const toolEnglish = () => document.documentElement.lang === "en";
  function localizeTools() {
    const en = toolEnglish();
    const text = (selector, ar, english) => { const node = $(selector); if (node) node.textContent = en ? english : ar; };
    const attr = (selector, name, ar, english) => { const node = $(selector); if (node) node.setAttribute(name, en ? english : ar); };
    text(".tools-intro .tools-eyebrow", "مرسال", "Mersal");
    text("#tools-title", "الأدوات", "Tools");
    text(".tools-intro > p:last-child", "أدوات عملية تساعدك أثناء استخدام مرسال.", "Useful tools to help you while using Mersal.");
    const cards = [
      [".tool-launch-button[data-tool='calculator']", "الآلة الحاسبة", "Calculator"],
      [".tool-launch-button[data-tool='notes']", "المفكرة السريعة", "Quick notes"],
      [".tool-launch-button[data-tool='qr']", "إنشاء رموز QR", "QR code generator"],
    ];
    for (const [selector, arTitle, enTitle] of cards) {
      const titleNode = $(selector)?.querySelector(".tool-card-title");
      if (titleNode) titleNode.textContent = en ? enTitle : arTitle;
    }
    text("#tool-back-button", "العودة إلى الأدوات", "Back to tools");
    text("#tool-detail-title", ({calculator:"الآلة الحاسبة",notes:"المفكرة السريعة",qr:"إنشاء رموز QR"}[activeTool] || "الأداة"),
      ({calculator:"Calculator",notes:"Quick notes",qr:"QR code generator"}[activeTool] || "Tool"));
    const labels = [
      ["label[for='bill-total-input']","قيمة الفاتورة","Bill amount"],["label[for='bill-people-input']","عدد الأشخاص","Number of people"],
      ["label[for='bill-tip-input']","نسبة الإكرامية (%)","Tip percentage (%)"],["label[for='note-title-input']","عنوان الملاحظة","Note title"],
      ["label[for='note-body-input']","نص الملاحظة","Note text"],["label[for='notes-search-input']","البحث في الملاحظات","Search notes"],
      ["label[for='qr-content-input']","النص أو الرابط أو رقم الهاتف","Text, link, or phone number"],
    ];
    for (const [selector, ar, enText] of labels) text(selector, ar, enText);
    const buttons = [
      ["#calculator-tool [data-calc-key='clear']","مسح","Clear"],["#calculator-tool .calculator-secondary[aria-label='حذف آخر رقم']","حذف","Delete"],
      ["#bill-split-calculate","احسب نصيب كل شخص","Calculate each person's share"],["#note-new-button","ملاحظة جديدة","New note"],
      ["#note-save-button","حفظ الملاحظة","Save note"],["#note-delete-button","حذف الملاحظة","Delete note"],
      ["#qr-generate-button","إنشاء رمز QR","Generate QR code"],["#qr-download-button","تنزيل رمز QR","Download QR code"],
      ["#qr-copy-button","نسخ المحتوى","Copy content"]
    ];
    for (const [selector, ar, enText] of buttons) text(selector, ar, enText);
    text("#bill-split-title","تقسيم الفاتورة","Split a bill");
    const splitOutput = $("#bill-split-result");
    if (splitOutput && ["أدخل البيانات لحساب نصيب كل شخص.","Enter the details to calculate the share per person."].includes(splitOutput.textContent.trim())) {
      splitOutput.textContent = en ? "Enter the details to calculate the share per person." : "أدخل البيانات لحساب نصيب كل شخص.";
    }
    const placeholders = [
      ["#bill-total-input","",""],["#note-title-input","اكتب عنوانًا للملاحظة","Enter a note title"],
      ["#note-body-input","اكتب ملاحظتك هنا","Write your note here"],["#notes-search-input","ابحث في ملاحظاتك","Search your notes"],
      ["#qr-content-input","اكتب المحتوى الذي تريد تحويله إلى رمز QR","Enter the content you want to turn into a QR code"]
    ];
    for (const [selector, ar, enText] of placeholders) { const node=$(selector); if(node && (ar || enText)) node.placeholder=en?enText:ar; }
    attr("#tools-home-view","aria-label","الأدوات","Tools");
    attr("#calculator-tool","aria-label","الآلة الحاسبة","Calculator");
    attr("#notes-tool","aria-label","المفكرة السريعة","Quick notes");
    attr("#qr-tool","aria-label","إنشاء رموز QR","QR code generator");
    attr(".tools-grid","aria-label","أدوات مرسال","Mersal tools");
    const help = $("#qr-canvas"); if (help) help.setAttribute("aria-label", en ? "Generated QR code" : "رمز QR الذي تم إنشاؤه");
    document.querySelectorAll(".calculator-grid").forEach(node=>node.setAttribute("aria-label",en?"Calculator keys":"أزرار الآلة الحاسبة"));
    document.querySelectorAll("#notes-list").forEach(node=>node.setAttribute("aria-label",en?"Saved notes":"الملاحظات المحفوظة"));
  }
  const toolsLanguageObserver = new MutationObserver(records => {
    if (records.some(record => record.attributeName === "lang")) {
      localizeTools();
    }
  });
  toolsLanguageObserver.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});

  localizeTools();

  function openTool(name) {
    const labels = {
      calculator: "الآلة الحاسبة",
      notes: "المفكرة السريعة",
      qr: "إنشاء رموز QR"
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
    localizeTools();
    detail.setAttribute("aria-labelledby", "tool-detail-title");
    detail.removeAttribute("aria-label");
    document.body.classList.add("tools-detail-open");
    title.focus();
    if (name === "notes") loadNotes();
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
        calculatorDisplay.textContent = error.message === "zero" ? (document.documentElement.lang === "en" ? "Cannot divide by zero." : "لا يمكن القسمة على صفر.") : (document.documentElement.lang === "en" ? "Invalid calculation." : "عملية حسابية غير صحيحة.");
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
    if (event.target.closest("button") && ["Enter", " ", "Spacebar"].includes(event.key)) return;
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
      notesList.append(safeText("li", "empty-item", notes.length ? (document.documentElement.lang === "en" ? "No matching results." : "لا توجد نتائج مطابقة.") : (document.documentElement.lang === "en" ? "No saved notes." : "لا توجد ملاحظات محفوظة.")));
      return;
    }
    matches.forEach((note) => {
      const item = document.createElement("li");
      const button = safeText("button", "note-list-button", note.title || note.body.slice(0, 55) || (document.documentElement.lang === "en" ? "Untitled note" : "ملاحظة بدون عنوان"));
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
      announce(document.documentElement.lang === "en" ? "Note saved." : "تم حفظ الملاحظة.");
    } catch { announce(document.documentElement.lang === "en" ? "Could not save the note." : "تعذر حفظ الملاحظة.", "error"); }
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
    announce(document.documentElement.lang === "en" ? "Note deleted." : "تم حذف الملاحظة.");
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
      safeText("span", "bill-share-label", (document.documentElement.lang === "en" ? "Each person pays:" : "نصيب كل شخص:")),
      document.createTextNode(" "),
      safeText("strong", "bill-share-value", format.format(totalWithTip / peopleCount)),
      safeText("span", "bill-split-separator", " — "),
      safeText("span", "bill-total-label", (document.documentElement.lang === "en" ? "Total including tip:" : "الإجمالي مع الإكرامية:")),
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
    if (qrGenerate.disabled || (latestQrContent && qrInput.value.trim() !== latestQrContent)) {
      resetQrResult();
      qrStatus.textContent = "";
    }
  });
  qrGenerate.addEventListener("click", async () => {
    const value = qrInput.value.trim();
    if (!value) {
      resetQrResult();
      qrStatus.textContent = document.documentElement.lang === "en" ? "Enter text or a link first." : "أدخل نصًا أو رابطًا أولًا.";
      return;
    }
    resetQrResult();
    qrGenerate.disabled = true;
    qrStatus.textContent = document.documentElement.lang === "en" ? "Generating QR code…" : "جارٍ إنشاء رمز QR…";
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
      qrStatus.textContent = document.documentElement.lang === "en" ? "QR code created." : "تم إنشاء رمز QR.";
    } catch (error) {
      resetQrResult();
      console.error("QR generation failed:", error);
      qrStatus.textContent = document.documentElement.lang === "en" ? "Could not create the QR code. Please try again." : "تعذر إنشاء رمز QR. حاول مرة أخرى.";
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
    try { await navigator.clipboard.writeText(latestQrContent); announce(document.documentElement.lang === "en" ? "Content copied." : "تم نسخ المحتوى."); }
    catch { announce(document.documentElement.lang === "en" ? "Could not copy the content." : "تعذر نسخ المحتوى.", "error"); }
  });

  localizeTools();

  return { closeTool, openTool };
}
