"use strict";

const crypto = require("crypto");
const { createSupabaseUserClient } = require("./supabase-clients");
const { extractBearerToken } = require("./supabase-auth-verifier");

function createSupabaseMediaHandlers(options = {}) {
  const verifier = options.verifier;
  const createUserClient = options.createUserClient || createSupabaseUserClient;
  const getStorage = options.getStorage;
  const assertMediaEnabled = options.assertMediaEnabled || (async () => {});
  if (!verifier || typeof verifier.verifyRequest !== "function") throw new TypeError("A Supabase Auth verifier is required.");
  if (typeof getStorage !== "function") throw new TypeError("A private media storage factory is required.");

  async function upload(req,res) {
    try {
      await assertMediaEnabled();
      const identity = await verifier.verifyRequest(req);
      const token = extractBearerToken(req);
      const client = createUserClient(token);
      const conversationId = String(req.headers["x-conversation-id"] || "").trim();
      const mimeType = String(req.headers["x-file-type"] || "application/octet-stream").trim().slice(0,150);
      let fileName = "file";
      try { fileName = decodeURIComponent(String(req.headers["x-file-name"] || "file")); } catch (_) {}
      fileName = fileName.replace(/[\\/\\\\]/g,"_").replace(/[\\u0000-\\u001f]/g,"").slice(0,180) || "file";
      if (!conversationId || !Buffer.isBuffer(req.body) || req.body.length===0) {
        return res.status(400).json({success:false,code:"UPLOAD_INPUT_INVALID",message:"بيانات الملف أو المحادثة غير مكتملة."});
      }
      if (req.body.length > 50*1024*1024) {
        return res.status(413).json({success:false,code:"UPLOAD_TOO_LARGE",message:"الحد الأقصى لحجم الملف 50 ميغابايت."});
      }
      const { data: membership, error: membershipError } = await client
        .from("conversation_members")
        .select("conversation_id")
        .eq("conversation_id",conversationId)
        .eq("user_id",identity.uid)
        .is("left_at",null)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return res.status(403).json({success:false,code:"CONVERSATION_ACCESS_DENIED",message:"غير مصرح برفع ملف إلى هذه المحادثة."});
      const { data: blocked, error: blockError } = await client.rpc("is_direct_conversation_blocked",{p_conversation_id:conversationId});
      if (blockError) throw blockError;
      if (blocked) return res.status(403).json({success:false,code:"CONVERSATION_BLOCKED",message:"لا يمكن مشاركة الملفات بسبب إعدادات الحظر."});
      const storagePath = "conversations/"+conversationId+"/"+identity.uid+"/"+crypto.randomUUID();
      const storage = getStorage().storage.from("conversation-media");
      const {error:uploadError}=await storage.upload(storagePath,req.body,{contentType:mimeType,upsert:false,cacheControl:"3600"});
      if(uploadError)throw uploadError;
      const {data:signed,error:signedError}=await storage.createSignedUrl(storagePath,31536000);
      if(signedError) {
        await storage.remove([storagePath]).catch(()=>{});
        throw signedError;
      }
      res.set("Cache-Control","no-store");
      return res.json({success:true,attachment:{
        name:fileName,type:mimeType,size:req.body.length,url:signed.signedUrl,storagePath
      }});
    } catch(error) {
      const status = error.code==="AUTH_REQUIRED"||error.code==="AUTH_INVALID" ? 401 :
        error.code==="SUPABASE_AUTH_NOT_CONFIGURED"||error.code==="SUPABASE_USER_CLIENT_NOT_CONFIGURED" ? 503 :
        error.status && Number.isInteger(error.status) ? error.status : 500;
      return res.status(status).json({
        success:false,code:error.code||"MEDIA_UPLOAD_FAILED",
        message:status===401?"يرجى تسجيل الدخول مجددًا.":status===403?"غير مصرح برفع هذا الملف.":"تعذر رفع الملف حاليًا."
      });
    }
  }

  return Object.freeze({upload});
}

module.exports = {createSupabaseMediaHandlers};
