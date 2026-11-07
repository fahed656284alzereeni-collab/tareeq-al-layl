import { createClient } from "@supabase/supabase-js";
import "./style.css";

const SUPABASE_URL = "https://dzrtzctppgogvhoychrf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IxR9SHXmXlbMbvP4l6cDFg_jzbgfsqI";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const app = document.querySelector("#app");
let session = null;
let profile = null;
let activeConversation = null;
let messageChannel = null;
let conversationsChannel = null;
let busy = false;

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

function announce(message, kind = "info") {
  const node = document.querySelector("#status");
  if (node) {
    node.textContent = message;
    node.dataset.kind = kind;
  }
}

function shell(content) {
  app.innerHTML = content;
}

function loading(message = "جارٍ التحميل…") {
  shell(`<main class="boot" aria-live="polite"><h1>مرسال</h1><p>${escapeHTML(message)}</p></main>`);
}

function renderLogin() {
  shell(`
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="welcome-title">
        <p class="eyebrow">مساحة للمحادثات الخاصة</p>
        <h1 id="welcome-title">مرسال</h1>
        <p class="intro">تواصل برسائلك الخاصة، ببساطة وهدوء.</p>
        <button id="google-login" class="primary" type="button">المتابعة باستخدام Google</button>
        <p id="status" class="status" role="status" aria-live="polite">سجّل الدخول للبدء.</p>
        <p class="small-note">لن نطلب رقم هاتفك أو رمز SMS لتسجيل الدخول.</p>
      </section>
    </main>
  `);
  document.querySelector("#google-login").addEventListener("click", async () => {
    const button = document.querySelector("#google-login");
    button.disabled = true;
    announce("جارٍ تحويلك إلى Google…");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      announce(`تعذر بدء تسجيل الدخول: ${error.message}`, "error");
      button.disabled = false;
    }
  });
}

async function loadProfile() {
  const { data, error } = await supabase.from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("id", session.user.id).maybeSingle();
  if (error) throw error;
  profile = data;
  if (!profile) throw new Error("لم يتم إنشاء ملف الحساب تلقائيًا. يلزم فحص إعداد إنشاء الملف في قاعدة البيانات.");
}

function renderProfileSetup() {
  shell(`
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="profile-title">
        <p class="eyebrow">خطوة واحدة قبل البدء</p>
        <h1 id="profile-title">ملفك في مرسال</h1>
        <p class="intro">اختر اسمًا ظاهرًا واسم مستخدم يستطيع الآخرون البحث عنك به.</p>
        <form id="profile-form" class="search-form">
          <label for="display-name">الاسم الظاهر</label>
          <input id="display-name" name="display_name" maxlength="40" required autocomplete="name" value="${escapeHTML(profile?.display_name || "")}" />
          <label for="username">اسم المستخدم بالإنجليزية</label>
          <input id="username" name="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required autocomplete="username" value="${escapeHTML(profile?.username || "")}" aria-describedby="username-help" />
          <p id="username-help" class="small-note">من 3 إلى 24 حرفًا أو رقمًا أو شرطة سفلية، دون مسافات.</p>
          <button class="primary" type="submit">حفظ ومتابعة</button>
        </form>
        <p id="status" class="status" role="status" aria-live="polite">هذه البيانات تساعد الآخرين في العثور عليك.</p>
      </section>
    </main>
  `);
  document.querySelector("#profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const display_name = form.display_name.value.trim();
    const username = form.username.value.trim();
    const button = form.querySelector("button");
    if (display_name.length < 2 || display_name.length > 40) {
      announce("الاسم الظاهر يجب أن يكون بين حرفين و40 حرفًا.");
      form.display_name.focus();
      return;
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      announce("اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا أو رقمًا أو شرطة سفلية.");
      form.username.focus();
      return;
    }
    button.disabled = true;
    announce("جارٍ حفظ ملفك…");
    const { data, error } = await supabase.from("profiles")
      .update({ display_name, username, updated_at: new Date().toISOString() })
      .eq("id", session.user.id)
      .select("id, username, display_name, avatar_url")
      .single();
    button.disabled = false;
    if (error) {
      announce(error.code === "23505" ? "اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر." : `تعذر حفظ الملف: ${error.message}`, "error");
      return;
    }
    profile = data;
    renderApp();
    announce("تم حفظ ملفك. أهلًا بك في مرسال.");
  });
  document.querySelector("#display-name").focus();
}

