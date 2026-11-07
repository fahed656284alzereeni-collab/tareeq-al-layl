/**
 * Mersal browser Supabase client.
 *
 * This module contains only the project's public publishable key.
 * Never add a Supabase secret/service-role key to a browser file.
 *
 * This is the shared client foundation for the migration branch. Existing
 * pages still use Firebase until their auth/session and data flows are
 * migrated and tested; importing this file alone does not switch the app.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://dzrtzctppgogvhoychrf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IxR9SHXmXlbMbvP4l6cDFg_jzbgfsqI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  },
  global: {
    headers: {
      "X-Client-Info": "mersal-web-migration"
    }
  }
});

/**
 * Start Google OAuth and return the user to the chat page after callback.
 * Supabase Dashboard must have the matching redirect URL allow-listed.
 */
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/chat.html", window.location.origin).toString()
    }
  });
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getAccessToken() {
  const session = await getCurrentSession();
  return session?.access_token ?? null;
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
