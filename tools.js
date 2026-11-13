const $ = (selector) => document.querySelector(selector);

export function initMersalTools({ supabase, getCurrentUser, announce, safeText }) {
  const home = $("#tools-home-view");
  const detail = $("#tool-detail-view");
  const title = $("#tool-detail-title");
  const back = $("#tool-back-button");
  const panels = ["calculator", "notes", "qr", "polls"].map((name) => $("#" + name + "-tool"));
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
      [".tool-launch-button[data-tool='calculator']", "الآلة الحاسبة", "Calculator", "عمليات حسابية ونسب مئوية وتقسيم الفواتير.", "Calculations, percentages, and bill splitting.", "فتح الأداة", "Open tool"],
      [".tool-launch-button[data-tool='notes']", "المفكرة السريعة", "Quick notes", "اكتب ملاحظاتك واحفظها وابحث فيها على هذا الجهاز.", "Write, save, and search notes on this device.", "فتح الأداة", "Open tool"],
      [".tool-launch-button[data-tool='qr']", "إنشاء رموز QR", "QR code generator", "حوّل رابطًا أو رقمًا أو نصًا إلى رمز QR.", "Turn a link, number, or text into a QR code.", "فتح الأداة", "Open tool"],
      [".tool-launch-button[data-tool='polls']", "استطلاعات الرأي", "Polls", "أنشئ تصويتًا داخل مجموعة وشاهد النتائج.", "Create a poll in a group and view the results.", "فتح الأداة", "Open tool"]
    ];
    for (const [selector, arTitle, enTitle, arDesc, enDesc, arAction, enAction] of cards) {
      const card = $(selector);
      if (!card) continue;
      const titleNode = card.querySelector(".tool-card-title");
      const descNode = card.querySelector(".tool-card-description");
      const actionNode = card.querySelector(".tool-status");
      if (titleNode) titleNode.textContent = en ? enTitle : arTitle;
      if (descNode) descNode.textContent = en ? enDesc : arDesc;
      if (actionNode) actionNode.textContent = en ? enAction : arAction;
    }
    text("#tool-back-button", "العودة إلى الأدوات", "Back to tools");
    text("#tool-detail-title", ({calculator:"الآلة الحاسبة",notes:"المفكرة السريعة",qr:"إنشاء رموز QR",polls:"استطلاعات الرأي"}[activeTool] || "الأداة"),
      ({calculator:"Calculator",notes:"Quick notes",qr:"QR code generator",polls:"Polls"}[activeTool] || "Tool"));
    const labels = [
      ["label[for='bill-total-input']","قيمة الفاتورة","Bill amount"],["label[for='bill-people-input']","عدد الأشخاص","Number of people"],
      ["label[for='bill-tip-input']","نسبة الإكرامية (%)","Tip percentage (%)"],["label[for='note-title-input']","عنوان الملاحظة","Note title"],
      ["label[for='note-body-input']","نص الملاحظة","Note text"],["label[for='notes-search-input']","البحث في الملاحظات","Search notes"],
      ["label[for='qr-content-input']","النص أو الرابط أو رقم الهاتف","Text, link, or phone number"],
      ["label[for='poll-group-select']","المجموعة","Group"],["label[for='poll-question-input']","سؤال الاستطلاع","Poll question"],
      ["label[for='poll-option-1']","الخيار الأول","Option one"],["label[for='poll-option-2']","الخيار الثاني","Option two"]
    ];
    for (const [selector, ar, enText] of labels) text(selector, ar, enText);
    const buttons = [
      ["#calculator-tool [data-calc-key='clear']","مسح","Clear"],["#calculator-tool .calculator-secondary[aria-label='حذف آخر رقم']","حذف","Delete"],
      ["#bill-split-calculate","احسب نصيب كل شخص","Calculate each person's share"],["#note-new-button","ملاحظة جديدة","New note"],
      ["#note-save-button","حفظ الملاحظة","Save note"],["#note-delete-button","حذف الملاحظة","Delete note"],
      ["#qr-generate-button","إنشاء رمز QR","Generate QR code"],["#qr-download-button","تنزيل رمز QR","Download QR code"],
      ["#qr-copy-button","نسخ المحتوى","Copy content"],["#poll-add-option-button","إضافة خيار","Add option"],
      ["#poll-remove-option-button","إزالة آخر خيار","Remove last option"],["#poll-create-button","إنشاء الاستطلاع","Create poll"],
      ["#poll-refresh-button","تحديث النتائج","Refresh results"]
    ];
    for (const [selector, ar, enText] of buttons) text(selector, ar, enText);
    text("#bill-split-title","تقسيم الفاتورة","Split a bill");
    text("#polls-tool > .tool-help","أنشئ استطلاعًا في إحدى مجموعاتك. يمكن لكل عضو التصويت وتغيير صوته، وتظهر النتائج لأعضاء المجموعة فقط.","Create a poll in one of your groups. Members can vote and change their vote. Results are visible only to group members.");
    text("#polls-list-header h3, .polls-list-header h3","استطلاعات المجموعة","Group polls");
    text("#notes-tool .tool-help","تُحفظ الملاحظات على هذا الجهاز فقط، ولا تُرسل إلى خوادم مرسال.","Notes are saved only on this device and are not sent to Mersal servers.");
    text("#calculator-tool > .tool-help","يمكنك استخدام أزرار الآلة الحاسبة أو لوحة المفاتيح.","Use the calculator buttons or your keyboard.");
    const splitOutput = $("#bill-split-result");
    if (splitOutput && ["أدخل البيانات لحساب نصيب كل شخص.","Enter the details to calculate the share per person."].includes(splitOutput.textContent.trim())) {
      splitOutput.textContent = en ? "Enter the details to calculate the share per person." : "أدخل البيانات لحساب نصيب كل شخص.";
    }
    const placeholders = [
      ["#bill-total-input","",""],["#note-title-input","اكتب عنوانًا للملاحظة","Enter a note title"],
      ["#note-body-input","اكتب ملاحظتك هنا","Write your note here"],["#notes-search-input","ابحث في ملاحظاتك","Search your notes"],
      ["#qr-content-input","اكتب المحتوى الذي تريد تحويله إلى رمز QR","Enter the content you want to turn into a QR code"],
      ["#poll-question-input","ما رأيك؟","What do you think?"],["#poll-option-1","الخيار الأول","Option one"],["#poll-option-2","الخيار الثاني","Option two"]
    ];
    for (const [selector, ar, enText] of placeholders) { const node=$(selector); if(node && (ar || enText)) node.placeholder=en?enText:ar; }
    attr("#tools-home-view","aria-label","الأدوات","Tools");
    attr("#calculator-tool","aria-label","الآلة الحاسبة","Calculator");
    attr("#notes-tool","aria-label","المفكرة السريعة","Quick notes");
    attr("#qr-tool","aria-label","إنشاء رموز QR","QR code generator");
    attr("#polls-tool","aria-label","استطلاعات الرأي","Polls");
    attr(".tools-grid","aria-label","أدوات مرسال","Mersal tools");
    const help = $("#qr-canvas"); if (help) help.setAttribute("aria-label", en ? "Generated QR code" : "رمز QR الذي تم إنشاؤه");
    document.querySelectorAll(".calculator-grid").forEach(node=>node.setAttribute("aria-label",en?"Calculator keys":"أزرار الآلة الحاسبة"));
    document.querySelectorAll("#notes-list").forEach(node=>node.setAttribute("aria-label",en?"Saved notes":"الملاحظات المحفوظة"));
    document.querySelectorAll("#polls-list").forEach(node=>node.setAttribute("aria-label",en?"Group polls":"استطلاعات المجموعة"));
  }
  const toolsLanguageObserver = new MutationObserver(records => {
    if (records.some(record => record.attributeName === "lang")) {
      localizeTools();
      if (activeTool === "polls") {
        void loadPollGroups();
        if (groupSelect.value) void loadGroupPolls();
      }
    }
  });
  toolsLanguageObserver.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});

  localizeTools();

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
    localizeTools();
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
    const labelText = number === 1 ? (english ? "Option one" : "الخيار الأول") : number === 2 ? (english ? "Option two" : "الخيار الثاني") : (english ? "Option " : "الخيار ") + number;
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
    groupSelect.replaceChildren(safeText("option", "", document.documentElement.lang === "en" ? "Loading groups…" : "جارٍ تحميل المجموعات…"));
    try {
      const { data, error } = await supabase.from("conversations")
        .select("id,group_name,created_at").eq("is_group", true).order("created_at", { ascending: false });
      if (error) throw error;
      groups = data || [];
      groupSelect.replaceChildren();
      const placeholder = safeText("option", "", document.documentElement.lang === "en" ? "Select a group" : "اختر مجموعة");
      placeholder.value = "";
      groupSelect.append(placeholder);
      groups.forEach((group) => {
        const option = safeText("option", "", group.group_name || (document.documentElement.lang === "en" ? "Group" : "مجموعة"));
        option.value = group.id;
        option.setAttribute("data-no-translate", "");
        groupSelect.append(option);
      });
      if (!groups.length) {
        groupSelect.append(safeText("option", "", (document.documentElement.lang === "en" ? "No groups are available to create a poll." : "لا توجد مجموعات متاحة لإنشاء استطلاع.")));
        pollsList.replaceChildren(safeText("li", "empty-item", (document.documentElement.lang === "en" ? "No groups are available to create a poll." : "لا توجد مجموعات متاحة لإنشاء استطلاع.")));
        groupSelect.disabled = true;
        createPollButton.disabled = true;
        return;
      }
      groupSelect.disabled = false;
      createPollButton.disabled = false;
      groupSelect.value = groups[0].id;
      await loadGroupPolls();
    } catch (error) {
      groupSelect.replaceChildren(safeText("option", "", (document.documentElement.lang === "en" ? "Could not load groups." : "تعذر تحميل المجموعات.")));
      groupSelect.disabled = true;
      createPollButton.disabled = true;
      console.error("Loading poll groups failed:", error);
      announce(document.documentElement.lang === "en" ? "Could not load groups. Please try again." : "تعذر تحميل المجموعات. حاول مرة أخرى.", "error");
    }
  }
  async function loadGroupPolls() {
    const groupId = groupSelect.value;
    if (!groupId) { pollsList.replaceChildren(); return; }
    pollsList.replaceChildren(safeText("li", "empty-item", (document.documentElement.lang === "en" ? "Loading polls…" : "جارٍ تحميل الاستطلاعات…")));
    try {
      const { data, error } = await supabase.from("group_polls")
        .select("id,conversation_id,question,options,created_at,closes_at,created_by,group_poll_votes(user_id,option_index)")
        .eq("conversation_id", groupId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      renderPolls(data || []);
    } catch (error) {
      pollsList.replaceChildren(safeText("li", "empty-item", (document.documentElement.lang === "en" ? "Could not load polls." : "تعذر تحميل الاستطلاعات.")));
      console.error("Loading group polls failed:", error);
      announce(document.documentElement.lang === "en" ? "Could not load polls. Please try again." : "تعذر تحميل الاستطلاعات. حاول مرة أخرى.", "error");
    }
  }
  function renderPolls(polls) {
    pollsList.replaceChildren();
    if (!polls.length) {
      pollsList.append(safeText("li", "empty-item", (document.documentElement.lang === "en" ? "There are no polls in this group yet." : "لا توجد استطلاعات في هذه المجموعة بعد.")));
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
      announce(document.documentElement.lang === "en" ? "Your vote has been recorded." : "تم تسجيل صوتك.");
    } catch (error) { console.error("Casting poll vote failed:", error); announce(document.documentElement.lang === "en" ? "Could not record your vote. Please try again." : "تعذر تسجيل التصويت. حاول مرة أخرى.", "error"); }
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
  localizeTools();

  return { closeTool, openTool };
}
