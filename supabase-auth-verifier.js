"use strict";

/**
 * Server-side Supabase Auth token verifier.
 * Staged only: existing Firebase-backed routes are not switched by this module.
 * Tokens are verified by Supabase Auth getUser(), never decoded and trusted locally.
 */
const { createClient } = require("@supabase/supabase-js");

function extractBearerToken(request) {
  const value = String(request?.headers?.authorization || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function createSupabaseAuthVerifier(options = {}) {
  const env = options.env || process.env;
  const createClientImpl = options.createClient || createClient;
  let client = null;

  function getClient() {
    if (client) return client;
    const url = String(env.SUPABASE_URL || "").trim();
    const apiKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
    if (!url || !apiKey) {
      const error = new Error("Supabase Auth verifier is not configured.");
      error.code = "SUPABASE_AUTH_NOT_CONFIGURED";
      throw error;
    }
    client = createClientImpl(url, apiKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    return client;
  }

  async function verifyAccessToken(accessToken) {
    const token = String(accessToken || "").trim();
    if (!token) {
      const error = new Error("Authentication required.");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    const { data, error } = await getClient().auth.getUser(token);
    if (error || !data?.user?.id) {
      const invalid = new Error("Invalid or expired Supabase access token.");
      invalid.code = "AUTH_INVALID";
      throw invalid;
    }
    const user = data.user;
    return Object.freeze({
      uid: user.id,
      email: String(user.email || "").trim().toLowerCase(),
      emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
      user
    });
  }

  async function verifyRequest(request) {
    const token = extractBearerToken(request);
    if (!token) {
      const error = new Error("Authentication required.");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    return verifyAccessToken(token);
  }

  return Object.freeze({ verifyAccessToken, verifyRequest });
}

module.exports = { createSupabaseAuthVerifier, extractBearerToken };
