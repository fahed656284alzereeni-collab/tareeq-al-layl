"use strict";

const { createClient } = require("@supabase/supabase-js");

function configurationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Creates a request-scoped client that carries the caller's verified access
 * token. Database queries made through this client remain subject to RLS.
 * Never pass a service/secret key here.
 */
function createSupabaseUserClient(accessToken, options = {}) {
  const env = options.env || process.env;
  const createClientImpl = options.createClient || createClient;
  const token = String(accessToken || "").trim();
  if (!token) throw configurationError("A Supabase access token is required.", "AUTH_REQUIRED");

  const url = String(env.SUPABASE_URL || "").trim();
  const apiKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !apiKey) {
    throw configurationError("Supabase user database access is not configured.", "SUPABASE_USER_CLIENT_NOT_CONFIGURED");
  }

  return createClientImpl(url, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: "Bearer " + token
      }
    }
  });
}

/**
 * Creates a server-only elevated client for trusted background/admin work.
 * Do not use this client to serve ordinary user requests; use the caller's
 * access token with createSupabaseUserClient so RLS remains in force.
 */
function createSupabaseAdminClient(options = {}) {
  const env = options.env || process.env;
  const createClientImpl = options.createClient || createClient;
  const url = String(env.SUPABASE_URL || "").trim();
  const secretKey = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !secretKey) {
    throw configurationError("Supabase server secret is not configured.", "SUPABASE_ADMIN_CLIENT_NOT_CONFIGURED");
  }

  return createClientImpl(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

module.exports = { createSupabaseUserClient, createSupabaseAdminClient };