function renderApp() {
  shell(`
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="مرسال، الصفحة الرئيسية">مرسال</a>
        <div class="account">
          <span class="account-name">${escapeHTML(profile?.display_name || profile?.username || session.user.email || "حسابي")}</span>
          <button id="sign-out" class="quiet" type="button">تسجيل الخروج</button>
        </div>
      </header>
      <main class="workspace">
        <section class="side-panel" aria-labelledby="people-title">
          <h1 id="people-title">ابدأ محادثة</h1>
          <p class="muted">ابحث باسم المستخدم أو الاسم الظاهر.</p>
          <form id="search-form" class="search-form">
            <label for="people-search">البحث عن مستخدم</label>
            <input id="people-search" name="q" type="search" autocomplete="off" maxlength="40" placeholder="اكتب اسم المستخدم" />
            <button class="primary" type="submit">بحث</button>
          </form>
          <div id="search-results" class="results" aria-live="polite"></div>
          <hr />
          <h2>محادثاتك</h2>
          <div id="conversation-list" class="results" aria-live="polite"><p class="muted">جارٍ تحميل المحادثات…</p></div>
        </section>
        <section class="chat-panel" aria-labelledby="chat-title">
          <div id="chat-empty" class="empty-state">
            <h2 id="chat-title">مرحبًا بك في مرسال</h2>
            <p>اختر محادثة أو ابحث عن شخص لبدء مراسلته.</p>
          </div>
          <div id="chat-view" hidden>
            <div class="chat-heading">
              <button id="back-to-list" class="quiet back-button" type="button">رجوع إلى المحادثات</button>
              <h2 id="chat-person">المحادثة</h2>
            </div>
            <div id="messages" class="messages" role="log" aria-label="الرسائل" aria-live="polite" aria-relevant="additions text"></div>
            <form id="send-form" class="send-form">
              <label for="message-input">اكتب رسالتك</label>
              <textarea id="message-input" rows="2" maxlength="10000" required placeholder="اكتب رسالة…"></textarea>
              <button class="primary" type="submit">إرسال الرسالة</button>
            </form>
          </div>
        </section>
      </main>
      <p id="status" class="global-status" role="status" aria-live="polite"></p>
    </div>
  `);

  document.querySelector("#sign-out").addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
  document.querySelector("#search-form").addEventListener("submit", searchPeople);
  document.querySelector("#send-form").addEventListener("submit", sendMessage);
  document.querySelector("#back-to-list").addEventListener("click", closeConversation);
  loadConversations();
  subscribeToConversationChanges();
}

async function searchPeople(event) {
  event.preventDefault();
  const rawQuery = document.querySelector("#people-search").value.trim().replace(/^@/, "");
  // Remove PostgREST filter syntax and LIKE wildcards before interpolating a search value.
  const query = rawQuery.replace(/[^\\p{L}\\p{N}\\s-]/gu, "").trim();
  const results = document.querySelector("#search-results");
  if (query.length < 2) {
    results.innerHTML = '<p class="muted">اكتب حرفين على الأقل للبحث.</p>';
    return;
  }
  results.innerHTML = '<p class="muted">جارٍ البحث…</p>';
  const { data, error } = await supabase.from("profiles")
    .select("id, username, display_name")
    .neq("id", session.user.id)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order("username", { ascending: true })
    .limit(20);
  if (error) {
    results.innerHTML = '<p class="error">تعذر البحث عن المستخدمين.</p>';
    announce(error.message, "error");
    return;
  }
  if (!data?.length) {
    results.innerHTML = '<p class="muted">لم نعثر على مستخدم بهذا الاسم.</p>';
    return;
  }
  results.innerHTML = data.map(person => `
    <button class="person-row" type="button" data-user-id="${escapeHTML(person.id)}">
      <span class="person-name">${escapeHTML(person.display_name || person.username || "مستخدم")}</span>
      <span class="person-handle">@${escapeHTML(person.username || "بدون_اسم")}</span>
      <span class="person-action">بدء محادثة</span>
    </button>
  `).join("");
  results.querySelectorAll("[data-user-id]").forEach(button => {
    button.addEventListener("click", () => startConversation(button.dataset.userId));
  });
}

