import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  }
});

const status = document.querySelector("#status");
const googleButton = document.querySelector("#google-login");
const logoutButton = document.querySelector("#logout");
const account = document.querySelector("#account");

function announce(message, kind = "info") {
  status.textContent = message;
  status.dataset.kind = kind;
}

function showUser(user) {
  if (!user) {
    account.textContent = "لم يتم تسجيل الدخول";
    logoutButton.hidden = true;
    googleButton.hidden = false;
    return;
  }
  account.textContent = user.email || "تم تسجيل الدخول بحساب Google";
  logoutButton.hidden = false;
  googleButton.hidden = true;
}

googleButton.addEventListener("click", async () => {
  googleButton.disabled = true;
  announce("جاري تحويلك إلى Google…");
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) throw error;
  } catch (error) {
    announce("تعذر بدء تسجيل الدخول: " + (error?.message || "خطأ غير معروف"), "error");
    googleButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  if (error) announce("تعذر تسجيل الخروج: " + error.message, "error");
  else announce("تم تسجيل الخروج.");
  logoutButton.disabled = false;
});

supabase.auth.onAuthStateChange((_event, session) => {
  showUser(session?.user ?? null);
  if (session?.user) announce("تم تسجيل الدخول بنجاح.");
});

const { data, error } = await supabase.auth.getSession();
if (error) announce("تعذر التحقق من الجلسة: " + error.message, "error");
showUser(data?.session?.user ?? null);

if (new URLSearchParams(window.location.search).has("error")) {
  const reason = new URLSearchParams(window.location.search).get("error_description");
  announce("فشل تسجيل الدخول: " + (reason || "رفض مزود تسجيل الدخول الطلب"), "error");
}
