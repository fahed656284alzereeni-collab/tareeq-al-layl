// Shared Supabase client. The small auth bootstrap imports this module before
// the main application so session restoration can overlap with app initialization.
let createClient;
try {
  ({ createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm"));
} catch (primaryCdnError) {
  console.warn("Primary Supabase module CDN failed; trying fallback:", primaryCdnError);
  try {
    ({ createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.0"));
  } catch (fallbackCdnError) {
    const startupStatus = document.querySelector("#status");
    const startupRetry = document.querySelector("#startup-retry");
    if (startupStatus) startupStatus.textContent = "تعذر تحميل خدمة تسجيل الدخول. أعد المحاولة بعد قليل.";
    if (startupRetry) startupRetry.hidden = false;
    console.error("Both Supabase module CDNs failed:", fallbackCdnError);
    throw fallbackCdnError;
  }
}

const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});