async function startConversation(otherUserId) {
  if (!otherUserId || otherUserId === session.user.id || busy) return;
  busy = true;
  try {
    const [userOne, userTwo] = [session.user.id, otherUserId].sort();
    let { data: conversation, error } = await supabase.from("conversations")
      .select("id, user_one, user_two, created_at")
      .eq("user_one", userOne).eq("user_two", userTwo).maybeSingle();
    if (error) throw error;
    if (!conversation) {
      const created = await supabase.from("conversations")
        .insert({ user_one: userOne, user_two: userTwo })
        .select("id, user_one, user_two, created_at").single();
      if (created.error && created.error.code === "23505") {
        const retry = await supabase.from("conversations").select("id, user_one, user_two, created_at")
          .eq("user_one", userOne).eq("user_two", userTwo).single();
        if (retry.error) throw retry.error;
        conversation = retry.data;
      } else {
        if (created.error) throw created.error;
        conversation = created.data;
      }
    }
    const { data: otherProfile, error: profileError } = await supabase.from("profiles")
      .select("id, username, display_name").eq("id", otherUserId).single();
    if (profileError) throw profileError;
    await openConversation(conversation, otherProfile);
    await loadConversations();
  } catch (error) {
    announce(`تعذر فتح المحادثة: ${error.message}`, "error");
  } finally {
    busy = false;
  }
}

async function loadConversations() {
  const list = document.querySelector("#conversation-list");
  if (!list) return;
  const { data, error } = await supabase.from("conversations")
    .select("id, user_one, user_two, created_at")
    .or(`user_one.eq.${session.user.id},user_two.eq.${session.user.id}`)
    .order("created_at", { ascending: false }).limit(50);
  if (error) {
    list.innerHTML = '<p class="error">تعذر تحميل المحادثات.</p>';
    return;
  }
  if (!data?.length) {
    list.innerHTML = '<p class="muted">لا توجد محادثات بعد. ابحث عن شخص للبدء.</p>';
    return;
  }
  const otherIds = data.map(row => row.user_one === session.user.id ? row.user_two : row.user_one);
  const { data: people, error: peopleError } = await supabase.from("profiles")
    .select("id, username, display_name").in("id", otherIds);
  if (peopleError) {
    list.innerHTML = '<p class="error">تعذر تحميل أسماء المستخدمين.</p>';
    return;
  }
  const peopleById = new Map((people || []).map(person => [person.id, person]));
  list.innerHTML = data.map(row => {
    const otherId = row.user_one === session.user.id ? row.user_two : row.user_one;
    const person = peopleById.get(otherId) || {};
    return `<button class="person-row conversation-row" type="button" data-conversation-id="${escapeHTML(row.id)}" data-user-id="${escapeHTML(otherId)}">
      <span class="person-name">${escapeHTML(person.display_name || person.username || "محادثة")}</span>
      <span class="person-handle">@${escapeHTML(person.username || "مستخدم")}</span>
    </button>`;
  }).join("");
  list.querySelectorAll("[data-conversation-id]").forEach(button => {
    button.addEventListener("click", async () => {
      const row = data.find(item => item.id === button.dataset.conversationId);
      const person = peopleById.get(button.dataset.userId);
      if (row && person) await openConversation(row, person);
    });
  });
}

