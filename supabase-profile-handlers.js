"use strict";

const { createSupabaseUserClient } = require("./supabase-clients");
const { extractBearerToken } = require("./supabase-auth-verifier");
const { createSupabaseProfileRepository } = require("./supabase-profile-repository");

function createSupabaseProfileHandlers(options = {}) {
  const verifier = options.verifier;
  const createUserClient = options.createUserClient || createSupabaseUserClient;
  const assertNameAllowed = options.assertNameAllowed || (async () => {});
  if (!verifier || typeof verifier.verifyRequest !== "function") {
    throw new TypeError("A Supabase Auth verifier is required.");
  }

  async function context(req) {
    const identity = await verifier.verifyRequest(req);
    const client = createUserClient(extractBearerToken(req));
    return {
      identity,
      repository: createSupabaseProfileRepository(client)
    };
  }

  async function getProfile(req, res) {
    try {
      const { identity, repository } = await context(req);
      const profile = await repository.getProfile(identity.uid);
      if (!profile) return res.status(404).json({ success: false, code: "PROFILE_NOT_FOUND", message: "الملف الشخصي غير موجود." });
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json({
        success: true,
        profile: {
          id: profile.id,
          username: profile.username || "",
          playerName: profile.display_name || profile.username || "",
          bio: profile.bio || "",
          avatarUrl: profile.avatar_url || ""
        }
      });
    } catch (error) {
      const status = error.code === "AUTH_REQUIRED" || error.code === "AUTH_INVALID" ? 401 :
        error.code === "SUPABASE_AUTH_NOT_CONFIGURED" || error.code === "SUPABASE_USER_CLIENT_NOT_CONFIGURED" ? 503 : 500;
      return res.status(status).json({
        success: false,
        code: error.code || "PROFILE_READ_FAILED",
        message: status === 401 ? "يرجى تسجيل الدخول مجددًا." : "تعذر تحميل الملف الشخصي."
      });
    }
  }

  async function updateProfile(req, res) {
    try {
      const { identity, repository } = await context(req);
      const playerName = String(req.body?.playerName ?? "").trim();
      const bio = String(req.body?.bio ?? "").trim();
      if (playerName.length < 2 || playerName.length > 30) {
        return res.status(400).json({ success: false, code: "PROFILE_NAME_INVALID", message: "اسم المستخدم يجب أن يكون بين حرفين و30 حرفًا." });
      }
      if (bio.length > 200) {
        return res.status(400).json({ success: false, code: "PROFILE_BIO_TOO_LONG", message: "النبذة الشخصية لا يمكن أن تتجاوز 200 حرف." });
      }
      await assertNameAllowed(playerName);
      const profile = await repository.updateProfile(identity.uid, { displayName: playerName, bio });
      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        profile: {
          id: profile.id,
          username: profile.username || "",
          playerName: profile.display_name || playerName,
          bio: profile.bio || "",
          avatarUrl: profile.avatar_url || ""
        },
        message: "تم حفظ الملف الشخصي بنجاح."
      });
    } catch (error) {
      const status = error.code === "AUTH_REQUIRED" || error.code === "AUTH_INVALID" ? 401 :
        error.code === "PROFILE_NAME_INVALID" || error.code === "PROFILE_BIO_TOO_LONG" ? 400 :
        error.code === "SUPABASE_AUTH_NOT_CONFIGURED" || error.code === "SUPABASE_USER_CLIENT_NOT_CONFIGURED" ? 503 :
        error.status || 500;
      return res.status(status).json({
        success: false,
        code: error.code || "PROFILE_UPDATE_FAILED",
        message: status === 401 ? "يرجى تسجيل الدخول مجددًا." :
          status === 400 ? error.message : "تعذر حفظ الملف الشخصي."
      });
    }
  }

  return Object.freeze({ getProfile, updateProfile });
}

module.exports = { createSupabaseProfileHandlers };
