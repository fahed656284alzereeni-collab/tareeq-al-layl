"use strict";

const PROFILE_COLUMNS = "id,username,display_name,bio,avatar_url,created_at,updated_at";

function validateDisplayName(value) {
  const name = String(value ?? "").trim();
  if (name.length < 2 || name.length > 30) {
    const error = new Error("Display name must contain between 2 and 30 characters.");
    error.code = "PROFILE_NAME_INVALID";
    throw error;
  }
  return name;
}

function validateBio(value) {
  const bio = String(value ?? "").trim();
  if (bio.length > 200) {
    const error = new Error("Profile bio cannot exceed 200 characters.");
    error.code = "PROFILE_BIO_TOO_LONG";
    throw error;
  }
  return bio;
}

function createSupabaseProfileRepository(client) {
  if (!client || typeof client.from !== "function") {
    throw new TypeError("A Supabase user-scoped client is required.");
  }

  async function getProfile(userId) {
    const id = String(userId || "").trim();
    if (!id) throw new TypeError("A verified user id is required.");
    const { data, error } = await client
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function updateProfile(userId, input = {}) {
    const id = String(userId || "").trim();
    if (!id) throw new TypeError("A verified user id is required.");

    const update = {};
    if (Object.prototype.hasOwnProperty.call(input, "displayName")) {
      update.display_name = validateDisplayName(input.displayName);
    }
    if (Object.prototype.hasOwnProperty.call(input, "bio")) {
      update.bio = validateBio(input.bio);
    }
    if (Object.keys(update).length === 0) {
      const error = new Error("No profile fields were supplied.");
      error.code = "PROFILE_UPDATE_EMPTY";
      throw error;
    }

    const { data, error } = await client
      .from("profiles")
      .update(update)
      .eq("id", id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  return Object.freeze({ getProfile, updateProfile });
}

module.exports = { createSupabaseProfileRepository, PROFILE_COLUMNS, validateDisplayName, validateBio };