async function openConversation(conversation, person) {
  activeConversation = conversation;
  document.querySelector(".app-shell").classList.add("chat-open");
  document.querySelector("#chat-empty").hidden = true;
  document.querySelector("#chat-view").hidden = false;
  document.querySelector("#chat-person").textContent = person.display_name || person.username || "محادثة";
  const messages = document.querySelector("#messages");
  messages.innerHTML = '<p class="muted">جارٍ تحميل الرسائل…</p>';
  if (messageChannel) await supabase.removeChannel(messageChannel);

  // Subscribe first, then fetch history so a message cannot slip between the two.
  messageChannel = supabase.channel(`messages:${conversation.id}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: `conversation_id=eq.${conversation.id}`
    }, payload => appendMessage(payload.new));
  await new Promise((resolve, reject) => {
    messageChannel.subscribe(status => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error("تعذر الاتصال الفوري بالمحادثة. تحقق من اتصال الإنترنت ثم أعد المحاولة."));
      }
    });
  });
  await loadMessages();
  document.querySelector("#message-input").focus();
}

async function loadMessages() {
  const { data, error } = await supabase.from("messages")
    .select("id, conversation_id, sender_id, body, created_at, read_at")
    .eq("conversation_id", activeConversation.id)
    .order("created_at", { ascending: true }).limit(200);
  const node = document.querySelector("#messages");
  if (error) {
    node.innerHTML = '<p class="error">تعذر تحميل الرسائل.</p>';
    announce(error.message, "error");
    return;
  }
  node.innerHTML = "";
  (data || []).forEach(appendMessage);
  node.scrollTop = node.scrollHeight;
}

function appendMessage(message) {
  if (!activeConversation || message.conversation_id !== activeConversation.id) return;
  if (document.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`)) return;
  const node = document.createElement("article");
  node.className = `message ${message.sender_id === session.user.id ? "mine" : "theirs"}`;
  node.dataset.messageId = message.id;
  const time = new Date(message.created_at).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "short" });
  node.innerHTML = `<p>${escapeHTML(message.body)}</p><time datetime="${escapeHTML(message.created_at)}">${escapeHTML(time)}</time>`;
  document.querySelector("#messages").append(node);
  node.scrollIntoView({ block: "end", behavior: "smooth" });
}

async function sendMessage(event) {
  event.preventDefault();
  if (!activeConversation || busy) return;
  const input = document.querySelector("#message-input");
  const body = input.value.trim();
  if (!body) return;
  busy = true;
  const button = document.querySelector("#send-form button");
  button.disabled = true;
  const { error } = await supabase.from("messages").insert({
    conversation_id: activeConversation.id,
    sender_id: session.user.id,
    body
  });
  if (error) {
    announce(`تعذر إرسال الرسالة: ${error.message}`, "error");
  } else {
    input.value = "";
    announce("تم إرسال الرسالة.");
  }
  button.disabled = false;
  busy = false;
  input.focus();
}

function closeConversation() {
  activeConversation = null;
  if (messageChannel) supabase.removeChannel(messageChannel);
  messageChannel = null;
  document.querySelector(".app-shell").classList.remove("chat-open");
  document.querySelector("#chat-view").hidden = true;
  document.querySelector("#chat-empty").hidden = false;
  document.querySelector("#people-search").focus();
}

function subscribeToConversationChanges() {
  if (conversationsChannel) supabase.removeChannel(conversationsChannel);
  conversationsChannel = supabase.channel("my-conversations")
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, loadConversations)
    .subscribe();
}

async function boot() {
  loading();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    renderLogin();
    announce(error.message, "error");
    return;
  }
  session = data.session;
  if (!session) {
    renderLogin();
    return;
  }
  try {
    await loadProfile();
    if (!profile.username || !profile.display_name) {
      renderProfileSetup();
      return;
    }
    renderApp();
  } catch (profileError) {
    shell(`<main class="boot"><h1>مرسال</h1><p class="error" role="alert">${escapeHTML(profileError.message)}</p><button id="retry" class="primary">إعادة المحاولة</button></main>`);
    document.querySelector("#retry").addEventListener("click", boot);
  }
}

supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
  if (!session) {
    profile = null;
    activeConversation = null;
    if (messageChannel) supabase.removeChannel(messageChannel);
    if (conversationsChannel) supabase.removeChannel(conversationsChannel);
    renderLogin();
  }
});

boot();
