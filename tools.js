const $ = (selector) => document.querySelector(selector);

export function initMersalTools({ supabase, getCurrentUser, announce, safeText }) {
  const home = $("#tools-home-view");
  const detail = $("#tool-detail-view");
  const title = $("#tool-detail-title");
  const back = $("#tool-back-button");
  const panels = ["calculator", "notes", "qr", "convert"].map((name) => $("#" + name + "-tool"));
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
      [".tool-launch-button[data-tool='convert']", "تحويل PDF وWord", "PDF and Word converter"],
    ];
    for (const [selector, arTitle, enTitle] of cards) {
      const titleNode = $(selector)?.querySelector(".tool-card-title");
      if (titleNode) titleNode.textContent = en ? enTitle : arTitle;
    }
    text("#tool-back-button", "العودة إلى الأدوات", "Back to tools");
    text("#tool-detail-title", ({calculator:"الآلة الحاسبة",notes:"المفكرة السريعة",qr:"إنشاء رموز QR",convert:"تحويل PDF وWord"}[activeTool] || "الأداة"),
      ({calculator:"Calculator",notes:"Quick notes",qr:"QR code generator",convert:"PDF and Word converter"}[activeTool] || "Tool"));
    const labels = [
      ["label[for='bill-total-input']","قيمة الفاتورة","Bill amount"],["label[for='bill-people-input']","عدد الأشخاص","Number of people"],
      ["label[for='bill-tip-input']","نسبة الإكرامية (%)","Tip percentage (%)"],["label[for='note-title-input']","عنوان الملاحظة","Note title"],
      ["label[for='note-body-input']","نص الملاحظة","Note text"],["label[for='notes-search-input']","البحث في الملاحظات","Search notes"],
      ["label[for='qr-content-input']","النص أو الرابط أو رقم الهاتف","Text, link, or phone number"],
    ];
    for (const [selector, ar, enText] of labels) text(selector, ar, enText);
    const converterLabels = [
      ["label[for='convert-direction']", "نوع التحويل", "Conversion type"],
      ["label[for='convert-file-input']", "اختر الملف", "Choose a file"],
    ];
    for (const [selector, ar, enText] of converterLabels) text(selector, ar, enText);
    text("#convert-start-button", "بدء التحويل", "Start conversion");
    text("#convert-download-button", "تنزيل الملف", "Download file");
    text("#convert-share-button", "مشاركة الملف", "Share file");
    text("#convert-file-name", "لم يتم اختيار ملف", "No file selected");
    const converterHelp = $("#convert-tool > .tool-help");
    if (converterHelp) converterHelp.textContent = en
      ? "Files up to 25 MB are converted on your device. Larger files are temporarily uploaded to a private processing workspace; the original file is removed after conversion."
      : "الملفات حتى 25 ميغابايت تُحوّل على جهازك. الملفات الأكبر تُرفع مؤقتًا إلى مساحة معالجة خاصة، ويُحذف الملف الأصلي بعد انتهاء التحويل.";
    const converterLimits = $("#convert-tool > p.tool-help:last-child");
    if (converterLimits) converterLimits.textContent = en
      ? "Supports PDF to DOCX and DOCX to PDF. Maximum input size: 1 GB. DOC files and scanned PDFs that require OCR are not supported. Converted files are automatically deleted after 7 days."
      : "يدعم PDF إلى DOCX وDOCX إلى PDF. الحد الأقصى لحجم الملف 1 جيجابايت. لا يدعم ملفات DOC القديمة أو ملفات PDF المصوّرة التي تحتاج OCR. تُحذف الملفات الناتجة تلقائيًا بعد 7 أيام.";
    if (convertProgress) convertProgress.setAttribute("aria-label", en ? "File upload progress" : "تقدم رفع الملف");
    const direction = $("#convert-direction");
    if (direction?.options?.length >= 2) {
      direction.options[0].textContent = en ? "PDF to Word" : "PDF إلى Word";
      direction.options[1].textContent = en ? "Word to PDF" : "Word إلى PDF";
    }
    const buttons = [
      ["#calculator-tool [data-calc-key='clear']","مسح","Clear"],["#calculator-tool .calculator-secondary[aria-label='حذف آخر رقم']","حذف","Delete"],
      ["#bill-split-calculate","احسب نصيب كل شخص","Calculate each person's share"],["#note-new-button","ملاحظة جديدة","New note"],
      ["#note-save-button","حفظ الملاحظة","Save note"],["#note-delete-button","حذف الملاحظة","Delete note"],
      ["#qr-generate-button","إنشاء رمز QR","Generate QR code"],["#qr-download-button","تنزيل رمز QR","Download QR code"],
      ["#qr-copy-button","نسخ المحتوى","Copy content"],
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
      ["#qr-content-input","اكتب المحتوى الذي تريد تحويله إلى رمز QR","Enter the content you want to turn into a QR code"],
    ];
    for (const [selector, ar, enText] of placeholders) { const node=$(selector); if(node && (ar || enText)) node.placeholder=en?enText:ar; }
    attr("#tools-home-view","aria-label","الأدوات","Tools");
    attr("#calculator-tool","aria-label","الآلة الحاسبة","Calculator");
    attr("#notes-tool","aria-label","المفكرة السريعة","Quick notes");
    attr("#qr-tool","aria-label","إنشاء رموز QR","QR code generator");
    attr("#convert-tool","aria-label","تحويل ملفات PDF وWord","PDF and Word file converter");
    const convertInput = $("#convert-file-input");
    if (convertInput && !convertInput.files?.length) {
      const toWord = $("#convert-direction")?.value !== "word-to-pdf";
      convertInput.setAttribute("aria-label", en
        ? (toWord ? "Choose a PDF file" : "Choose a Word DOCX file")
        : (toWord ? "اختر ملف PDF" : "اختر ملف Word بصيغة DOCX"));
    }
    
    const help = $("#qr-canvas"); if (help) help.setAttribute("aria-label", en ? "Generated QR code" : "رمز QR الذي تم إنشاؤه");
    
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
      qr: "إنشاء رموز QR",
      convert: "تحويل PDF وWord",
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
    if (name === "convert") resetConversionTool();
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

  // Delegate tool-card activation from the stable home container so the
  // downloader and other tools keep opening even if card contents are refreshed.
  home.addEventListener("click", (event) => {
    const button = event.target.closest(".tool-launch-button[data-tool]");
    if (!button || !home.contains(button)) return;
    event.preventDefault();
    openTool(button.dataset.tool);
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



  // Document conversion runs entirely in the browser. Files are never uploaded
  // to Mersal or a third-party conversion server.
  const convertFileInput = $("#convert-file-input");
  const convertFileName = $("#convert-file-name");
  const convertDirection = $("#convert-direction");
  const convertButton = $("#convert-start-button");
  const convertStatus = $("#convert-status");
  const convertDownload = $("#convert-download-button");
  const convertShare = $("#convert-share-button");
  const convertProgressWrap = $("#convert-progress-wrap");
  const convertProgress = $("#convert-progress");
  const convertProgressText = $("#convert-progress-text");
  let convertedBlob = null;
  let convertedDownloadUrl = "";
  let convertedName = "";

  function conversionText(ar, en) { return document.documentElement.lang === "en" ? en : ar; }
  function resetConversionTool() {
    convertedBlob = null;
    convertedDownloadUrl = "";
    convertedName = "";
    convertDownload.disabled = true;
    convertShare.disabled = true;
    convertStatus.textContent = conversionText("اختر ملف PDF أو Word للبدء. الملفات الكبيرة تُرفع مؤقتًا إلى مساحة خاصة للتحويل.", "Choose a PDF or Word file. Large files are temporarily uploaded to a private conversion workspace.");
    if (convertProgressWrap) convertProgressWrap.hidden = true;
    if (convertProgress) { convertProgress.value = 0; convertProgress.setAttribute("aria-label", conversionText("تقدم رفع الملف", "File upload progress")); }
    if (convertProgressText) convertProgressText.textContent = "";
    convertFileInput.value = "";
    convertFileName.textContent = conversionText("لم يتم اختيار ملف", "No file selected");
  }
  function loadConversionScript(src, test) {
    if (test()) return Promise.resolve();
    const existing = document.querySelector('script[data-conversion-src="' + src + '"]');
    if (existing) return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.conversionSrc = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("library-load"));
      document.head.append(script);
    });
  }
  async function convertPdfToWord(file) {
    const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    await loadConversionScript("https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", () => !!window.docx?.Document);
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pdf.numPages > 150) throw new Error("too-many-pages");
    const paragraphs = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      convertStatus.textContent = conversionText("جارٍ استخراج نص الصفحة " + pageNumber + " من " + pdf.numPages, "Extracting page " + pageNumber + " of " + pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      let lines = [];
      let currentY = null;
      let currentLine = "";
      for (const item of textContent.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform?.[5] || 0);
        if (currentY !== null && Math.abs(y - currentY) > 3) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = "";
        }
        currentY = y;
        currentLine += (currentLine && !currentLine.endsWith(" ") ? " " : "") + item.str;
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      if (!lines.length) lines = [conversionText("[لا يوجد نص قابل للاستخراج في هذه الصفحة]", "[No extractable text on this page]")];
      if (pageNumber > 1) paragraphs.push(new window.docx.Paragraph({ children: [], pageBreakBefore: true }));
      for (const line of lines) paragraphs.push(new window.docx.Paragraph({
        bidirectional: true,
        alignment: window.docx.AlignmentType.RIGHT,
        children: [new window.docx.TextRun({ text: line, rightToLeft: true })]
      }));
    }
    const doc = new window.docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
    return window.docx.Packer.toBlob(doc);
  }
  async function convertWordToPdf(file) {
    await Promise.all([
      loadConversionScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js", () => !!window.mammoth),
      loadConversionScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", () => !!window.html2canvas),
      loadConversionScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js", () => !!window.jspdf?.jsPDF)
    ]);
    const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const stage = document.createElement("article");
    stage.dir = "auto";
    stage.lang = "ar";
    stage.style.cssText = "position:fixed;left:-100000px;top:0;width:794px;padding:48px;background:#fff;color:#111;font:16px/1.75 Arial,sans-serif;overflow:visible;direction:rtl;box-sizing:border-box";
    stage.innerHTML = result.value || "<p></p>";
    stage.querySelectorAll("img").forEach(img => { img.style.maxWidth = "100%"; });
    document.body.append(stage);
    try {
      await Promise.all([...stage.querySelectorAll("img")].map(img => img.decode?.().catch(() => {}) || Promise.resolve()));
      if (stage.scrollHeight > 30000) throw new Error("too-many-pages");
      const canvas = await window.html2canvas(stage, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const sliceHeight = Math.floor(canvas.width * pageHeight / pageWidth);
      let page = 0;
      for (let y = 0; y < canvas.height; y += sliceHeight) {
        if (page > 0) pdf.addPage();
        const part = document.createElement("canvas");
        part.width = canvas.width;
        part.height = Math.min(sliceHeight, canvas.height - y);
        part.getContext("2d").drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, part.width, part.height);
        const image = part.toDataURL("image/jpeg", 0.92);
        pdf.addImage(image, "JPEG", 0, 0, pageWidth, part.height * pageWidth / part.width, undefined, "FAST");
        page++;
        convertStatus.textContent = conversionText("جارٍ تجهيز صفحة PDF رقم " + page, "Preparing PDF page " + page);
        if (page > 100) throw new Error("too-many-pages");
      }
      return pdf.output("blob");
    } finally {
      stage.remove();
    }
  }
  convertFileInput.addEventListener("change", () => {
    const file = convertFileInput.files?.[0];
    convertedBlob = null;
    convertedDownloadUrl = "";
    convertDownload.disabled = true;
    convertShare.disabled = true;
    if (convertProgressWrap) convertProgressWrap.hidden = true;
    if (convertProgress) convertProgress.value = 0;
    if (convertProgressText) convertProgressText.textContent = "";
    convertFileName.textContent = file ? file.name : conversionText("لم يتم اختيار ملف", "No file selected");
    convertStatus.textContent = file ? conversionText("الملف جاهز للتحويل.", "File ready to convert.") : conversionText("اختر ملف PDF أو Word للبدء.", "Choose a PDF or Word file.");
  });
  convertDirection.addEventListener("change", () => {
    convertFileInput.value = "";
    resetConversionTool();
    const toWord = convertDirection.value === "pdf-to-word";
    convertFileInput.accept = toWord ? ".pdf,application/pdf" : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    convertFileInput.setAttribute("aria-label", toWord ? conversionText("اختر ملف PDF", "Choose a PDF file") : conversionText("اختر ملف Word بصيغة DOCX", "Choose a Word DOCX file"));
  });
  async function convertLargeFile(file, toWord) {
    const user = getCurrentUser();
    if (!user?.id) throw new Error("not-authenticated");
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const accessToken = async () => {
      const result = await supabase.auth.getSession();
      const token = result?.data?.session?.access_token;
      if (!token) throw new Error("not-authenticated");
      return token;
    };
    const requestWorker = async () => {
      const response = await fetch("/api/converter/worker", {
        method: "POST",
        headers: { Authorization: "Bearer " + await accessToken() }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.workerUrl) throw new Error(data.code || "worker-unavailable");
      return String(data.workerUrl).replace(/\/+$/, "");
    };
    let workerUrl = await requestWorker();
    const waitForWorker = async () => {
      for (let i = 0; i < 300; i++) {
        try {
          const response = await fetch(workerUrl + "/health");
          if (response.ok && (await response.json()).ready) return;
        } catch {}
        convertStatus.textContent = conversionText("جارٍ تجهيز محرك التحويل للملفات الكبيرة…", "Preparing the large-file conversion engine…");
        await wait(2000);
      }
      throw new Error("worker-start-timeout");
    };
    await waitForWorker();

    const key = "mersal.converter.large." + user.id;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
    const direction = toWord ? "pdf-to-word" : "word-to-pdf";
    const sameFile = saved && saved.filename === file.name && Number(saved.size) === file.size
      && Number(saved.lastModified) === Number(file.lastModified) && saved.direction === direction;
    let jobId = sameFile ? saved.jobId : "";
    const save = () => {
      try { localStorage.setItem(key, JSON.stringify({ jobId, filename:file.name, size:file.size, lastModified:file.lastModified, direction, workerUrl })); } catch {}
    };
    const api = async (route, options = {}) => {
      const headers = Object.assign({}, options.headers || {}, { Authorization: "Bearer " + await accessToken() });
      return fetch(workerUrl + route, Object.assign({}, options, { headers }));
    };
    const reconnect = async () => {
      workerUrl = await requestWorker();
      await waitForWorker();
      save();
    };
    const readJob = async () => {
      const response = await api("/jobs/" + encodeURIComponent(jobId));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.code || "job-unavailable");
      return data;
    };
    let state = null;
    if (jobId) {
      try { state = await readJob(); } catch { state = null; }
    }
    if (state?.status === "failed" && state.errorCode !== "upload-interrupted") throw new Error(state.errorCode || "conversion-failed");
    if (!state || !jobId || (state.status === "failed" && state.errorCode === "upload-interrupted" && Number(state.uploadedBytes) < file.size)) {
      const response = await api("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename:file.name, size:file.size, direction, lastModified:file.lastModified })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.jobId) throw new Error(data.code || "job-create-failed");
      jobId = data.jobId;
      state = data;
      save();
    } else {
      save();
    }

    const getShare = async () => {
      let response;
      try { response = await api("/jobs/" + encodeURIComponent(jobId) + "/share"); }
      catch { await reconnect(); response = await api("/jobs/" + encodeURIComponent(jobId) + "/share"); }
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.code || "share-unavailable");
      return data;
    };
    if (state.status === "completed") {
      const share = await getShare();
      return { downloadUrl:share.url, outputName:state.outputName };
    }

    let uploaded = Number(state.uploadedBytes) || 0;
    const chunkSize = Number(state.chunkSize) || 4 * 1024 * 1024;
    if (state.status === "uploading" && uploaded < file.size) {
      convertProgressWrap.hidden = false;
      let lastSpoken = -10;
      while (uploaded < file.size) {
        const start = uploaded;
        const end = Math.min(start + chunkSize, file.size);
        let sent = false;
        for (let attempt = 0; attempt < 3 && !sent; attempt++) {
          try {
            const response = await api("/jobs/" + encodeURIComponent(jobId) + "/chunk", {
              method: "PUT",
              headers: { "Content-Type":"application/octet-stream", "Content-Range":"bytes " + start + "-" + (end - 1) + "/" + file.size },
              body: file.slice(start, end)
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 409) {
              state = await readJob();
              uploaded = Number(state.uploadedBytes) || 0;
              sent = true;
              break;
            }
            if (!response.ok) throw new Error(data.code || "upload-failed");
            uploaded = Number(data.uploadedBytes) || end;
            sent = true;
          } catch (error) {
            if (attempt === 2) throw new Error("upload-interrupted");
            try {
              await reconnect();
              state = await readJob();
              uploaded = Number(state.uploadedBytes) || 0;
            } catch {
              await wait(1500 * (attempt + 1));
            }
          }
        }
        if (!sent) throw new Error("upload-interrupted");
        const percent = Math.min(100, Math.floor(uploaded / file.size * 100));
        convertProgress.value = percent;
        if (percent >= lastSpoken + 10 || percent === 100) {
          lastSpoken = percent;
          convertProgressText.textContent = conversionText("تم رفع " + percent + "% من الملف", percent + "% of the file uploaded");
        }
      }
    }

    if (state.status === "uploading" || (state.status === "failed" && state.errorCode === "upload-interrupted")) {
      const response = await api("/jobs/" + encodeURIComponent(jobId) + "/complete", { method:"POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.code || "conversion-start-failed");
      state = data;
    }

    convertProgressWrap.hidden = false;
    convertProgress.removeAttribute("value");
    convertProgress.setAttribute("aria-label", conversionText("حالة تحويل الملف", "File conversion status"));
    const started = Date.now();
    while (Date.now() - started < 40 * 60 * 1000) {
      try { state = await readJob(); }
      catch { await reconnect(); state = await readJob(); }
      if (state.status === "completed") break;
      if (state.status === "failed") throw new Error(state.errorCode || "conversion-failed");
      if (state.status === "queued") {
        convertProgressText.textContent = conversionText("تم رفع الملف. ينتظر دوره للتحويل…", "File uploaded. Waiting for its turn to convert…");
      } else if (state.status === "uploading-result") {
        convertProgressText.textContent = conversionText("اكتمل التحويل. جارٍ حفظ الملف الناتج…", "Conversion complete. Saving the output file…");
      } else {
        convertProgressText.textContent = conversionText("جارٍ تحويل الملف. قد يستغرق ذلك بعض الوقت…", "Converting the file. This may take a while…");
      }
      await wait(2500);
    }
    if (state.status !== "completed") throw new Error("conversion-timeout");
    const share = await getShare();
    convertProgress.value = 100;
    convertProgressText.textContent = conversionText("اكتمل التحويل بنسبة 100%.", "Conversion completed: 100%.");
    return { downloadUrl:share.url, outputName:state.outputName || file.name.replace(/\.(pdf|docx)$/i, "") + (toWord ? ".docx" : ".pdf") };
  }

  convertButton.addEventListener("click", async () => {
    const file = convertFileInput.files?.[0];
    const toWord = convertDirection.value === "pdf-to-word";
    const expected = toWord ? /\.pdf$/i : /\.docx$/i;
    if (!file || !expected.test(file.name)) {
      convertStatus.textContent = toWord
        ? conversionText("اختر ملف PDF صحيحًا.", "Choose a valid PDF file.")
        : conversionText("اختر ملف Word بصيغة DOCX. ملفات DOC القديمة غير مدعومة حاليًا.", "Choose a Word DOCX file. Legacy DOC files are not supported yet.");
      convertFileInput.focus();
      return;
    }
    if (file.size > 1024 * 1024 * 1024) {
      convertStatus.textContent = conversionText("حجم الملف يتجاوز الحد الأقصى وهو 1 جيجابايت.", "The file exceeds the 1 GB maximum size.");
      return;
    }
    convertButton.disabled = true;
    convertDownload.disabled = true;
    convertShare.disabled = true;
    convertedBlob = null;
    convertedDownloadUrl = "";
    if (file.size > 25 * 1024 * 1024) {
      convertProgressWrap.hidden = false;
      convertProgress.value = 0;
      convertProgress.setAttribute("aria-label", conversionText("تقدم رفع الملف", "File upload progress"));
      convertProgressText.textContent = conversionText("جارٍ تجهيز الرفع الآمن…", "Preparing secure upload…");
      try {
        const result = await convertLargeFile(file, toWord);
        convertedDownloadUrl = result.downloadUrl;
        convertedName = result.outputName;
        convertDownload.disabled = false;
        convertShare.disabled = false;
        convertStatus.textContent = conversionText("اكتمل التحويل. يمكنك تنزيل الملف أو مشاركة رابطه.", "Conversion completed. You can download the file or share its link.");
        announce(conversionText("اكتمل تحويل الملف.", "File conversion completed."));
      } catch (error) {
        console.error("Large document conversion failed:", error);
        const code = error.message || "conversion-failed";
        const message = code === "not-authenticated"
          ? conversionText("يجب تسجيل الدخول أولًا لاستخدام تحويل الملفات الكبيرة.", "Sign in first to convert large files.")
          : code === "storage-not-configured"
            ? conversionText("مساحة التخزين الخاصة لم تُفعّل بعد.", "Private file storage has not been enabled yet.")
            : code === "sandbox-not-configured"
              ? conversionText("محرك التحويل غير مهيأ بعد. حاول مرة أخرى لاحقًا.", "The conversion engine is not configured yet. Try again later.")
              : code === "active-job-exists"
                ? conversionText("لديك ملف آخر قيد الرفع أو التحويل. أكمل العملية السابقة أولًا.", "You already have a file uploading or converting. Finish the previous job first.")
                : code === "upload-interrupted"
                  ? conversionText("انقطع الاتصال أثناء الرفع. اضغط بدء التحويل مرة أخرى وسيكمل من حيث توقف.", "The upload was interrupted. Press Start conversion again to resume where it stopped.")
                  : code === "too-many-pages"
                    ? conversionText("الملف طويل جدًا. الحد الأقصى 100 صفحة لملفات Word و150 صفحة لملفات PDF.", "The file is too long. Limits are 100 Word pages and 150 PDF pages.")
                    : code === "conversion-timeout"
                      ? conversionText("استغرق التحويل وقتًا أطول من المسموح. جرّب ملفًا أصغر أو أعد المحاولة.", "Conversion took longer than allowed. Try a smaller file or retry.")
                      : conversionText("تعذر تحويل الملف الكبير. تأكد من اتصال الإنترنت ثم أعد المحاولة.", "Could not convert the large file. Check your connection and try again.");
        convertStatus.textContent = message;
        convertProgressText.textContent = message;
        announce(message, "error");
      } finally {
        convertButton.disabled = false;
      }
      return;
    }
    try {
      convertStatus.textContent = conversionText("جارٍ بدء التحويل…", "Starting conversion…");
      convertedBlob = toWord ? await convertPdfToWord(file) : await convertWordToPdf(file);
      const baseName = file.name.replace(/\.(pdf|docx)$/i, "");
      convertedName = baseName + (toWord ? ".docx" : ".pdf");
      convertDownload.disabled = false;
      convertShare.disabled = false;
      convertStatus.textContent = conversionText("اكتمل التحويل بنجاح. يمكنك تنزيل الملف أو مشاركته.", "Conversion completed. You can download or share the file.");
      announce(conversionText("اكتمل تحويل الملف.", "File conversion completed."));
    } catch (error) {
      console.error("Document conversion failed:", error);
      const message = error.message === "too-many-pages"
        ? conversionText("الملف طويل جدًا. الحد الأقصى 100 صفحة لملفات Word و150 صفحة لملفات PDF.", "The file is too long. Limits are 100 Word pages and 150 PDF pages.")
        : error.message === "library-load"
          ? conversionText("تعذر تحميل مكتبة التحويل. تحقق من اتصال الإنترنت وحاول مجددًا.", "Could not load the conversion library. Check your internet connection and try again.")
          : conversionText("تعذر تحويل هذا الملف. قد يكون محميًا أو يحتوي على عناصر غير مدعومة.", "Could not convert this file. It may be protected or contain unsupported elements.");
      convertStatus.textContent = message;
      announce(message, "error");
    } finally {
      convertButton.disabled = false;
    }
  });
  convertDownload.addEventListener("click", () => {
    if (convertedDownloadUrl) {
      const link = document.createElement("a");
      link.href = convertedDownloadUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      return;
    }
    if (!convertedBlob) return;
    const url = URL.createObjectURL(convertedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = convertedName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  convertShare.addEventListener("click", async () => {
    if (convertedDownloadUrl) {
      try {
        if (navigator.share) {
          await navigator.share({ title:convertedName, text:conversionText("رابط الملف الناتج من مرسال", "Converted file from Mersal"), url:convertedDownloadUrl });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(convertedDownloadUrl);
          announce(conversionText("تم نسخ رابط الملف.", "File link copied."));
        } else {
          convertStatus.textContent = conversionText("تعذرت المشاركة التلقائية. انسخ رابط التنزيل من المتصفح.", "Automatic sharing is unavailable. Copy the download link from your browser.");
        }
      } catch (error) {
        if (error.name !== "AbortError") convertStatus.textContent = conversionText("تعذرت مشاركة الرابط. يمكنك تنزيل الملف بدلًا من ذلك.", "Could not share the link. You can download the file instead.");
      }
      return;
    }
    if (!convertedBlob) return;
    const file = new File([convertedBlob], convertedName, { type:convertedName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) {
        await navigator.share({ files:[file], title:convertedName });
        announce(conversionText("تم فتح قائمة مشاركة الملف.", "File sharing opened."));
      } else {
        convertStatus.textContent = conversionText("المشاركة المباشرة للملفات غير مدعومة في هذا المتصفح. استخدم زر التنزيل.", "Direct file sharing is not supported in this browser. Use Download instead.");
      }
    } catch (error) {
      if (error.name !== "AbortError") convertStatus.textContent = conversionText("تعذرت مشاركة الملف. يمكنك تنزيله بدلًا من ذلك.", "Could not share the file. You can download it instead.");
    }
  });

  localizeTools();

  return { closeTool, openTool };
}
