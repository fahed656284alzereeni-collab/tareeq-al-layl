const express = require("express");

const http = require("http");

const path = require("path");
const fs = require("fs");

const { Server } = require("socket.io");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");
const crypto = require("crypto");
const { createSupabaseAuthVerifier } = require("./supabase-auth-verifier");
const { createSupabaseUserClient } = require("./supabase-clients");
const { createSupabaseProfileHandlers } = require("./supabase-profile-handlers");
const { createSupabaseChatHandlers } = require("./supabase-chat-handlers");

// Prefer keyless Google Workload Identity Federation when Render configures ADC.
// Otherwise support a Render Secret File or the legacy JSON environment variable.
let credential;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
      "/etc/secrets/tareeq-al-layl-60be5c88a107.json";
    let serviceAccount;
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      throw new Error("No Google ADC, Firebase service-account secret file, or FIREBASE_SERVICE_ACCOUNT value was found.");
    }
    if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Firebase service-account JSON is missing required fields.");
    }
    credential = admin.credential.cert(serviceAccount);
  }
} catch (error) {
  console.error("Unable to configure Firebase Admin credentials:", error.message);
  process.exit(1);
}

admin.initializeApp({ credential });

// Supabase Storage is initialized lazily so the rest of Mersalo keeps working
// while the private storage secret is being configured in Render.
let mediaStorageClient = null;
function getMediaStorage() {
  const url = String(process.env.SUPABASE_URL || "").trim();
  const secretKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !secretKey) {
    throw new Error("Supabase private storage is not configured on the server.");
  }
  if (!mediaStorageClient) {
    mediaStorageClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  }
  return mediaStorageClient;
}


const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  // Tolerate brief mobile-network delays before declaring an idle socket disconnected.
  pingInterval: 25000,
  pingTimeout: 60000
});

// A user may be connected from more than one device or browser tab.
const connectedUsers = new Map();
const friendRequestLimits = new Map();
const globalVoiceCalls = new Map();
function activeVoiceCallFor(uid) { for (const call of globalVoiceCalls.values()) if (call.callerUid === uid || call.calleeUid === uid) return call; return null; }
// Cache user profiles briefly to avoid a Firestore read on every socket reconnect.
const profileCache = new Map();
const PROFILE_CACHE_TTL_MS = 30_000;

function addConnectedSocket(uid, socket) {
  if (!connectedUsers.has(uid)) connectedUsers.set(uid, new Set());
  connectedUsers.get(uid).add(socket);
}

function removeConnectedSocket(uid, socket) {
  const sockets = connectedUsers.get(uid);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) connectedUsers.delete(uid);
}

function getConnectedSocket(uid) {
  const sockets = connectedUsers.get(uid);
  return sockets ? [...sockets].find(client => client.connected) || null : null;
}

function onlinePlayerList() {
  const players = [];
  for (const [uid, sockets] of connectedUsers) {
    const client = [...sockets].find(item => item.connected);
    if (client) players.push({ uid, name: client.data.playerName });
  }
  return players;
}

// Best-effort multilingual name moderation. Normalize Unicode and common obfuscation before checking.
const INAPPROPRIATE_NAME_TERMS = [
  // Arabic
  "كس", "شرموط", "شرموطة", "قحبة", "منيوك", "منيوكة", "خول", "طيز", "زب", "متناك", "عاهرة", "كلب ابن",
  // English
  "fuck", "fucker", "motherfucker", "shithead", "bitch", "cunt", "nigger", "faggot", "whore", "slut", "rape",
  // Spanish / Portuguese
  "puta", "puto", "mierda", "joder", "caralho", "viado", "piranha",
  // French
  "putain", "merde", "salope", "connard", "encule",
  // German / Dutch
  "arschloch", "scheisse", "hure", "schlampe", "kankerhoer",
  // Russian / Ukrainian transliteration and Cyrillic
  "блядь", "сука", "хуй", "пизда", "ебать", "мудак",
  // Turkish
  "orospu", "siktir", "pic", "amk",
  // Italian
  "vaffanculo", "stronzo", "troia", "puttana",
  // Hindi / Urdu (common transliterations)
  "gaand", "chutiya", "bhenchod", "madarchod", "haramzada"
];
function normalizeNameForModeration(value) {
  return String(value || "").normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .toLocaleLowerCase()
    .replace(/[0@]/g, "o").replace(/[1!|]/g, "i").replace(/[3]/g, "e")
    .replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/[7]/g, "t")
    .replace(/[\s._*\-]+/g, "");
}
function inappropriateNameReason(value) {
  const normalized = normalizeNameForModeration(value);
  if (!normalized) return "";
  return INAPPROPRIATE_NAME_TERMS.find(term => normalized.includes(normalizeNameForModeration(term))) || "";
}
function assertAppropriateName(value) {
  if (inappropriateNameReason(value)) {
    throw new Error("هذا الاسم قد يحتوي على لفظ مسيء أو غير لائق. يرجى اختيار اسم آخر.");
  }
}

async function assertNameAllowed(value) {
  assertAppropriateName(value);
  const snap = await admin.firestore().collection("appSettings").doc("nameModeration").get();
  const terms = snap.exists && Array.isArray(snap.data().blockedTerms) ? snap.data().blockedTerms : [];
  const normalized = normalizeNameForModeration(value);
  if (terms.some(term => {
    const candidate = normalizeNameForModeration(term);
    return candidate && normalized.includes(candidate);
  })) throw new Error("هذا الاسم يحتوي على كلمة محظورة. يرجى اختيار اسم آخر.");
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("AUTH_REQUIRED"));
    const decoded = await admin.auth().verifyIdToken(token);
    let profileData;
    const cachedProfile = profileCache.get(decoded.uid);
    if (cachedProfile && cachedProfile.expiresAt > Date.now()) {
      profileData = cachedProfile.data;
    } else {
      const profile = await admin.firestore().collection("users").doc(decoded.uid).get();
      profileData = profile.exists ? profile.data() : {};
      profileCache.set(decoded.uid, { data: profileData, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
      if (profileCache.size > 1000) profileCache.delete(profileCache.keys().next().value);
    }
    if(profileData.suspendedUntil?.toMillis?.() && profileData.suspendedUntil.toMillis()<=Date.now()){
      await admin.auth().updateUser(decoded.uid,{disabled:false});
      await admin.firestore().collection("users").doc(decoded.uid).set({accountSuspended:false,accountStatus:"active",suspendedUntil:admin.firestore.FieldValue.delete(),accountStatusUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      profileData={...profileData,accountSuspended:false};
      profileCache.delete(decoded.uid);
    }
    if(profileData.accountSuspended===true)return next(new Error("ACCOUNT_SUSPENDED"));
    const systemSettings=await readSystemSettings();
    const isDeveloper=String(decoded.email||"").toLowerCase()===MERSALO_ADMIN_EMAIL&&decoded.email_verified===true;
    if(systemSettings.maintenance&&!isDeveloper)return next(new Error("MERSALO_MAINTENANCE"));
    const playerName = String(profileData.playerName || profileData.displayName || decoded.name || "مستخدم").trim().slice(0, 40);
    socket.data.uid = decoded.uid;
    socket.data.playerName = playerName;
    socket.data.email = String(decoded.email || "").trim().toLowerCase();
    socket.data.phoneNumber = "";
    next();
  } catch (error) {
    next(new Error("AUTH_INVALID"));
  }
});

// Automatically restore timed suspensions even if the user does not attempt to sign in.
let expiredSuspensionsWorkerRunning = false;
async function processExpiredAccountSuspensions() {
  if (expiredSuspensionsWorkerRunning) return;
  expiredSuspensionsWorkerRunning = true;
  try {
    const db = admin.firestore();
    const now = Date.now();
    const snap = await db.collection("users").where("accountSuspended", "==", true).limit(200).get();
    for (const userDoc of snap.docs) {
      const data = userDoc.data();
      const until = data.suspendedUntil && typeof data.suspendedUntil.toMillis === "function"
        ? data.suspendedUntil.toMillis() : 0;
      if (!until || until > now) continue;
      try {
        await admin.auth().updateUser(userDoc.id, { disabled: false });
        await db.runTransaction(async transaction => {
          const fresh = await transaction.get(userDoc.ref);
          if (!fresh.exists) return;
          const latest = fresh.data();
          const latestUntil = latest.suspendedUntil && typeof latest.suspendedUntil.toMillis === "function"
            ? latest.suspendedUntil.toMillis() : 0;
          if (latest.accountSuspended === true && latestUntil > 0 && latestUntil <= Date.now()) {
            transaction.set(userDoc.ref, {
              accountSuspended: false,
              accountStatus: "active",
              suspendedUntil: admin.firestore.FieldValue.delete(),
              accountSuspensionReason: admin.firestore.FieldValue.delete(),
              accountStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
        });
        profileCache.delete(userDoc.id);
      } catch (error) {
        console.error("Timed account reactivation failed:", { uid: userDoc.id, message: error.message });
      }
    }
  } catch (error) {
    console.error("Expired account suspension scan failed:", error.message);
  } finally {
    expiredSuspensionsWorkerRunning = false;
  }
}
setInterval(processExpiredAccountSuspensions, 60000);
processExpiredAccountSuspensions();

// Deliver scheduled text messages from Firestore, even when the sender closes the app.
const scheduledMessagesRef = admin.firestore().collection("scheduledMessages");
let scheduledWorkerRunning = false;
async function processScheduledMessages() {
  if (scheduledWorkerRunning) return;
  scheduledWorkerRunning = true;
  try {
    const db = admin.firestore();
    const due = await scheduledMessagesRef.orderBy("sendAt", "asc").limit(50).get();
    for (const scheduledDoc of due.docs) {
      const result = await db.runTransaction(async transaction => {
        const fresh = await transaction.get(scheduledDoc.ref);
        if (!fresh.exists) return null;
        const scheduled = fresh.data();
        const sendAt = scheduled.sendAt?.toMillis?.() || 0;
        if (!sendAt || sendAt > Date.now()) return null;
        const conversationRef = db.collection("conversations").doc(String(scheduled.conversationId || ""));
        const conversationSnap = await transaction.get(conversationRef);
        if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(scheduled.senderUid)) {
          transaction.delete(scheduledDoc.ref);
          return null;
        }
        const conversation = conversationSnap.data();
        const messageRef = conversationRef.collection("messages").doc();
        const createdAt = admin.firestore.Timestamp.now();
        const message = { senderUid: scheduled.senderUid, senderName: scheduled.senderName || "مستخدم", text: String(scheduled.text || ""), createdAt };
        transaction.set(messageRef, message);
        transaction.update(conversationRef, { updatedAt: createdAt, lastMessage: message.text.slice(0, 120) });
        for (const memberUid of conversation.members || []) {
          transaction.delete(db.collection("users").doc(memberUid).collection("hiddenConversations").doc(conversationRef.id));
          transaction.delete(db.collection("users").doc(memberUid).collection("hiddenConversationContent").doc(conversationRef.id));
        }
        transaction.delete(scheduledDoc.ref);
        return { conversationId: conversationRef.id, members: conversation.members || [], message: { id: messageRef.id, senderUid: message.senderUid, senderName: message.senderName, text: message.text, createdAt: Date.now() } };
      });
      if (result) {
        for (const memberUid of result.members) {
          for (const client of connectedUsers.get(memberUid) || []) if (client.connected) client.emit("directMessageReceived", { conversationId: result.conversationId, message: result.message });
        }
      }
    }
  } catch (error) {
    console.error("Scheduled message worker error:", error.message);
  } finally {
    scheduledWorkerRunning = false;
  }
}
setInterval(processScheduledMessages, 15000);
processScheduledMessages();

io.on("connection", socket => {
  console.info("Socket connected", { uid: socket.data.uid, transport: socket.conn.transport.name });
  socket.conn.on("upgrade", transport => console.info("Socket transport upgraded", { uid: socket.data.uid, transport: transport.name }));
  addConnectedSocket(socket.data.uid, socket);
  io.emit("onlinePlayers", onlinePlayerList());
  socket.on("clientAckReceived", data => { console.info("Client acknowledged event reply", { uid: socket.data.uid, event: data?.event, success: data?.success }); });

  const usersRef = admin.firestore().collection("users");
  const db = admin.firestore();
  const conversationsRef = db.collection("conversations");

  // Voice-call signaling. Media never passes through this server; only WebRTC
  // offers, answers, and ICE candidates are relayed between authenticated users.
  const voiceCalls = globalVoiceCalls;
  socket.on("voiceCall:resume", () => {
    for (const call of voiceCalls.values()) {
      if (call.calleeUid !== socket.data.uid || call.state !== "ringing") continue;
      socket.data.voiceCallId = call.callId;
      socket.emit("voiceCall:incoming", { callId: call.callId, conversationId: call.conversationId, caller: { uid: call.callerUid, name: call.callerName || "مستخدم" } });
      if (call.offer) socket.emit("voiceCall:offer", { callId: call.callId, offer: call.offer });
      for (const queued of call.pendingCandidates.splice(0)) if (queued.fromUid === call.callerUid) socket.emit("voiceCall:signal", { callId: call.callId, candidate: queued.candidate });
    }
  });

  socket.on("voiceCall:start", async (data = {}, reply) => {
    try {
await assertFeatureEnabled("voiceCalls","هذه الميزة متوقفة مؤقتًا من إدارة مِرسالو.");
            const targetUid = String(data.targetUid || "");
      const conversationId = String(data.conversationId || "");
      if (!targetUid || targetUid === socket.data.uid || !conversationId) throw new Error("بيانات المكالمة غير مكتملة.");
      const conversationSnap = await conversationsRef.doc(conversationId).get();
      if (!conversationSnap.exists) throw new Error("المحادثة غير موجودة.");
      const conversation = conversationSnap.data();
      if (conversation.type === "group" || !(conversation.members || []).includes(socket.data.uid) || !(conversation.members || []).includes(targetUid)) {
        throw new Error("المكالمات الصوتية متاحة في المحادثات الفردية فقط.");
      }
      if (activeVoiceCallFor(socket.data.uid) || activeVoiceCallFor(targetUid)) throw new Error("أحد الطرفين مشغول بمكالمة أخرى.");
      const callId = require("crypto").randomUUID();
      const call = { callId, callerUid: socket.data.uid, callerName: socket.data.playerName, calleeUid: targetUid, conversationId, state: "ringing", createdAt: Date.now(), pendingCandidates: [] };
      voiceCalls.set(callId, call);
      socket.data.voiceCallId = callId;
      const caller = { uid: socket.data.uid, name: socket.data.playerName };
      const incoming = { callId, conversationId, caller };
      for (const client of connectedUsers.get(targetUid) || []) if (client.connected) client.emit("voiceCall:incoming", incoming);
      void createUserNotification(targetUid,{type:"incomingCall",title:"مكالمة واردة من "+socket.data.playerName,body:"لديك مكالمة صوتية واردة. اضغط لفتح مِرسالو والرد.",url:"chat.html?incomingCall=1",tag:"incoming-call-"+callId});
      call.timeout = setTimeout(() => { if (voiceCalls.get(callId) !== call || call.state !== "ringing") return; voiceCalls.delete(callId); for (const client of connectedUsers.get(call.callerUid) || []) { if (client.data.voiceCallId===callId) delete client.data.voiceCallId; if(client.connected)client.emit("voiceCall:ended",{callId,reason:"no-answer"}); } for (const client of connectedUsers.get(call.calleeUid) || []) if(client.data.voiceCallId===callId)delete client.data.voiceCallId; },45000);
      if (typeof reply === "function") reply({ success: true, callId });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر بدء المكالمة." });
    }
  });

  socket.on("voiceCall:offer", (data = {}) => {
    const call = voiceCalls.get(String(data.callId || ""));
    const offer = data.offer;
    if (!call || call.callerUid !== socket.data.uid || call.state !== "ringing" ||
        !offer || offer.type !== "offer" || typeof offer.sdp !== "string" || offer.sdp.length > 30000) return;
    call.offerReceived = true;
    call.offer = offer;
    for (const client of connectedUsers.get(call.calleeUid) || []) {
      if (client.connected) client.emit("voiceCall:offer", { callId: call.callId, offer });
    }
  });

  socket.on("voiceCall:accept", (data = {}, reply) => {
    const call = voiceCalls.get(String(data.callId || ""));
    const answer = data.answer;
    if (!call || call.calleeUid !== socket.data.uid || call.state !== "ringing" || !call.offerReceived ||
        !answer || answer.type !== "answer" || typeof answer.sdp !== "string" || answer.sdp.length > 30000) {
      if (typeof reply === "function") reply({ success: false, message: "انتهت صلاحية طلب المكالمة أو لم يصل عرض الاتصال بعد." });
      return;
    }
    call.state = "active";
    if(call.timeout)clearTimeout(call.timeout);
    socket.data.voiceCallId = call.callId;
    for (const client of connectedUsers.get(call.callerUid) || []) if (client.connected) client.emit("voiceCall:accepted", { callId: call.callId, answer });
    if (typeof reply === "function") reply({ success: true });
  });

  socket.on("voiceCall:signal", (data = {}) => {
    const call = voiceCalls.get(String(data.callId || ""));
    if (!call || !["ringing", "active"].includes(call.state)) return;
    const peerUid = call.callerUid === socket.data.uid ? call.calleeUid : call.calleeUid === socket.data.uid ? call.callerUid : null;
    if (!peerUid) return;
    const peer = connectedUsers.get(peerUid);
    const recipients = peer ? [...peer].filter(client => client.connected) : [];
    if (!recipients.length) { if (call.pendingCandidates.length < 100) call.pendingCandidates.push({ fromUid: socket.data.uid, candidate: data.candidate }); return; }
    for (const client of recipients) client.emit("voiceCall:signal", { callId: call.callId, candidate: data.candidate });
  });

  socket.on("voiceCall:end", (data = {}) => {
    const callId = String(data.callId || socket.data.voiceCallId || "");
    const call = voiceCalls.get(callId);
    if (!call || (call.callerUid !== socket.data.uid && call.calleeUid !== socket.data.uid)) return;
    voiceCalls.delete(callId);
    if(call.timeout)clearTimeout(call.timeout);
    for (const uid of [call.callerUid, call.calleeUid]) {
      const sessions = connectedUsers.get(uid);
      if (sessions) for (const client of sessions) {
        if (client.data.voiceCallId === callId) delete client.data.voiceCallId;
        if (client !== socket && client.connected) client.emit("voiceCall:ended", { callId, reason: data.reason || "ended" });
      }
    }
  });


  socket.on("startGroupConversation", async (data = {}, reply) => {
    try {
await assertFeatureEnabled("groupChats","هذه الميزة متوقفة مؤقتًا من إدارة مِرسالو.");
            const name = String(data.name || "").trim().slice(0, 50);
      const requested = Array.isArray(data.memberUids) ? [...new Set(data.memberUids.map(String))] : [];
      const memberUids = requested.filter(uid => uid && uid !== socket.data.uid).slice(0, 49);
      if (!name) throw new Error("اكتب اسمًا للمجموعة.");
      await assertNameAllowed(name);
      if (!memberUids.length) throw new Error("اختر شخصًا واحدًا على الأقل لإضافته.");
      const profiles = await db.getAll(...memberUids.map(uid => usersRef.doc(uid)));
      if (profiles.some(profile => !profile.exists || !profile.data().playerName)) throw new Error("تعذر العثور على أحد الحسابات المختارة.");
      const checks = await Promise.all(memberUids.flatMap(uid => [blockedRef(socket.data.uid, uid).get(), blockedRef(uid, socket.data.uid).get()]));
      if (checks.some(snap => snap.exists)) throw new Error("لا يمكن إضافة أحد المستخدمين بسبب إعدادات الحظر.");
      const members = [socket.data.uid, ...memberUids];
      const ref = conversationsRef.doc();
      const now = admin.firestore.FieldValue.serverTimestamp();
      await ref.set({ type: "group", groupName: name, createdBy: socket.data.uid, members, groupPermissions: { editInfo: "admins", addMembers: "admins" }, createdAt: now, updatedAt: now, lastMessage: "تم إنشاء المجموعة" });
      const payload = { id: ref.id, type: "group", groupName: name, displayName: name, members, createdBy: socket.data.uid, lastMessage: "تم إنشاء المجموعة" };
      // Confirm creation immediately after the conversation is safely stored.
      // Notifications are best-effort background work and must not block opening the group.
      if (typeof reply === "function") reply({ success: true, conversation: payload });
      void Promise.allSettled(memberUids.map(uid=>createUserNotification(uid,{type:"groupInvite",title:"إضافة إلى مجموعة",body:socket.data.playerName+" أضافك إلى مجموعة "+name,url:"chat.html?conversationId="+encodeURIComponent(ref.id),tag:"group-"+ref.id})));
      for (const uid of members) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId: ref.id });
      }
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إنشاء المجموعة." });
    }
  });

  socket.on("addGroupMembers", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const requested = Array.isArray(data.memberUids) ? [...new Set(data.memberUids.map(String))] : [];
      const ref = conversationsRef.doc(conversationId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بإدارة هذه المجموعة.");
      const group = snap.data();
      const permissions = group.groupPermissions || {};
      const canAdd = permissions.addMembers === "members" || group.createdBy === socket.data.uid || (group.moderatorUids || []).includes(socket.data.uid);
      if (!canAdd) throw new Error("إضافة الأعضاء متاحة للمشرفين فقط.");
      const currentMembers = snap.data().members || [];
      const newUids = requested.filter(uid => uid && !currentMembers.includes(uid)).slice(0, 49);
      if (!newUids.length) throw new Error("اختر أشخاصًا جددًا لإضافتهم.");
      if (currentMembers.length + newUids.length > 50) throw new Error("الحد الأقصى للمجموعة 50 عضوًا.");
      const profiles = await db.getAll(...newUids.map(uid => usersRef.doc(uid)));
      if (profiles.some(profile => !profile.exists || !profile.data().playerName)) throw new Error("تعذر العثور على أحد الحسابات المختارة.");
      const checks = await Promise.all(newUids.flatMap(uid => [blockedRef(socket.data.uid, uid).get(), blockedRef(uid, socket.data.uid).get()]));
      if (checks.some(s => s.exists)) throw new Error("لا يمكن إضافة أحد المستخدمين بسبب إعدادات الحظر.");
      await ref.update({ members: admin.firestore.FieldValue.arrayUnion(...newUids), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      await Promise.all(newUids.map(uid=>createUserNotification(uid,{type:"groupInvite",title:"إضافة إلى مجموعة",body:socket.data.playerName+" أضافك إلى مجموعة "+String(snap.data().groupName||"محادثة جماعية"),url:"chat.html?conversationId="+encodeURIComponent(conversationId),tag:"group-"+conversationId})));
      for (const uid of [...currentMembers, ...newUids]) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId });
      }
      if (typeof reply === "function") reply({ success: true, message: "تمت إضافة الأعضاء إلى المجموعة.", added: newUids.length });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذرت إضافة الأعضاء." });
    }
  });




  // Group administration: all permissions are checked again on the server.
  socket.on("renameGroup", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const name = String(data.name || "").trim().slice(0, 50);
      if (!name) throw new Error("اكتب اسمًا صالحًا للمجموعة.");
      await assertNameAllowed(name);
      const ref = conversationsRef.doc(conversationId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بتعديل هذه المجموعة.");
      const group = snap.data();
      const permissions = group.groupPermissions || {};
      const canEdit = permissions.editInfo === "members" || group.createdBy === socket.data.uid || (group.moderatorUids || []).includes(socket.data.uid);
      if (!canEdit) throw new Error("تعديل معلومات المجموعة متاح للمشرفين فقط.");
      await ref.update({ groupName: name, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      for (const uid of snap.data().members || []) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId });
      }
      if (typeof reply === "function") reply({ success: true, message: "تم تحديث اسم المجموعة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تعديل اسم المجموعة." });
    }
  });

  socket.on("updateGroupDetails", async (data = {}, reply) => {
    try {
      const conversationId=String(data.conversationId||"");
      const description=String(data.description||"").trim().slice(0,500);
      const announcement=String(data.announcement||"").trim().slice(0,500);
      const ref=conversationsRef.doc(conversationId);
      const snap=await ref.get();
      if(!snap.exists||snap.data().type!=="group"||!(snap.data().members||[]).includes(socket.data.uid))throw new Error("غير مصرح بتعديل هذه المجموعة.");
      const group=snap.data(),permissions=group.groupPermissions||{};
      const canEdit=permissions.editInfo==="members"||group.createdBy===socket.data.uid||(group.moderatorUids||[]).includes(socket.data.uid);
      if(!canEdit)throw new Error("تعديل معلومات المجموعة متاح للمالك والمشرفين فقط.");
      await ref.update({description,announcement,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
      for(const uid of group.members||[]){const sessions=connectedUsers.get(uid);if(sessions)for(const client of sessions)if(client.connected)client.emit("groupConversationUpdated",{conversationId});}
      if(typeof reply==="function")reply({success:true,message:"تم تحديث وصف المجموعة وإعلانها."});
    }catch(error){if(typeof reply==="function")reply({success:false,message:error.message||"تعذر تحديث معلومات المجموعة."});}
  });

  socket.on("updateGroupPermissions", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const editInfo = data.editInfo === "members" ? "members" : data.editInfo === "admins" ? "admins" : "";
      const addMembers = data.addMembers === "members" ? "members" : data.addMembers === "admins" ? "admins" : "";
      if (!editInfo || !addMembers) throw new Error("إعدادات الأذونات غير صالحة.");
      const ref = conversationsRef.doc(conversationId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بإدارة هذه المجموعة.");
      const group = snap.data();
      if (group.createdBy !== socket.data.uid && !(group.moderatorUids || []).includes(socket.data.uid)) throw new Error("المالك والمشرفون فقط يستطيعون تحديد أذونات المجموعة.");
      await ref.update({ groupPermissions: { editInfo, addMembers }, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      for (const uid of group.members || []) {
        // لا تُعد بناء واجهة المستخدم الذي حفظ الإذن أثناء تنفيذ الحفظ؛
        // فهذا العميل يحدّث حالته محليًا، بينما بقية الأعضاء يحتاجون إشعار التحديث.
        if (uid === socket.data.uid) continue;
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId });
      }
      if (typeof reply === "function") reply({ success: true, message: "تم حفظ أذونات المجموعة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تحديث أذونات المجموعة." });
    }
  });

  socket.on("setGroupModerator", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const targetUid = String(data.memberUid || "");
      const makeModerator = data.makeModerator === true;
      const ref = conversationsRef.doc(conversationId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بإدارة هذه المجموعة.");
      const group = snap.data();
      if (group.createdBy !== socket.data.uid) throw new Error("منشئ المجموعة فقط يستطيع تعيين المشرفين.");
      if (!targetUid || targetUid === group.createdBy || !(group.members || []).includes(targetUid)) throw new Error("العضو المحدد غير صالح.");
      const moderators = new Set(group.moderatorUids || []);
      if (makeModerator) moderators.add(targetUid); else moderators.delete(targetUid);
      await ref.update({ moderatorUids: [...moderators], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      for (const uid of group.members || []) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId });
      }
      if (typeof reply === "function") reply({ success: true, message: makeModerator ? "تم تعيين العضو مشرفًا." : "تم إلغاء صلاحية الإشراف." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تحديث صلاحية المشرف." });
    }
  });

  socket.on("removeGroupMember", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const targetUid = String(data.memberUid || "");
      const ref = conversationsRef.doc(conversationId);
      const result = await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بإدارة هذه المجموعة.");
        const group = snap.data();
        if (group.createdBy !== socket.data.uid && !(group.moderatorUids || []).includes(socket.data.uid)) throw new Error("غير مصرح لك بإزالة أعضاء هذه المجموعة.");
        if (!targetUid || targetUid === group.createdBy) throw new Error("لا يمكن إزالة منشئ المجموعة.");
        if (!(group.members || []).includes(targetUid)) throw new Error("هذا العضو لم يعد ضمن المجموعة.");
        transaction.update(ref, { members: admin.firestore.FieldValue.arrayRemove(targetUid), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { members: group.members.filter(uid => uid !== targetUid) };
      });
      for (const uid of result.members) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId });
      }
      const removedSessions = connectedUsers.get(targetUid);
      if (removedSessions) for (const client of removedSessions) if (client.connected) client.emit("directConversationDeleted", { conversationId });
      if (typeof reply === "function") reply({ success: true, message: "تمت إزالة العضو من المجموعة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذرت إزالة العضو." });
    }
  });

  socket.on("leaveGroup", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const ref = conversationsRef.doc(conversationId);
      const result = await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("أنت لست عضوًا في هذه المجموعة.");
        const group = snap.data();
        if (group.createdBy === socket.data.uid) throw new Error("منشئ المجموعة لا يمكنه مغادرتها. يمكنك حذف المجموعة بدلًا من ذلك.");
        transaction.update(ref, { members: admin.firestore.FieldValue.arrayRemove(socket.data.uid), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { members: group.members.filter(uid => uid !== socket.data.uid) };
      });
      for (const uid of result.members) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("groupConversationUpdated", { conversationId });
      }
      if (typeof reply === "function") reply({ success: true, message: "غادرت المجموعة بنجاح." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر مغادرة المجموعة." });
    }
  });

  socket.on("deleteGroup", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const ref = conversationsRef.doc(conversationId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بحذف هذه المجموعة.");
      const members = snap.data().members || [];
      if (snap.data().createdBy !== socket.data.uid) throw new Error("منشئ المجموعة فقط يستطيع حذفها.");
      await deleteConversationMessages(ref);
      await ref.delete();
      for (const uid of members) {
        const sessions = connectedUsers.get(uid);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("directConversationDeleted", { conversationId });
      }
      if (typeof reply === "function") reply({ success: true, message: "تم حذف المجموعة وجميع رسائلها." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر حذف المجموعة." });
    }
  });

  socket.on("findUserByName", async (data = {}, reply) => {
    try {
      const name = String(data.name || "").trim();
      if (name.length < 2 || name.length > 30) throw new Error("اكتب اسمًا من حرفين إلى 30 حرفًا.");
      if (name.toLocaleLowerCase("ar") === socket.data.playerName.toLocaleLowerCase("ar")) throw new Error("هذا اسم حسابك.");
      const snap = await usersRef.where("playerName", "==", name).limit(10).get();
      if (snap.empty) throw new Error("لم نعثر على حساب بهذا الاسم. تأكد من كتابة الاسم كما اختاره صاحبه.");
      const matches = snap.docs.map(target => ({uid:target.id,displayName:target.data().playerName || target.data().displayName || "مستخدم"})).filter(item=>item.uid!==socket.data.uid);
      if (!matches.length) throw new Error("هذا اسم حسابك.");
      if (typeof reply === "function") reply({success:true,users:matches});
    } catch (error) {
      if (typeof reply === "function") reply({success:false,message:error.message || "تعذر البحث عن الاسم."});
    }
  });

async function assertGroupConversationAvailable(conversation){
 if(conversation?.type!=="group")return;
 const until=conversation.adminGroupSuspendedUntil?.toMillis?.()||0;
 if(conversation.adminGroupSuspended===true)throw new Error("تم إيقاف هذه المجموعة من الإدارة.");
 if(until>0&&until<=Date.now())await conversationsRef.doc(String(conversation.id||"")).set({adminGroupSuspendedUntil:admin.firestore.FieldValue.delete()},{merge:true});
 else if(until>Date.now())throw new Error("هذه المجموعة معلّقة مؤقتًا حتى انتهاء مدة التعليق.");
}
async function assertAdminMessagingAllowed(uid){
  const snap=await admin.firestore().collection("users").doc(uid).get();
  if(snap.exists&&snap.data().messagingRestricted===true)throw new Error("تم تقييد إرسال الرسائل لهذا الحساب.");
}
  const blockedRef = (uid, otherUid) => usersRef.doc(uid).collection("blockedUsers").doc(otherUid);

  socket.on("getConversationDetails", async (data = {}, reply) => {
    try {
      const id = String(data.conversationId || "");
      const conversationRef = conversationsRef.doc(id);
      const [conversationSnap] = await Promise.all([conversationRef.get()]);
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) {
        throw new Error("غير مصرح بعرض معلومات هذه المحادثة.");
      }
      const conversationData = conversationSnap.data();
      if (conversationData.type === "group") {
        const memberUids = conversationData.members || [];
        const profiles = await db.getAll(...memberUids.map(uid => usersRef.doc(uid)));
        const members = profiles.map(profile => ({
          uid: profile.id,
          name: String(profile.exists ? (profile.data().playerName || profile.data().displayName || "مستخدم") : "مستخدم"),
          bio: String(profile.exists ? (profile.data().bio || "") : "").slice(0, 200),
          online: Boolean(getConnectedSocket(profile.id)),
          isModerator: (conversationData.moderatorUids || []).includes(profile.id)
        }));
        const countSnap = await conversationRef.collection("messages").count().get();
        if (typeof reply === "function") reply({ success: true, details: {
          type: "group", name: String(conversationData.groupName || "مجموعة"), description: String(conversationData.description||""), announcement: String(conversationData.announcement||""),
          members, createdBy: conversationData.createdBy || "", isAdmin: conversationData.createdBy === socket.data.uid, isModerator: (conversationData.moderatorUids || []).includes(socket.data.uid),
          permissions: { editInfo: conversationData.groupPermissions?.editInfo === "members" ? "members" : "admins", addMembers: conversationData.groupPermissions?.addMembers === "members" ? "members" : "admins" },
          messageCount: countSnap.data().count || 0,
          createdAt: conversationData.createdAt?.toMillis?.() || 0,
          updatedAt: conversationData.updatedAt?.toMillis?.() || 0
        }});
        return;
      }
      const otherUid = (conversationData.members || []).find(uid => uid !== socket.data.uid);
      if (!otherUid) throw new Error("تعذر تحديد الطرف الآخر.");
      const [profileSnap, friendshipSnap, myBlockSnap, theirBlockSnap, countSnap, outgoingRequestSnap] = await Promise.all([
        usersRef.doc(otherUid).get(),
        usersRef.doc(socket.data.uid).collection("friends").doc(otherUid).get(),
        blockedRef(socket.data.uid, otherUid).get(),
        blockedRef(otherUid, socket.data.uid).get(),
        conversationRef.collection("messages").count().get(),
        requestRef(otherUid, socket.data.uid).get()
      ]);
      const profile = profileSnap.exists ? profileSnap.data() : {};
      const updatedAt = conversationData.updatedAt && conversationData.updatedAt.toMillis ? conversationData.updatedAt.toMillis() : 0;
      const createdAt = conversationData.createdAt && conversationData.createdAt.toMillis ? conversationData.createdAt.toMillis() : 0;
      if (typeof reply === "function") reply({
        success: true,
        details: {
          uid: otherUid,
          name: String(profile.playerName || profile.displayName || "مستخدم"),
          bio: String(profile.bio || "").slice(0, 200),
          online: Boolean(getConnectedSocket(otherUid)),
          lastSeenAt: profile.lastSeenAt?.toMillis?.() || 0,
          isFriend: friendshipSnap.exists,
          pendingRequest: outgoingRequestSnap.exists,
          blockedByMe: myBlockSnap.exists,
          blockedMe: theirBlockSnap.exists,
          messageCount: countSnap.data().count || 0,
          createdAt,
          updatedAt
        }
      });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تحميل معلومات المحادثة." });
    }
  });

  socket.on("blockConversationUser", async (data = {}, reply) => {
    try {
      const otherUid = String(data.uid || "").trim();
      const conversationId = String(data.conversationId || "");
      const conversationSnap = await conversationsRef.doc(conversationId).get();
      if (!otherUid || otherUid === socket.data.uid || !conversationSnap.exists ||
          !(conversationSnap.data().members || []).includes(socket.data.uid) ||
          !(conversationSnap.data().members || []).includes(otherUid)) throw new Error("بيانات الحظر غير صالحة.");
      const batch = db.batch();
      batch.set(blockedRef(socket.data.uid, otherUid), { createdAt: admin.firestore.FieldValue.serverTimestamp() });
      batch.delete(usersRef.doc(socket.data.uid).collection("friends").doc(otherUid));
      batch.delete(usersRef.doc(otherUid).collection("friends").doc(socket.data.uid));
      batch.delete(usersRef.doc(socket.data.uid).collection("friendRequests").doc(otherUid));
      batch.delete(usersRef.doc(otherUid).collection("friendRequests").doc(socket.data.uid));
      await batch.commit();
      if (typeof reply === "function") reply({ success: true, message: "تم حظر هذا المستخدم وإزالته من قائمة الأصدقاء. لن تتمكنوا من تبادل رسائل جديدة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر حظر المستخدم." });
    }
  });

  socket.on("unblockConversationUser", async (data = {}, reply) => {
    try {
      const otherUid = String(data.uid || "").trim();
      if (!otherUid || otherUid === socket.data.uid) throw new Error("بيانات إلغاء الحظر غير صالحة.");
      await blockedRef(socket.data.uid, otherUid).delete();
      if (typeof reply === "function") reply({ success: true, message: "تم إلغاء الحظر." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: "تعذر إلغاء الحظر." });
    }
  });

  socket.on("reportConversationUser", async (data = {}, reply) => {
    try {
      const otherUid = String(data.uid || "").trim();
      const conversationId = String(data.conversationId || "");
      const reason = String(data.reason || "").trim().slice(0, 80);
      const details = String(data.details || "").trim().slice(0, 1000);
      const conversationSnap = await conversationsRef.doc(conversationId).get();
      if (!otherUid || otherUid === socket.data.uid || !reason || !conversationSnap.exists ||
          !(conversationSnap.data().members || []).includes(socket.data.uid) ||
          !(conversationSnap.data().members || []).includes(otherUid)) throw new Error("بيانات البلاغ غير صالحة.");
      await db.collection("userReports").add({
        reporterUid: socket.data.uid,
        reportedUid: otherUid,
        conversationId,
        reason,
        details,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "new"
      });
      if (typeof reply === "function") reply({ success: true, message: "تم استلام بلاغك وحفظه للمراجعة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إرسال البلاغ." });
    }
  });

  socket.on("startDirectConversation", async (data = {}, reply) => {
    try {
      const targetUid = String(data.targetUid || "").trim();
      if (!targetUid || targetUid === socket.data.uid) throw new Error("المستخدم غير صالح.");
      const targetSnap = await usersRef.doc(targetUid).get();
      if (!targetSnap.exists || !targetSnap.data().playerName) throw new Error("الحساب غير موجود.");
      const [myBlock, theirBlock] = await Promise.all([blockedRef(socket.data.uid, targetUid).get(), blockedRef(targetUid, socket.data.uid).get()]);
      if (myBlock.exists || theirBlock.exists) throw new Error("لا يمكن بدء المحادثة بسبب إعدادات الحظر بين الحسابين.");
      const members = [socket.data.uid, targetUid].sort();
      const conversationId = members.join("_");
      const ref = conversationsRef.doc(conversationId);
      await ref.set({ type: "direct", members, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await usersRef.doc(socket.data.uid).collection("hiddenConversations").doc(conversationId).delete();
      await usersRef.doc(socket.data.uid).collection("hiddenConversationContent").doc(conversationId).delete();
      const profile = targetSnap.data();
      if (typeof reply === "function") reply({ success: true, conversation: { id: conversationId, displayName: profile.playerName || profile.displayName || "مستخدم" } });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر بدء المحادثة." });
    }
  });

  socket.on("searchUsers", async (data = {}, reply) => {
    try {
      const query = String(data.query || "").trim().toLocaleLowerCase("ar");
      if (query.length < 2 || query.length > 40) throw new Error("اكتب حرفين على الأقل للبحث.");
      const snapshot = await usersRef.get();
      const matches = snapshot.docs
        .filter(doc => doc.id !== socket.data.uid)
        .map(doc => {
          const profile = doc.data() || {};
          const name = String(profile.playerName || profile.displayName || "").trim();
          return name ? { uid: doc.id, name, online: Boolean(getConnectedSocket(doc.id)) } : null;
        })
        .filter(user => user && user.name.toLocaleLowerCase("ar").includes(query))
        .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        .slice(0, 30);
      if (typeof reply === "function") reply({ success: true, users: matches });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر البحث عن المستخدمين." });
    }
  });

  socket.on("listConversations", async (data = {}, reply) => {
    const startedAt = Date.now();
    console.info("listConversations started", socket.data.uid);
    try {
      const [snap, hiddenSnap, hiddenContentSnap] = await Promise.all([conversationsRef.where("members", "array-contains", socket.data.uid).get(), usersRef.doc(socket.data.uid).collection("hiddenConversations").get(), usersRef.doc(socket.data.uid).collection("hiddenConversationContent").get()]);
      const hiddenIds = new Set(hiddenSnap.docs.map(item => item.id));
      const hiddenContentIds = new Set(hiddenContentSnap.docs.map(item => item.id));
      // The conversation document is already updated with lastMessage and updatedAt
      // whenever a message is sent, so avoid a separate messages query per conversation.
      const allOtherUids = [...new Set(snap.docs.flatMap(item => (item.data().members || []).filter(uid => uid !== socket.data.uid)))];
      const profileSnapshots = allOtherUids.length ? await db.getAll(...allOtherUids.map(uid => usersRef.doc(uid))) : [];
      const profilesByUid = new Map(profileSnapshots.map(profile => [profile.id, profile.exists ? profile.data() : {}]));
      const conversations = await Promise.all(snap.docs.filter(item => !hiddenIds.has(item.id) && !(item.data().type==="group" && (item.data().adminGroupSuspended===true || (item.data().adminGroupSuspendedUntil?.toMillis?.()||0)>Date.now()))).map(async item => {
        const data = item.data();
        const members = data.members || [];
        const otherUid = members.find(uid => uid !== socket.data.uid);
        const profile = otherUid ? (profilesByUid.get(otherUid) || {}) : {};
        const isGroup = data.type === "group";
        const groupName = String(data.groupName || "مجموعة");
        const memberNames = isGroup ? members.map(uid => String(profilesByUid.get(uid)?.playerName || profilesByUid.get(uid)?.displayName || "مستخدم")) : [];
        let lastMessage = hiddenContentIds.has(item.id) ? "" : String(data.lastMessage || "").replace(/\s*\(تم التعديل\)\s*$/,"").replace(/^تم التعديل\.?$/,"");
        // Read the newest visible message for both direct and group chats so attachment previews never fall back to "ابدأ المحادثة".
        if (!hiddenContentIds.has(item.id)) {
          const latestMessages = await item.ref.collection("messages").orderBy("createdAt", "desc").limit(20).get();
          const latestVisible = latestMessages.docs.find(message => !(message.data().hiddenFor || []).includes(socket.data.uid));
          if (latestVisible) {
            const messageData = latestVisible.data();
            const latestPreview = String(messageData.text || (messageData.attachment ? ((messageData.attachment.type || "").startsWith("video/") ? "فيديو" : "مرفق: " + (messageData.attachment.name || "ملف")) : "")).trim();
            // Keep the conversation document's lastMessage as a reliable fallback
            // if the newest message has no previewable text/attachment fields.
            if (latestPreview) lastMessage = latestPreview.slice(0, 120);
          }
        }
        return {
          id: item.id, type: isGroup ? "group" : "direct", otherUid,
          displayName: isGroup ? groupName : (profile.playerName || profile.displayName || "مستخدم"),
          groupName, memberNames, lastMessage,
          updatedAt: data.updatedAt ? data.updatedAt.toMillis() : 0
        };
      }));
      conversations.sort((a,b) => b.updatedAt-a.updatedAt);
      console.info("listConversations completed", { uid: socket.data.uid, count: conversations.length, durationMs: Date.now() - startedAt });
      if (typeof reply === "function") { reply({ success: true, conversations }); console.info("listConversations reply sent", { uid: socket.data.uid, durationMs: Date.now() - startedAt }); }
    } catch (error) {
      console.error("List conversations error:", { uid: socket.data.uid, durationMs: Date.now() - startedAt, message: error.message });
      if (typeof reply === "function") reply({ success: false, message: "تعذر تحميل المحادثات." });
    }
  });

  socket.on("markMessageDelivered", async (data = {}) => { try { const conversationId=String(data.conversationId||""),messageId=String(data.messageId||""); if(!conversationId||!messageId)return; const conversation=await conversationsRef.doc(conversationId).get(); if(!conversation.exists||!(conversation.data().members||[]).includes(socket.data.uid))return; const messageRef=conversationsRef.doc(conversationId).collection("messages").doc(messageId); const message=await messageRef.get(); if(!message.exists||message.data().senderUid===socket.data.uid)return; const deliveredAt=Date.now(); await messageRef.set({deliveredTo:{[socket.data.uid]:admin.firestore.FieldValue.serverTimestamp()}},{merge:true}); const receipt={conversationId,messageId,recipientUid:socket.data.uid,deliveredAt}; const sessions=connectedUsers.get(message.data().senderUid); if(sessions)for(const client of sessions)if(client.connected)client.emit("messageDeliveryReceipt",receipt); } catch(error){console.warn("Message delivery receipt failed",error.message)} });
  socket.on("getConversationMessages", async (data = {}, reply) => {
    try {
      const id = String(data.conversationId || "");
      const ref = conversationsRef.doc(id);
      const conversation = await ref.get();
      if (!conversation.exists || !(conversation.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بفتح هذه المحادثة.");
      await assertGroupConversationAvailable({...conversation.data(),id});
      const snap = await ref.collection("messages").orderBy("createdAt", "asc").limit(100).get();
      const visibleDocs = snap.docs.filter(d => !(d.data().hiddenFor || []).includes(socket.data.uid));
      const senderUids = [...new Set(visibleDocs.map(doc => doc.data().senderUid).filter(Boolean))];
      const senderProfiles = senderUids.length ? await db.getAll(...senderUids.map(uid => usersRef.doc(uid))) : [];
      const senderNames = new Map(senderProfiles.map(profile => [profile.id, String(profile.exists ? (profile.data().playerName || profile.data().displayName || "مستخدم") : "مستخدم")]));

      const messages = visibleDocs.map(d => {
        const data = d.data();
        const currentSenderName = senderNames.get(data.senderUid) || data.senderName || "مستخدم";
        const replyTo = data.replyTo && typeof data.replyTo === "object"
          ? { ...data.replyTo, senderName: senderNames.get(data.replyTo.senderUid) || data.replyTo.senderName || "مستخدم" }
          : data.replyTo;
        return {
          id: d.id,
          ...data,
          senderName: currentSenderName,
          ...(replyTo ? { replyTo } : {}),
          deliveredTo: data.deliveredTo || {},
          createdAt: data.createdAt ? data.createdAt.toMillis() : 0
        };
      });
      if (typeof reply === "function") reply({ success: true, messages });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تحميل الرسائل." });
    }
  });

  socket.on("editDirectMessage", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const messageId = String(data.messageId || "");
      const text = String(data.text || "").trim();
      if (!messageId || !text || text.length > 4000) throw new Error("اكتب رسالة لا تتجاوز 4000 حرف.");
      const conversationRef = conversationsRef.doc(conversationId);
      const messageRef = conversationRef.collection("messages").doc(messageId);
      const conversationSnap = await conversationRef.get();
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بتعديل هذه الرسالة.");
      const messageSnap = await messageRef.get();
      if (!messageSnap.exists) throw new Error("الرسالة غير موجودة أو حُذفت بالفعل.");
      if (messageSnap.data().senderUid !== socket.data.uid) throw new Error("يمكن لمرسل الرسالة فقط تعديلها.");
      await messageRef.update({
        text,
        edited: true,
        editedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      const latest = await conversationRef.collection("messages").orderBy("createdAt", "desc").limit(1).get();
      if (latest.docs[0]?.id === messageId) {
        await conversationRef.set({
          lastMessage: text.slice(0, 120),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      const payload = { conversationId, messageId, text, editedAt: Date.now() };
      const members = conversationSnap.data().members || [];
      for (const member of members) {
        const sessions = connectedUsers.get(member);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("directMessageEdited", payload);
      }
      if (typeof reply === "function") reply({ success: true, message: payload });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تعديل الرسالة." });
    }
  });

  async function deleteConversationMessages(conversationRef) {
    const snapshot = await conversationRef.collection("messages").get();
    for (let i = 0; i < snapshot.docs.length; i += 450) {
      const batch = db.batch();
      for (const message of snapshot.docs.slice(i, i + 450)) batch.delete(message.ref);
      await batch.commit();
    }
  }

  socket.on("clearDirectConversationForMe", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const conversationRef = conversationsRef.doc(conversationId);
      const conversationSnap = await conversationRef.get();
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بحذف محتوى هذه الدردشة.");
      const snapshot = await conversationRef.collection("messages").get();
      for (let i = 0; i < snapshot.docs.length; i += 450) {
        const batch = db.batch();
        for (const message of snapshot.docs.slice(i, i + 450)) batch.update(message.ref, { hiddenFor: admin.firestore.FieldValue.arrayUnion(socket.data.uid) });
        await batch.commit();
      }
      await usersRef.doc(socket.data.uid).collection("hiddenConversationContent").doc(conversationId).set({
        hiddenAt: admin.firestore.FieldValue.serverTimestamp()
      });
      if (typeof reply === "function") reply({ success: true });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر حذف محتوى الدردشة من عندك." });
    }
  });

  socket.on("hideDirectConversationForMe", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const conversationRef = conversationsRef.doc(conversationId);
      const conversationSnap = await conversationRef.get();
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بحذف هذه الدردشة.");
      await usersRef.doc(socket.data.uid).collection("hiddenConversations").doc(conversationId).set({
        hiddenAt: admin.firestore.FieldValue.serverTimestamp()
      });
      if (typeof reply === "function") reply({ success: true, message: "تم حذف الدردشة من قائمة محادثاتك فقط. بقيت المحادثة ورسائلها لدى الطرف الآخر." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر حذف الدردشة من عندك." });
    }
  });

  socket.on("clearDirectConversation", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const conversationRef = conversationsRef.doc(conversationId);
      const conversationSnap = await conversationRef.get();
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بحذف محتوى هذه الدردشة.");
      const members = conversationSnap.data().members || [];
      await deleteConversationMessages(conversationRef);
      await conversationRef.set({ lastMessage: "", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      const payload = { conversationId };
      for (const member of members) {
        const sessions = connectedUsers.get(member);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("directConversationContentDeleted", payload);
      }
      if (typeof reply === "function") reply({ success: true, message: "تم حذف محتوى الدردشة لدى الطرفين." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر حذف محتوى الدردشة." });
    }
  });

  socket.on("deleteDirectConversation", async (data = {}, reply) => {
    try {
      const conversationId = String(data.conversationId || "");
      const conversationRef = conversationsRef.doc(conversationId);
      const conversationSnap = await conversationRef.get();
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بحذف هذه الدردشة.");
      const members = conversationSnap.data().members || [];
      await deleteConversationMessages(conversationRef);
      await conversationRef.delete();
      const payload = { conversationId };
      for (const member of members) {
        const sessions = connectedUsers.get(member);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("directConversationDeleted", payload);
      }
      if (typeof reply === "function") reply({ success: true, message: "تم حذف الدردشة كاملة لدى الطرفين." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر حذف الدردشة كاملة." });
    }
  });

  socket.on("deleteDirectMessageForMe", async (data = {}, reply) => {
    try {
      const conversationId=String(data.conversationId||"");
      const messageId=String(data.messageId||"");
      const conversationRef=conversationsRef.doc(conversationId);
      const conversationSnap=await conversationRef.get();
      if(!messageId||!conversationSnap.exists||!(conversationSnap.data().members||[]).includes(socket.data.uid)) throw new Error("غير مصرح بحذف هذه الرسالة.");
      const messageRef=conversationRef.collection("messages").doc(messageId);
      const messageSnap=await messageRef.get();
      if(!messageSnap.exists) throw new Error("الرسالة غير موجودة أو حُذفت بالفعل.");
      await messageRef.update({hiddenFor:admin.firestore.FieldValue.arrayUnion(socket.data.uid)});
      if(typeof reply==="function")reply({success:true});
    } catch(error) {
      if(typeof reply==="function")reply({success:false,message:error.message||"تعذر حذف الرسالة لديك."});
    }
  });

  socket.on("deleteDirectMessageForEveryone", async (data = {}, reply) => {
    try {
      const conversationId=String(data.conversationId||"");
      const messageId=String(data.messageId||"");
      const conversationRef=conversationsRef.doc(conversationId);
      const messageRef=conversationRef.collection("messages").doc(messageId);
      const messageBeforeDelete = await messageRef.get();
      const result=await db.runTransaction(async transaction=>{
        const [conversationSnap,messageSnap]=await Promise.all([transaction.get(conversationRef),transaction.get(messageRef)]);
        if(!conversationSnap.exists||!(conversationSnap.data().members||[]).includes(socket.data.uid))throw new Error("غير مصرح بهذه المحادثة.");
        if(!messageSnap.exists)throw new Error("الرسالة غير موجودة أو حُذفت بالفعل.");
        if(messageSnap.data().senderUid!==socket.data.uid)throw new Error("يمكن لمرسل الرسالة فقط حذفها لدى الجميع.");
        transaction.delete(messageRef);
        return conversationSnap.data();
      });
      const remaining=await conversationRef.collection("messages").orderBy("createdAt","desc").limit(1).get();
      const latest=remaining.docs[0];
      await conversationRef.set({
        lastMessage:latest?String(latest.data().text||"").slice(0,120):"",
        updatedAt:admin.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      const payload={conversationId,messageId};
      for(const member of result.members||[]){
        const sessions=connectedUsers.get(member);
        if(sessions)for(const client of sessions)if(client.connected)client.emit("directMessageDeletedForEveryone",payload);
      }
      if(typeof reply==="function")reply({success:true});
    } catch(error) {
      if(typeof reply==="function")reply({success:false,message:error.message||"تعذر حذف الرسالة لدى الجميع."});
    }
  });

  socket.on("saveVideoDuration", async (data = {}, reply) => {
    try {
      const conversationId=String(data.conversationId||"");
      const messageId=String(data.messageId||"");
      const durationSeconds=Math.floor(Number(data.durationSeconds));
      if(!conversationId||!messageId||!Number.isFinite(durationSeconds)||durationSeconds<1||durationSeconds>86400)throw new Error("مدة الفيديو غير صالحة.");
      const conversation=await conversationsRef.doc(conversationId).get();
      if(!conversation.exists||!(conversation.data().members||[]).includes(socket.data.uid))throw new Error("غير مصرح بتحديث هذه الرسالة.");
      const messageRef=conversationsRef.doc(conversationId).collection("messages").doc(messageId);
      const messageSnap=await messageRef.get();
      if(!messageSnap.exists||messageSnap.data().senderUid!==socket.data.uid)throw new Error("لا يمكن تحديث مدة هذا الفيديو.");
      const attachment=messageSnap.data().attachment;
      if(!attachment||(attachment.type||"").indexOf("video/")!==0)throw new Error("الرسالة ليست فيديو.");
      await messageRef.update({"attachment.durationSeconds":durationSeconds});
      for(const member of conversation.data().members||[]){
        const sessions=connectedUsers.get(member);
        if(sessions)for(const client of sessions)if(client.connected)client.emit("videoDurationUpdated",{conversationId,messageId,durationSeconds});
      }
      if(typeof reply==="function")reply({success:true});
    }catch(error){
      if(typeof reply==="function")reply({success:false,message:error.message||"تعذر حفظ مدة الفيديو."});
    }
  });

  socket.on("getScheduledMessages", async (data = {}, reply) => {
    try {
      const snapshot = await scheduledMessagesRef.where("senderUid", "==", socket.data.uid).get();
      const now = Date.now();
      const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), sendAt: doc.data().sendAt?.toMillis?.() || 0 })).filter(item => item.sendAt > now).sort((a, b) => a.sendAt - b.sendAt);
      const ids = [...new Set(pending.map(item => item.conversationId).filter(Boolean))];
      const conversationSnaps = ids.length ? await db.getAll(...ids.map(id => conversationsRef.doc(id))) : [];
      const directUserIds = new Set();
      const conversations = new Map();
      for (const snap of conversationSnaps) {
        if (!snap.exists) continue;
        const conversation = snap.data();
        conversations.set(snap.id, conversation);
        if (conversation.type !== "group") {
          const otherUid = (conversation.members || []).find(uid => uid !== socket.data.uid);
          if (otherUid) directUserIds.add(otherUid);
        }
      }
      const profileSnaps = directUserIds.size ? await db.getAll(...[...directUserIds].map(uid => usersRef.doc(uid))) : [];
      const profileNames = new Map(profileSnaps.map(profile => [profile.id, String(profile.exists ? (profile.data().playerName || profile.data().displayName || "مستخدم") : "مستخدم")]));
      const names = new Map();
      for (const [id, conversation] of conversations) {
        if (conversation.type === "group") {
          names.set(id, String(conversation.groupName || conversation.name || "مجموعة"));
        } else {
          const otherUid = (conversation.members || []).find(uid => uid !== socket.data.uid);
          names.set(id, otherUid ? (profileNames.get(otherUid) || "مستخدم") : "مستخدم");
        }
      }
      if (typeof reply === "function") reply({ success: true, messages: pending.map(item => ({ id: item.id, text: String(item.text || ""), sendAt: item.sendAt, conversationName: names.get(item.conversationId) || "مستخدم" })) });
    } catch (error) { if (typeof reply === "function") reply({ success: false, message: "تعذر تحميل الرسائل المجدولة." }); }
  });

  socket.on("cancelScheduledMessage", async (data = {}, reply) => {
    try {
      const id = String(data.scheduledId || "").trim();
      if (!id) throw new Error("الرسالة المجدولة غير محددة.");
      const ref = scheduledMessagesRef.doc(id);
      const cancelled = await db.runTransaction(async transaction => {
        const snap = await transaction.get(ref);
        if (!snap.exists) return false;
        const item = snap.data();
        if (item.senderUid !== socket.data.uid) throw new Error("لا يمكنك إلغاء رسالة مجدولة لشخص آخر.");
        if ((item.sendAt?.toMillis?.() || 0) <= Date.now()) throw new Error("حان موعد الإرسال أو بدأت عملية الإرسال بالفعل.");
        transaction.delete(ref);
        return true;
      });
      if (!cancelled) throw new Error("الرسالة المجدولة لم تعد موجودة.");
      if (typeof reply === "function") reply({ success: true });
    } catch (error) { if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إلغاء الجدولة." }); }
  });

  socket.on("scheduleDirectMessage", async (data = {}, reply) => {
    try {
await assertFeatureEnabled("scheduledMessages","هذه الميزة متوقفة مؤقتًا من إدارة مِرسالو.");
            await assertAdminMessagingAllowed(socket.data.uid);
      const conversationId = String(data.conversationId || "");
      const text = String(data.text || "").trim();
      const sendAt = Number(data.sendAt);
      if (!conversationId || !text || text.length > 4000) throw new Error("اكتب رسالة لا تتجاوز 4000 حرف.");
      if (!Number.isFinite(sendAt) || sendAt < Date.now() + 30000 || sendAt > Date.now() + 90 * 24 * 60 * 60 * 1000) throw new Error("موعد الإرسال يجب أن يكون بعد نصف دقيقة وحتى 90 يومًا.");
      const conversationSnap = await conversationsRef.doc(conversationId).get();
      if (!conversationSnap.exists || !(conversationSnap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بجدولة رسالة في هذه المحادثة.");
      const conversation = conversationSnap.data();
      if (conversation.type !== "group") {
        const otherUid = (conversation.members || []).find(uid => uid !== socket.data.uid);
        if (!otherUid) throw new Error("تعذر تحديد الطرف الآخر.");
        const [myBlock, theirBlock] = await Promise.all([blockedRef(socket.data.uid, otherUid).get(), blockedRef(otherUid, socket.data.uid).get()]);
        if (myBlock.exists || theirBlock.exists) throw new Error("لا يمكن جدولة الرسائل بسبب إعدادات الحظر بين الحسابين.");
      }
      const scheduledRef = scheduledMessagesRef.doc();
      await scheduledRef.set({
        conversationId,
        senderUid: socket.data.uid,
        senderName: socket.data.playerName,
        text,
        sendAt: admin.firestore.Timestamp.fromMillis(sendAt),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      if (typeof reply === "function") reply({ success: true, scheduledId: scheduledRef.id, sendAt });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذرت جدولة الرسالة." });
    }
  });

  socket.on("sendDirectMessage", async (data = {}, reply) => {
    try {
      await assertAdminMessagingAllowed(socket.data.uid);
      const id = String(data.conversationId || "");
      const attachment=data.attachment&&typeof data.attachment==="object"?data.attachment:null;
      const text = String(data.text || "").trim();
      if ((!text&&!attachment) || text.length > 4000) throw new Error("اكتب رسالة أو اختر ملفًا لإرساله.");
      if(attachment){
        const storagePath=String(attachment.storagePath||"");
        const expectedPrefix="conversations/"+id+"/"+socket.data.uid+"/";
        if(!storagePath.startsWith(expectedPrefix))throw new Error("مسار الملف غير صالح لهذه المحادثة أو هذا الحساب.");
        const folder=storagePath.slice(0,storagePath.lastIndexOf("/"));
        const objectName=storagePath.slice(storagePath.lastIndexOf("/")+1);
        const storage=getMediaStorage().storage.from("conversation-media");
        const {data:objects,error:listError}=await storage.list(folder,{limit:100,search:objectName});
        if(listError)throw listError;
        if(!(objects||[]).some(item=>item.name===objectName))throw new Error("الملف المرفق غير موجود في مساحة التخزين.");
        const {data:signed,error:signedError}=await storage.createSignedUrl(storagePath,31536000);
        if(signedError)throw signedError;
        attachment.url=signed.signedUrl;
      }
      const ref = conversationsRef.doc(id);
      const conversation = await ref.get();
      if (!conversation.exists || !(conversation.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بإرسال رسالة هنا.");
      await assertGroupConversationAvailable(conversation.data());
      const conversationData = conversation.data();
      const isGroup = conversationData.type === "group";
      if (!isGroup) {
        const otherUid = (conversationData.members || []).find(uid => uid !== socket.data.uid);
        if (!otherUid) throw new Error("تعذر تحديد الطرف الآخر.");
        const [myBlock, theirBlock] = await Promise.all([blockedRef(socket.data.uid, otherUid).get(), blockedRef(otherUid, socket.data.uid).get()]);
        if (myBlock.exists || theirBlock.exists) throw new Error("لا يمكن إرسال الرسائل بسبب إعدادات الحظر بين الحسابين.");
      }
      if (attachment && (attachment.type || "").startsWith("video/")) attachment.name = "فيديو";
       const replyToInput=data.replyTo&&typeof data.replyTo==="object"?data.replyTo:null;
      let replyTo=null;
      if(replyToInput?.id){const replySnap=await ref.collection("messages").doc(String(replyToInput.id)).get();if(replySnap.exists){const original=replySnap.data();replyTo={id:replySnap.id,senderUid:String(original.senderUid||""),senderName:String(original.senderName||"مستخدم"),text:String(original.text||"").slice(0,500),attachment:original.attachment?{name:String(original.attachment.name||"مرفق"),type:String(original.attachment.type||"")}:null};}}
      const message = { senderUid: socket.data.uid, senderName: socket.data.playerName, text, ...(attachment?{attachment}:{}), ...(replyTo?{replyTo}:{}), deliveredTo: {}, createdAt: admin.firestore.FieldValue.serverTimestamp() };
      const messageRef = ref.collection("messages").doc();
      const batch = db.batch();
      batch.set(messageRef, message);
      for (const member of conversation.data().members) {
        batch.delete(usersRef.doc(member).collection("hiddenConversations").doc(id));
        batch.delete(usersRef.doc(member).collection("hiddenConversationContent").doc(id));
      }
      batch.set(ref, { updatedAt: admin.firestore.FieldValue.serverTimestamp(), lastMessage: (text||(attachment && (attachment.type || "").startsWith("video/") ? "فيديو" : ("مرفق: "+attachment.name))).slice(0,120) }, { merge: true });
      await batch.commit();
      const notificationBody = text || (attachment ? (String(attachment.type||"").startsWith("video/") ? "أرسل فيديو" : "أرسل مرفقًا") : "أرسل رسالة");
      await Promise.all((conversationData.members||[]).filter(uid=>uid!==socket.data.uid).map(uid=>createUserNotification(uid,{type:"message",title:isGroup?(conversationData.groupName||"مجموعة جديدة"):socket.data.playerName,body:notificationBody,url:"chat.html?conversationId="+encodeURIComponent(id),tag:"message-"+id})));
      const payload = { id: messageRef.id, senderUid: socket.data.uid, senderName: socket.data.playerName, text, ...(attachment?{attachment}:{}), ...(replyTo?{replyTo}:{}), deliveredTo: {}, createdAt: Date.now() };
      for (const member of conversation.data().members) {
        const sessions = connectedUsers.get(member);
        if (sessions) for (const client of sessions) if (client.connected) client.emit("directMessageReceived", { conversationId:id, message:payload });
      }
      if (typeof reply === "function") reply({ success: true, message: payload });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إرسال الرسالة." });
    }
  });
  const friendshipRef = (uid, otherUid) => usersRef.doc(uid).collection("friends").doc(otherUid);
  const requestRef = (uid, otherUid) => usersRef.doc(uid).collection("friendRequests").doc(otherUid);

  socket.on("sendFriendRequest", async (data = {}, reply) => {
    try {
      const targetUid = String(data.targetUid || "").trim();
      if (!targetUid || targetUid === socket.data.uid) throw new Error("طلب صداقة غير صالح.");
      const targetProfile = await usersRef.doc(targetUid).get();
      if (!targetProfile.exists) throw new Error("الحساب غير موجود.");
      const [myBlock, theirBlock] = await Promise.all([blockedRef(socket.data.uid, targetUid).get(), blockedRef(targetUid, socket.data.uid).get()]);
      if (myBlock.exists || theirBlock.exists) throw new Error("لا يمكن إرسال طلب صداقة بسبب إعدادات الحظر بين الحسابين.");
      const [existing, reverseRequest, pendingRequest] = await Promise.all([
        friendshipRef(socket.data.uid, targetUid).get(),
        requestRef(socket.data.uid, targetUid).get(),
        requestRef(targetUid, socket.data.uid).get()
      ]);
      if (existing.exists) throw new Error("هذا اللاعب ضمن قائمة أصدقائك.");
      if (reverseRequest.exists) throw new Error("لديك طلب صداقة وارد من هذا اللاعب؛ راجع الطلبات.");
      if (pendingRequest.exists) throw new Error("سبق إرسال طلب صداقة لهذا اللاعب.");
      const now = Date.now();
      const lastSent = friendRequestLimits.get(socket.data.uid) || 0;
      if (now - lastSent < 5000) throw new Error("انتظر خمس ثوانٍ قبل إرسال طلب آخر.");
      await requestRef(targetUid, socket.data.uid).set({
        fromUid: socket.data.uid, fromName: socket.data.playerName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      friendRequestLimits.set(socket.data.uid, now);
      await createUserNotification(targetUid,{type:"friendRequest",title:"طلب صداقة جديد",body:socket.data.playerName+" أرسل إليك طلب صداقة.",url:"settings.html?section=friend-requests",tag:"friend-request-"+socket.data.uid});
      const targetSockets = connectedUsers.get(targetUid);
      const targets = targetSockets ? [...targetSockets].filter(client => client.connected) : [];
      for (const target of targets) {
        target.emit("friendRequestReceived", { fromUid: socket.data.uid, fromName: socket.data.playerName });
      }
      if (typeof reply === "function") reply({ success: true, message: "تم إرسال طلب الصداقة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إرسال الطلب." });
    }
  });

  socket.on("cancelFriendRequest", async (data = {}, reply) => {
    try {
      const targetUid = String(data.targetUid || "").trim();
      if (!targetUid || targetUid === socket.data.uid) throw new Error("طلب الصداقة غير صالح.");
      const outgoingRef = requestRef(targetUid, socket.data.uid);
      const requestSnap = await outgoingRef.get();
      if (!requestSnap.exists || requestSnap.data().fromUid !== socket.data.uid) {
        throw new Error("لا يوجد طلب صداقة مُرسل قابل للإلغاء.");
      }
      await outgoingRef.delete();
      if (typeof reply === "function") reply({ success: true, message: "تم إلغاء طلب الصداقة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إلغاء طلب الصداقة." });
    }
  });

  socket.on("updatePlayerName", async (data = {}, reply) => {
    try {
      const playerName = String(data.playerName || "").trim().slice(0, 30);
      if (!playerName) throw new Error("اسم اللاعب مطلوب.");
      await usersRef.doc(socket.data.uid).set({
        playerName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      const cached = profileCache.get(socket.data.uid);
      profileCache.set(socket.data.uid, {
        data: { ...(cached?.data || {}), playerName },
        expiresAt: Date.now() + PROFILE_CACHE_TTL_MS
      });
      // Keep every active session in sync for social presence and messaging.
      const sessions = connectedUsers.get(socket.data.uid);
      if (sessions) for (const session of sessions) session.data.playerName = playerName;
      io.emit("onlinePlayers", onlinePlayerList());
      if (typeof reply === "function") reply({ success: true, playerName, message: "تم تحديث اسم اللاعب." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تحديث الاسم." });
    }
  });

  socket.on("getFriendData", async reply => {
    try {
      const [friendsSnap, requestsSnap] = await Promise.all([
        usersRef.doc(socket.data.uid).collection("friends").get(),
        usersRef.doc(socket.data.uid).collection("friendRequests").get()
      ]);
      const friendProfiles = friendsSnap.docs.length ? await db.getAll(...friendsSnap.docs.map(d => usersRef.doc(d.id))) : [];
      const profilesByUid = new Map(friendProfiles.map(profile => [profile.id, profile.exists ? profile.data() : {}]));
      const friends = friendsSnap.docs.map(d => {
        const profile = profilesByUid.get(d.id) || {};
        return { uid: d.id, name: String(profile.playerName || "اسم غير متوفر"), online: Boolean(getConnectedSocket(d.id)) };
      });
      const requests = requestsSnap.docs.map(d => ({ uid: d.id, name: String(d.data().fromName || "لاعب") }));
      if (typeof reply === "function") reply({ success: true, friends, requests });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: "تعذر تحميل الأصدقاء." });
    }
  });

  socket.on("respondFriendRequest", async (data = {}, reply) => {
    try {
      const fromUid = String(data.fromUid || "").trim();
      const accepted = data.accept === true;
      const ref = requestRef(socket.data.uid, fromUid);
      if (!fromUid || fromUid === socket.data.uid) throw new Error("طلب الصداقة غير صالح.");
      if (accepted) {
        await admin.firestore().runTransaction(async transaction => {
          const request = await transaction.get(ref);
          if (!request.exists) throw new Error("طلب الصداقة غير موجود أو تمت معالجته.");
          const createdAt = admin.firestore.FieldValue.serverTimestamp();
          transaction.set(friendshipRef(socket.data.uid, fromUid), { createdAt });
          transaction.set(friendshipRef(fromUid, socket.data.uid), { createdAt });
          transaction.delete(ref);
        });
      } else {
        const request = await ref.get();
        if (!request.exists) throw new Error("طلب الصداقة غير موجود أو تمت معالجته.");
        await ref.delete();
      }
      if (typeof reply === "function") reply({ success: true, message: accepted ? "تم قبول طلب الصداقة." : "تم رفض الطلب." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تنفيذ الطلب." });
    }
  });

  socket.on("removeFriend", async (data = {}, reply) => {
    try {
      const otherUid = String(data.uid || "").trim();
      const conversationId = String(data.conversationId || "");
      if (!otherUid || otherUid === socket.data.uid) throw new Error("بيانات إزالة الصداقة غير صالحة.");

      // The friends page does not have a conversationId. Verify the friendship
      // itself there; when called from a conversation, also verify membership.
      const myFriendRef = friendshipRef(socket.data.uid, otherUid);
      const theirFriendRef = friendshipRef(otherUid, socket.data.uid);
      const [myFriend, theirFriend] = await Promise.all([myFriendRef.get(), theirFriendRef.get()]);
      if (conversationId) {
        const conversationSnap = await conversationsRef.doc(conversationId).get();
        const members = conversationSnap.exists ? (conversationSnap.data().members || []) : [];
        if (!members.includes(socket.data.uid) || !members.includes(otherUid)) {
          throw new Error("بيانات إزالة الصداقة غير صالحة.");
        }
      } else if (!myFriend.exists && !theirFriend.exists) {
        throw new Error("هذا المستخدم ليس ضمن قائمة أصدقائك.");
      }

      const batch = db.batch();
      batch.delete(myFriendRef);
      batch.delete(theirFriendRef);
      batch.delete(requestRef(socket.data.uid, otherUid));
      batch.delete(requestRef(otherUid, socket.data.uid));
      await batch.commit();
      if (typeof reply === "function") reply({ success: true, message: "تمت إزالة الصداقة، وبقيت المحادثة ورسائلها." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إزالة الصداقة." });
    }
  });



  socket.on("disconnect", reason => {
    console.warn("Socket disconnected", { uid: socket.data.uid, reason });
    removeConnectedSocket(socket.data.uid, socket);
    const activeCall = activeVoiceCallFor(socket.data.uid);
    if (activeCall && !connectedUsers.has(socket.data.uid)) {
      globalVoiceCalls.delete(activeCall.callId);
      const peerUid = activeCall.callerUid === socket.data.uid ? activeCall.calleeUid : activeCall.callerUid;
      for (const client of connectedUsers.get(peerUid) || []) if (client.connected) {
        delete client.data.voiceCallId;
        client.emit("voiceCall:ended", { callId: activeCall.callId, reason: "disconnected" });
      }
    }
    // Save last-seen only after the user's final active socket disconnects.
    if (!connectedUsers.has(socket.data.uid)) {
      db.collection("users").doc(socket.data.uid).set({
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(error => {
        console.error("Failed to save last seen", { uid: socket.data.uid, error: error.message });
      });
    }
    io.emit("onlinePlayers", onlinePlayerList());

  });

});

app.get("/", (req, res) => {
  res.send("خادم مِرسالو يعمل");
});


const mediaUploadOrigins = new Set(["https://mersalo.onrender.com"]);
function mediaUploadCors(req,res,next){
  const origin=req.headers.origin;
  if(origin&&!mediaUploadOrigins.has(origin))return res.status(403).json({success:false,message:"Origin not allowed."});
  if(origin)res.setHeader("Access-Control-Allow-Origin",origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type, X-File-Name, X-File-Type, X-Conversation-Id");
  if(req.method==="OPTIONS")return res.sendStatus(204);
  next();
}
// Read the duration from ISO-BMFF/QuickTime video metadata (MP4/MOV).
// This runs on the uploaded bytes, so it does not depend on browser metadata APIs.
function readMp4DurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  const readBoxes = (start, end, wanted) => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      let headerSize = 8;
      if (size === 1) {
        if (offset + 16 > end) return null;
        const largeSize = buffer.readBigUInt64BE(offset + 8);
        if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(largeSize);
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < headerSize || offset + size > end) return null;
      const payloadStart = offset + headerSize;
      const boxEnd = offset + size;
      if (type === wanted) return { start: payloadStart, end: boxEnd };
      if (type === "moov" && wanted === "mvhd") {
        const found = readBoxes(payloadStart, boxEnd, wanted);
        if (found) return found;
      }
      offset = boxEnd;
    }
    return null;
  };
  const mvhd = readBoxes(0, buffer.length, "mvhd");
  if (!mvhd || mvhd.start + 20 > mvhd.end) return null;
  const version = buffer[mvhd.start];
  let timescaleOffset;
  let durationOffset;
  if (version === 0) {
    timescaleOffset = mvhd.start + 12;
    durationOffset = mvhd.start + 16;
    if (durationOffset + 4 > mvhd.end) return null;
    const timescale = buffer.readUInt32BE(timescaleOffset);
    const duration = buffer.readUInt32BE(durationOffset);
    return timescale > 0 && duration > 0 ? duration / timescale : null;
  }
  if (version === 1) {
    timescaleOffset = mvhd.start + 20;
    durationOffset = mvhd.start + 24;
    if (durationOffset + 8 > mvhd.end) return null;
    const timescale = buffer.readUInt32BE(timescaleOffset);
    const duration = buffer.readBigUInt64BE(durationOffset);
    return timescale > 0 && duration > 0n ? Number(duration) / timescale : null;
  }
  return null;
}

app.options("/api/upload-media",mediaUploadCors);
app.post("/api/upload-media",mediaUploadCors,express.raw({type:"application/octet-stream",limit:"50mb"}),async(req,res)=>{
  try{

    await assertFeatureEnabled("mediaSharing","مشاركة الوسائط والملفات متوقفة مؤقتًا من إدارة مِرسالو.");    const authHeader=String(req.headers.authorization||"");
    const match=authHeader.match(/^Bearer (.+)$/i);
    if(!match)return res.status(401).json({success:false,message:"Authentication required."});
    const decoded=await admin.auth().verifyIdToken(match[1]);
    const systemSettings=await readSystemSettings();
    const developer=String(decoded.email||"").toLowerCase()===MERSALO_ADMIN_EMAIL&&decoded.email_verified===true;
    if(systemSettings.maintenance&&!developer)return res.status(503).json({success:false,message:"مِرسالو في وضع الصيانة حاليًا."});
    const conversationId=String(req.headers["x-conversation-id"]||"");
    const mimeType=String(req.headers["x-file-type"]||"application/octet-stream").slice(0,150);
    const fileName=decodeURIComponent(String(req.headers["x-file-name"]||"file").slice(0,600)).replace(/[\\/]/g,"_").slice(0,180);
    if(!conversationId||!req.body||!Buffer.isBuffer(req.body)||!req.body.length) return res.status(400).json({success:false,message:"الملف فارغ أو بيانات الرفع غير مكتملة."});
    if(req.body.length>50*1024*1024)return res.status(413).json({success:false,message:"الحد الأقصى لحجم الملف 50 ميغابايت."});
    const conversationSnap=await admin.firestore().collection("conversations").doc(conversationId).get();
    if(!conversationSnap.exists||!(conversationSnap.data().members||[]).includes(decoded.uid))return res.status(403).json({success:false,message:"غير مصرح برفع ملف إلى هذه المحادثة."});
    const storagePath="conversations/"+conversationId+"/"+decoded.uid+"/"+require("crypto").randomUUID();
    const storage=getMediaStorage().storage.from("conversation-media");
    const {error:uploadError}=await storage.upload(storagePath,req.body,{contentType:mimeType,upsert:false,cacheControl:"3600"});
    if(uploadError)throw uploadError;
    const {data:signed,error:signedError}=await storage.createSignedUrl(storagePath,31536000);
    if(signedError)throw signedError;
    const durationSeconds=mimeType.startsWith("video/")?readMp4DurationSeconds(req.body):null;
    res.json({success:true,attachment:{name:fileName,type:mimeType,size:req.body.length,url:signed.signedUrl,storagePath,...(Number.isFinite(durationSeconds)&&durationSeconds>0?{durationSeconds:Math.round(durationSeconds)}:{})}});
  }catch(error){
    console.error("Media upload error:",error.message);
    const message=error.message==="Supabase private storage is not configured on the server."
      ?"لم يكتمل إعداد مساحة التخزين الجديدة على الخادم بعد."
      :"تعذر رفع الملف إلى مساحة تخزين مِرسالو. حاول مرة أخرى.";
    res.status(500).json({success:false,message});
  }
});

app.use(express.json({ limit: "32kb" }));

// Opt-in Supabase profile API. Firebase routes remain the default until the
// complete authentication and persistence cutover has been validated.
if (process.env.SUPABASE_PROFILE_API_ENABLED === "true") {
  const supabaseProfileHandlers = createSupabaseProfileHandlers({
    verifier: createSupabaseAuthVerifier(),
    createUserClient: accessToken => createSupabaseUserClient(accessToken),
    assertNameAllowed
  });
  app.options("/api/supabase/profile/me", pushCors);
  app.get("/api/supabase/profile/me", pushCors, supabaseProfileHandlers.getProfile);
  app.post("/api/supabase/profile/me", pushCors, supabaseProfileHandlers.updateProfile);
}

// Opt-in Supabase chat HTTP API. Existing Firebase Socket.IO handlers remain
// active until the frontend and all feature workflows complete the cutover.
if (process.env.SUPABASE_CHAT_API_ENABLED === "true") {
  const supabaseChatHandlers = createSupabaseChatHandlers({
    verifier: createSupabaseAuthVerifier(),
    createUserClient: accessToken => createSupabaseUserClient(accessToken)
  });
  app.use("/api/supabase/chat", pushCors);
  app.get("/api/supabase/chat/conversations", supabaseChatHandlers.listConversations);
  app.get("/api/supabase/chat/conversations/:conversationId", supabaseChatHandlers.getConversation);
  app.get("/api/supabase/chat/conversations/:conversationId/messages", supabaseChatHandlers.listMessages);
  app.post("/api/supabase/chat/conversations/direct", supabaseChatHandlers.createDirectConversation);
  app.post("/api/supabase/chat/conversations/group", supabaseChatHandlers.createGroupConversation);
  app.post("/api/supabase/chat/messages", supabaseChatHandlers.sendMessage);
  app.post("/api/supabase/chat/messages/:messageId/read", supabaseChatHandlers.markMessageRead);
  app.post("/api/supabase/chat/messages/:messageId/delivered", supabaseChatHandlers.markMessageDelivered);
  app.post("/api/supabase/chat/messages/:messageId/edit", supabaseChatHandlers.editMessage);
  app.post("/api/supabase/chat/messages/:messageId/delete-for-everyone", supabaseChatHandlers.deleteMessageForEveryone);
  app.post("/api/supabase/chat/conversations/:conversationId/hide", supabaseChatHandlers.hideConversation);
  app.post("/api/supabase/chat/conversations/:conversationId/clear-for-me", supabaseChatHandlers.clearConversationForMe);
  app.post("/api/supabase/chat/conversations/:conversationId/clear-for-everyone", supabaseChatHandlers.clearConversationForEveryone);
  app.delete("/api/supabase/chat/conversations/:conversationId", supabaseChatHandlers.deleteDirectConversation);
  app.post("/api/supabase/chat/friend-requests", supabaseChatHandlers.sendFriendRequest);
  app.post("/api/supabase/chat/friend-requests/:requestId/accept", supabaseChatHandlers.acceptFriendRequest);
  app.post("/api/supabase/chat/friend-requests/:requestId/decline", supabaseChatHandlers.declineFriendRequest);
  app.post("/api/supabase/chat/blocks", supabaseChatHandlers.blockUser);
  app.delete("/api/supabase/chat/blocks/:userId", supabaseChatHandlers.unblockUser);
}


let pushConfigured = false;
function ensurePushConfigured() {
  if (pushConfigured) return true;
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || "").trim();
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  pushConfigured = true;
  return true;
}
async function createUserNotification(uid, item) {
  try {
    const db = admin.firestore();
    const ref = db.collection("users").doc(uid).collection("notifications").doc();
    await ref.set({
      type: String(item.type || "general").slice(0, 40),
      title: String(item.title || "إشعار جديد").slice(0, 100),
      body: String(item.body || "").slice(0, 240),
      url: String(item.url || "chat.html").slice(0, 500),
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    if (!ensurePushConfigured()) { console.error("Push diagnostics: VAPID configuration is missing."); return; }
    const subscriptions = await db.collection("users").doc(uid).collection("pushSubscriptions").get();
    if (subscriptions.empty) { console.warn("Push diagnostics: no saved subscriptions for recipient."); return; }
    console.info("Push diagnostics: attempting delivery to", subscriptions.size, "subscription(s).");
    const payload = JSON.stringify({
      title: String(item.title || "إشعار جديد").slice(0, 100),
      body: String(item.body || "").slice(0, 180),
      url: String(item.url || "chat.html").slice(0, 500),
      tag: String(item.tag || item.type || "mersalo").slice(0, 80),
      type: String(item.type || "general").slice(0, 40)
    });
    await Promise.all(subscriptions.docs.map(async doc => {
      try {
        await webpush.sendNotification(doc.data(), payload, { TTL: item.type === "incomingCall" ? 60 : 3600, urgency: item.type === "incomingCall" ? "high" : "normal" });
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await doc.ref.delete().catch(() => {});
        } else {
          console.error("Push delivery failed:", error.statusCode || error.message);
        }
      }
    }));
  } catch (error) {
    console.error("Notification creation failed:", error.message);
  }
}
function pushCors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && origin !== "https://mersalo.onrender.com") return res.status(403).json({success:false,message:"Origin not allowed."});
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
async function authenticatedUid(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer (.+)$/i);
  if (!match) throw new Error("AUTH_REQUIRED");
  const decoded = await admin.auth().verifyIdToken(match[1]);
  return decoded.uid;
}

const usernameAuthAttempts = new Map();
function usernameAuthRateLimit(req, action) {
  const key = action + ":" + String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const recent = (usernameAuthAttempts.get(key) || []).filter(time => now - time < 60000);
  if (recent.length >= 10) return false;
  recent.push(now);
  usernameAuthAttempts.set(key, recent);
  if (usernameAuthAttempts.size > 5000) {
    for (const [entry, times] of usernameAuthAttempts) if (!times.some(time => now - time < 60000)) usernameAuthAttempts.delete(entry);
  }
  return true;
}
function normalizeLoginUsername(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("und");
}
function validateLoginUsername(value) {
  const name = String(value || "").normalize("NFKC").trim();
  if (name.length < 3 || name.length > 24 || !/^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,23}$/u.test(name)) {
    throw new Error("اسم المستخدم يجب أن يكون من 3 إلى 24 حرفًا أو رقمًا، ويمكن استخدام النقطة والشرطة.");
  }
  return name;
}
function deriveLoginPassword(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
app.post("/api/auth/register", pushCors, async (req, res) => {
  let createdUid = "";
  let createdUsernameKey = "";
  try {
    if (!usernameAuthRateLimit(req, "register")) return res.status(429).json({ success:false, message:"محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." });
    const username = validateLoginUsername(req.body?.username);
    const controls = await readSystemSettings();
    if (controls.maintenance) return res.status(503).json({ success:false, message:"مِرسالو في وضع الصيانة حاليًا." });
    if (!controls.registrationOpen) return res.status(403).json({ success:false, message:"إنشاء الحسابات الجديدة متوقف مؤقتًا." });
    const password = String(req.body?.password || "");
    if (password.length < 8 || password.length > 128) return res.status(400).json({ success:false, message:"كلمة المرور يجب أن تكون بين 8 و128 حرفًا." });
    await assertNameAllowed(username);
    const normalized = normalizeLoginUsername(username);
    createdUsernameKey = normalized;
    const db = admin.firestore();
    const usernameRef = db.collection("usernameIndex").doc(normalized);
    const existing = await usernameRef.get();
    if (existing.exists) return res.status(409).json({ success:false, message:"اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر." });
    const uid = crypto.randomUUID();
    createdUid = uid;
    const salt = crypto.randomBytes(16);
    const passwordHash = await deriveLoginPassword(password, salt);
    await admin.auth().createUser({ uid, displayName: username });
    await db.runTransaction(async transaction => {
      const claimed = await transaction.get(usernameRef);
      if (claimed.exists) {
        const error = new Error("اسم المستخدم مستخدم بالفعل. اختر اسمًا آخر.");
        error.status = 409;
        throw error;
      }
      transaction.create(usernameRef, { uid, username, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      transaction.create(db.collection("loginCredentials").doc(uid), {
        username: normalized,
        salt: salt.toString("base64"),
        passwordHash: passwordHash.toString("base64"),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      transaction.set(db.collection("users").doc(uid), {
        uid, username, playerName: username, displayName: username, email: "",
        authType: "username", createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    const customToken = await admin.auth().createCustomToken(uid);
    res.set("Cache-Control", "no-store");
    return res.json({ success:true, customToken, username });
  } catch (error) {
    if (createdUid) {
      await admin.auth().deleteUser(createdUid).catch(() => {});
      await admin.firestore().collection("loginCredentials").doc(createdUid).delete().catch(() => {});
      await admin.firestore().collection("users").doc(createdUid).delete().catch(() => {});
      if (createdUsernameKey) {
        const claimedName = admin.firestore().collection("usernameIndex").doc(createdUsernameKey);
        await admin.firestore().runTransaction(async transaction => {
          const snapshot = await transaction.get(claimedName);
          if (snapshot.exists && snapshot.data().uid === createdUid) transaction.delete(claimedName);
        }).catch(() => {});
      }
    }
    const status = error.status || (error.message?.includes("اسم المستخدم") || error.message?.includes("لفظ مسيء") || error.message?.includes("كلمة محظورة") ? 400 : 500);
    console.error("Username registration failed:", error.message);
    return res.status(status).json({ success:false, message:status===500?"تعذر إنشاء الحساب حاليًا. حاول مرة أخرى.":error.message });
  }
});
app.post("/api/auth/login", pushCors, async (req, res) => {
  try {
    if (!usernameAuthRateLimit(req, "login")) return res.status(429).json({ success:false, message:"محاولات كثيرة. انتظر دقيقة ثم حاول مجددًا." });
    const username = validateLoginUsername(req.body?.username);
    const password = String(req.body?.password || "");
    if (!password || password.length > 128) return res.status(400).json({ success:false, message:"اسم المستخدم أو كلمة المرور غير صحيحة." });
    const db = admin.firestore();
    const normalized = normalizeLoginUsername(username);
    const usernameSnap = await db.collection("usernameIndex").doc(normalized).get();
    if (!usernameSnap.exists) return res.status(401).json({ success:false, message:"اسم المستخدم أو كلمة المرور غير صحيحة." });
    const uid = String(usernameSnap.data().uid || "");
    const credentialSnap = await db.collection("loginCredentials").doc(uid).get();
    if (!credentialSnap.exists) return res.status(401).json({ success:false, message:"اسم المستخدم أو كلمة المرور غير صحيحة." });
    const saved = credentialSnap.data();
    const salt = Buffer.from(String(saved.salt || ""), "base64");
    const expected = Buffer.from(String(saved.passwordHash || ""), "base64");
    const actual = await deriveLoginPassword(password, salt);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return res.status(401).json({ success:false, message:"اسم المستخدم أو كلمة المرور غير صحيحة." });
    }
    const user = await admin.auth().getUser(uid);
    if (user.disabled) return res.status(403).json({ success:false, message:"هذا الحساب موقوف حاليًا." });
    await db.collection("users").doc(uid).set({ lastLoginAt:admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
    const customToken = await admin.auth().createCustomToken(uid);
    res.set("Cache-Control", "no-store");
    return res.json({ success:true, customToken, username:String(saved.username || username) });
  } catch (error) {
    const status = error.status || (error.message?.includes("اسم المستخدم") ? 400 : 500);
    console.error("Username login failed:", error.message);
    return res.status(status).json({ success:false, message:status===500?"تعذر تسجيل الدخول حاليًا. حاول مرة أخرى.":error.message });
  }
});

const MERSALO_ADMIN_EMAIL = "fahed656284alzereeni@gmail.com";
async function requireMersaloAdmin(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer (.+)$/i);
  if (!match) { const e=new Error("AUTH_REQUIRED"); e.status=401; throw e; }
  const decoded=await admin.auth().verifyIdToken(match[1]);
  if(String(decoded.email||"").toLowerCase()!==MERSALO_ADMIN_EMAIL || decoded.email_verified!==true) {
    const e=new Error("غير مصرح لك باستخدام لوحة إدارة مِرسالو."); e.status=403; throw e;
  }
  return decoded;
}
const SYSTEM_SETTINGS_REF = () => admin.firestore().collection("appSettings").doc("systemControl");
async function readSystemSettings(){
 const snap=await SYSTEM_SETTINGS_REF().get(),saved=snap.exists?snap.data():{};
 return {maintenance:saved.maintenance===true,registrationOpen:saved.registrationOpen!==false,features:{voiceCalls:saved.features?.voiceCalls!==false,groupChats:saved.features?.groupChats!==false,mediaSharing:saved.features?.mediaSharing!==false,scheduledMessages:saved.features?.scheduledMessages!==false}};
}
async function assertFeatureEnabled(feature,message){
 const settings=await readSystemSettings();
 if(settings.features[feature]===false)throw new Error(message||"الميزة متوقفة مؤقتًا.");
}
function sendAdminError(res,error) {
  const status=error.status||500;
  res.status(status).json({success:false,message:status===500?"تعذر تنفيذ طلب الإدارة. حاول مرة أخرى.":error.message});
}
function sanitizeDiagnosticValue(value,max=700){
  return String(value??"").replace(/Bearer\\s+[^\\s]+/gi,"Bearer [محجوب]").replace(/(token|password|authorization|secret|api[-_]?key)\\s*[:=]\\s*[^\\s&,]+/gi,"$1=[محجوب]").slice(0,max);
}
const diagnosticRateLimits = new Map();
app.post("/api/diagnostics/collect",pushCors,async(req,res)=>{
  try{
    const uid=await authenticatedUid(req);
    const now=Date.now(),windowMs=60000,maxPerMinute=30;
    const recent=(diagnosticRateLimits.get(uid)||[]).filter(time=>now-time<windowMs);
    if(recent.length>=maxPerMinute)return res.status(429).json({success:false,message:"Diagnostic rate limit reached."});
    const events=Array.isArray(req.body?.events)?req.body.events.slice(0,8):[];
    if(!events.length)return res.json({success:true,stored:0});
    const collection=admin.firestore().collection("developerDiagnostics");
    const batch=admin.firestore().batch();
    for(const item of events){
      const details=item?.details&&typeof item.details==="object"?item.details:{};
      const safeDetails={};
      for(const key of ["file","line","column","stack","endpoint","status","durationMs"]){
        if(details[key]!==undefined)safeDetails[key]=["line","column","status","durationMs"].includes(key)?Math.max(0,Math.min(100000000,Number(details[key])||0)):sanitizeDiagnosticValue(details[key],key==="stack"?1200:180);
      }
      batch.set(collection.doc(),{
        type:sanitizeDiagnosticValue(item?.type,40),
        message:sanitizeDiagnosticValue(item?.message,500),
        page:sanitizeDiagnosticValue(item?.page,120),
        action:sanitizeDiagnosticValue(item?.action,100),
        details:safeDetails,
        reporterUid:uid,
        createdAt:admin.firestore.FieldValue.serverTimestamp()
      });
    }
    recent.push(...events.map(()=>now));diagnosticRateLimits.set(uid,recent);
    if(diagnosticRateLimits.size>5000)diagnosticRateLimits.delete(diagnosticRateLimits.keys().next().value);
    await batch.commit();
    res.json({success:true,stored:events.length});
  }catch(error){
    const status=error.message==="AUTH_REQUIRED"?401:500;
    res.status(status).json({success:false,message:status===401?"Authentication required.":"Unable to store diagnostics."});
  }
});
app.post("/api/admin/diagnostics",pushCors,async(req,res)=>{
  try{
    const actor=await requireMersaloAdmin(req);
    const events=Array.isArray(req.body?.events)?req.body.events.slice(0,10):[];
    if(!events.length)return res.json({success:true,stored:0});
    const collection=admin.firestore().collection("developerDiagnostics");
    const batch=admin.firestore().batch();
    for(const item of events){
      const details=item?.details&&typeof item.details==="object"?item.details:{};
      const safeDetails={};
      for(const key of ["file","line","column","stack","endpoint","status","durationMs"]){
        if(details[key]!==undefined)safeDetails[key]=key==="line"||key==="column"||key==="status"||key==="durationMs"?Number(details[key])||0:sanitizeDiagnosticValue(details[key],key==="stack"?1200:180);
      }
      const ref=collection.doc();
      batch.set(ref,{type:sanitizeDiagnosticValue(item?.type,40),message:sanitizeDiagnosticValue(item?.message,700),page:sanitizeDiagnosticValue(item?.page,180),action:sanitizeDiagnosticValue(item?.action,120),details:safeDetails,reporterUid:actor.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});
    }
    await batch.commit();
    res.json({success:true,stored:events.length});
  }catch(error){sendAdminError(res,error);}
});
app.get("/api/admin/diagnostics",pushCors,async(req,res)=>{
  try{
    await requireMersaloAdmin(req);
    const snap=await admin.firestore().collection("developerDiagnostics").orderBy("createdAt","desc").limit(100).get();
    res.json({success:true,events:snap.docs.map(doc=>{const v=doc.data();return{id:doc.id,type:v.type||"error",message:v.message||"",page:v.page||"",action:v.action||"",details:v.details||{},createdAt:v.createdAt?.toDate?.().toISOString?.()||null};})});
  }catch(error){sendAdminError(res,error);}
});

app.options("/api/admin/:action",pushCors);
app.get("/api/admin/dashboard",pushCors,async(req,res)=>{
  try {
    await requireMersaloAdmin(req);
    const db=admin.firestore();
    const [users,conversations,reports]=await Promise.all([
      db.collection("users").count().get(),
      db.collection("conversations").count().get(),
      db.collection("userReports").where("status","==","new").count().get()
    ]);
    res.json({success:true,stats:{users:users.data().count,conversations:conversations.data().count,pendingReports:reports.data().count,online:connectedUsers.size}});
  } catch(error) { sendAdminError(res,error); }
});
app.get("/api/admin/reports",pushCors,async(req,res)=>{
  try {
    await requireMersaloAdmin(req);
    const snap=await admin.firestore().collection("userReports").orderBy("createdAt","desc").limit(100).get();
    const uids=[...new Set(snap.docs.flatMap(d=>[d.data().reportedUid,d.data().reporterUid]).filter(Boolean))];
    const profiles=uids.length?await admin.firestore().getAll(...uids.map(uid=>admin.firestore().collection("users").doc(uid))):[];
    const names=new Map(profiles.map(p=>[p.id,p.exists?String(p.data().playerName||p.data().displayName||"مستخدم"):"حساب غير موجود"]));
    res.json({success:true,reports:snap.docs.map(d=>{const v=d.data();return{id:d.id,reportedUid:v.reportedUid,reportedName:names.get(v.reportedUid)||"مستخدم",reporterName:names.get(v.reporterUid)||"مستخدم",reason:String(v.reason||""),details:String(v.details||""),status:String(v.status||"new")};})});
  } catch(error) { sendAdminError(res,error); }
});
app.post("/api/admin/warn",pushCors,express.json({limit:"32kb"}),async(req,res)=>{
  try {
    const actor=await requireMersaloAdmin(req);
    const uid=String(req.body?.uid||"").trim(),reason=String(req.body?.reason||"").trim().slice(0,500),reportId=String(req.body?.reportId||"").trim();
    if(!uid||!reason)return res.status(400).json({success:false,message:"حدد الحساب وسبب التحذير."});
    const target=await admin.firestore().collection("users").doc(uid).get();
    if(!target.exists)return res.status(404).json({success:false,message:"الحساب غير موجود."});
    await createUserNotification(uid,{type:"accountWarning",title:"تحذير من إدارة مِرسالو",body:"تم توجيه تحذير إلى حسابك. السبب: "+reason,url:"settings.html"});
    await admin.firestore().collection("adminActions").add({type:"warning",targetUid:uid,reason,reportId:reportId||null,adminUid:actor.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});
    if(reportId)await admin.firestore().collection("userReports").doc(reportId).set({status:"reviewed",reviewedBy:actor.uid,reviewedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    res.json({success:true,message:"تم إرسال التحذير وتسجيل الإجراء."});
  } catch(error) { sendAdminError(res,error); }
});

app.get("/api/admin/audit-log",pushCors,async(req,res)=>{
  try{
    await requireMersaloAdmin(req);
    const snap=await admin.firestore().collection("adminActions").orderBy("createdAt","desc").limit(100).get();
    const uids=[...new Set(snap.docs.flatMap(d=>[d.data().targetUid,d.data().adminUid]).filter(Boolean))];
    const profiles=uids.length?await admin.firestore().getAll(...uids.map(uid=>admin.firestore().collection("users").doc(uid))):[];
    const names=new Map(profiles.map(p=>[p.id,p.exists?String(p.data().playerName||p.data().displayName||"مستخدم"):"حساب محذوف"]));
    const labels={warning:"إرسال تحذير",suspend:"إيقاف حساب",restore:"إعادة تفعيل حساب","revoke-sessions":"إنهاء الجلسات","rename-account":"تغيير اسم حساب","system-settings":"تحديث إعدادات الموقع والميزات"};
    res.json({success:true,actions:snap.docs.map(d=>{
      const v=d.data();
      return{id:d.id,type:String(v.type||"إجراء إداري"),label:labels[v.type]||"إجراء إداري",targetUid:String(v.targetUid||""),targetName:names.get(v.targetUid)||"",adminUid:String(v.adminUid||""),adminEmail:v.adminUid===req.adminUser?.uid?"المطوّر":(names.get(v.adminUid)||"الإدارة"),reason:String(v.reason||""),newName:String(v.newName||""),createdAt:v.createdAt?.toDate?.().toISOString?.()||null};
    })});
  }catch(error){sendAdminError(res,error);}
});

// Explicitly answer browser preflight requests for profile reads and saves.
app.options("/api/profile/me",pushCors);
// Developer control center: strict allow-list, no arbitrary code execution.
app.get("/api/profile/me",pushCors,async(req,res)=>{
 try{
  const match=String(req.headers.authorization||"").match(/^Bearer (.+)$/i);
  if(!match)throw new Error("AUTH_REQUIRED");
  const decoded=await admin.auth().verifyIdToken(match[1]);
  const uid=decoded.uid;
  const db=admin.firestore();
  const authUser=await admin.auth().getUser(uid);
  const ref=db.collection("users").doc(uid);
  const snap=await ref.get();
  let data=snap.exists?snap.data():{};
  let playerName=String(data.playerName||data.displayName||data.username||data.userName||data.name||authUser.displayName||authUser.providerData?.find(provider=>provider.providerId==="google.com")?.displayName||decoded.name||"").trim();
  let bio=String(data.bio||"").slice(0,200);
  if(!playerName&&authUser.email){
   const matches=await db.collection("users").where("email","==",authUser.email).limit(10).get();
   for(const item of matches.docs){
    const old=item.data();
    const found=String(old.playerName||old.displayName||old.username||old.userName||old.name||"").trim();
    if(found){
     playerName=found;bio=String(old.bio||"").slice(0,200);
     break;
    }
   }
  }
  // Socket sign-in already uses the verified Google token's name as a fallback.
  // Persist that same name on the user's own profile so the profile form is never blank.
  if(playerName){
   await ref.set({uid,email:String(authUser.email||decoded.email||""),playerName,displayName:playerName,username:playerName,name:playerName,bio},{merge:true});
  }
  res.set("Cache-Control","no-store, no-cache, must-revalidate");
  res.json({success:true,playerName,bio,email:String(authUser.email||data.email||decoded.email||"")});
 }catch(error){
  console.error("Profile read failed:",error.message);
  const status=error.message==="AUTH_REQUIRED"?401:500;
  res.status(status).json({success:false,message:"تعذر تحميل بيانات الحساب."});
 }
});
app.post("/api/profile/me",pushCors,express.json({limit:"8kb"}),async(req,res)=>{
 try{
  const uid=await authenticatedUid(req);
  const playerName=String(req.body?.playerName||"").trim();
  const bio=String(req.body?.bio||"").trim();
  if(playerName.length<2||playerName.length>30)return res.status(400).json({success:false,message:"اسم المستخدم يجب أن يكون بين حرفين و30 حرفًا."});
  if(bio.length>200)return res.status(400).json({success:false,message:"النبذة الشخصية لا يمكن أن تتجاوز 200 حرف."});
  await assertNameAllowed(playerName);
  const authUser=await admin.auth().getUser(uid);
  await admin.auth().updateUser(uid,{displayName:playerName});
  await admin.firestore().collection("users").doc(uid).set({uid,email:String(authUser.email||""),displayName:playerName,playerName,username:playerName,name:playerName,bio,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  res.set("Cache-Control","no-store");
  res.json({success:true,playerName,bio,message:"تم حفظ الملف الشخصي بنجاح."});
 }catch(error){
  const status=error.message==="AUTH_REQUIRED"?401:400;
  res.status(status).json({success:false,message:error.message==="AUTH_REQUIRED"?"يرجى تسجيل الدخول مجددًا.":error.message||"تعذر حفظ الملف الشخصي."});
 }
});
app.get("/api/public/system-settings",pushCors,async(req,res)=>{
 try{res.set("Cache-Control","no-store");res.json({success:true,settings:await readSystemSettings()});}
 catch(error){res.status(503).json({success:false,message:"تعذر قراءة حالة الموقع."});}
});
app.get("/api/admin/system-settings",pushCors,async(req,res)=>{
 try{await requireMersaloAdmin(req);res.set("Cache-Control","no-store");const snap=await SYSTEM_SETTINGS_REF().get();res.json({success:true,settings:await readSystemSettings(),developerNotes:String(snap.exists?snap.data().developerNotes||"": "")});}
 catch(error){sendAdminError(res,error);}
});
app.post("/api/admin/system-settings",pushCors,express.json({limit:"8kb"}),async(req,res)=>{
 try{
  const actor=await requireMersaloAdmin(req),body=req.body||{},features=body.features&&typeof body.features==="object"?body.features:{};
  const developerNotes=typeof body.developerNotes==="string"?body.developerNotes.slice(0,5000):undefined;
   if(developerNotes!==undefined){await SYSTEM_SETTINGS_REF().set({developerNotes,notesUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),notesUpdatedBy:actor.uid},{merge:true});return res.json({success:true,message:"تم حفظ ملاحظات المطوّر."});}
   const clean={maintenance:body.maintenance===true,registrationOpen:body.registrationOpen!==false,features:{voiceCalls:features.voiceCalls!==false,groupChats:features.groupChats!==false,mediaSharing:features.mediaSharing!==false,scheduledMessages:features.scheduledMessages!==false},updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.uid};
  await SYSTEM_SETTINGS_REF().set(clean,{merge:true});
  if(clean.maintenance){for(const sockets of connectedUsers.values()){for(const client of sockets){if(String(client.data.email||"").toLowerCase()!==MERSALO_ADMIN_EMAIL)client.disconnect(true);}}}
  await admin.firestore().collection("adminActions").add({type:"system-settings",reason:"تحديث إعدادات الموقع والميزات",adminUid:actor.uid,createdAt:admin.firestore.FieldValue.serverTimestamp(),settings:{maintenance:clean.maintenance,registrationOpen:clean.registrationOpen,features:clean.features}});
  res.set("Cache-Control","no-store");res.json({success:true,message:"تم حفظ إعدادات الموقع والميزات.",settings:{maintenance:clean.maintenance,registrationOpen:clean.registrationOpen,features:clean.features}});
 }catch(error){sendAdminError(res,error);}
});
app.get("/api/admin/control-center/status",pushCors,async(req,res)=>{
 try{
  await requireMersaloAdmin(req);
  res.set("Cache-Control","no-store");
  res.json({success:true,server:{status:"ok",uptimeSeconds:Math.floor(process.uptime()),checkedAt:new Date().toISOString()}});
 }catch(error){sendAdminError(res,error);}
});
app.get("/api/admin/control-center/logs",pushCors,async(req,res)=>{
 try{
  await requireMersaloAdmin(req);
  const snap=await admin.firestore().collection("adminControlLogs").orderBy("createdAt","desc").limit(30).get();
  res.json({success:true,logs:snap.docs.map(d=>{const v=d.data();return{id:d.id,command:String(v.command||""),message:String(v.message||""),createdAt:v.createdAt?.toDate?.().toISOString?.()||null};})});
 }catch(error){sendAdminError(res,error);}
});
app.post("/api/admin/control-center/command",pushCors,express.json({limit:"4kb"}),async(req,res)=>{
 try{
  const actor=await requireMersaloAdmin(req);
  const command=String(req.body?.command||"").trim();
  if(command!=="health-check")return res.status(400).json({success:false,message:"هذا الأمر غير متاح. اختر فحص حالة الخادم."});
  const result={status:"ok",uptimeSeconds:Math.floor(process.uptime()),checkedAt:new Date().toISOString()};
  const message="الخادم يعمل ويستجيب.";
  await admin.firestore().collection("adminControlLogs").add({command,actorUid:actor.uid,actorEmail:String(actor.email||""),message,resultStatus:result.status,createdAt:admin.firestore.FieldValue.serverTimestamp()});
  res.set("Cache-Control","no-store");
  res.json({success:true,message,result});
 }catch(error){sendAdminError(res,error);}
});

app.get("/api/admin/name-terms",pushCors,async(req,res)=>{
 try{
  await requireMersaloAdmin(req);
  const snap=await admin.firestore().collection("appSettings").doc("nameModeration").get();
  const terms=snap.exists&&Array.isArray(snap.data().blockedTerms)?snap.data().blockedTerms:[];
  res.json({success:true,terms});
 }catch(error){sendAdminError(res,error);}
});
app.post("/api/admin/name-terms",pushCors,express.json({limit:"32kb"}),async(req,res)=>{
 try{
  const actor=await requireMersaloAdmin(req);
  if(!Array.isArray(req.body?.terms))return res.status(400).json({success:false,message:"أرسل قائمة الكلمات المحظورة."});
  const terms=[...new Set(req.body.terms.map(v=>String(v||"").trim()).filter(Boolean))].slice(0,500);
  if(terms.some(v=>v.length>80))return res.status(400).json({success:false,message:"لا يمكن أن تتجاوز الكلمة الواحدة 80 حرفًا."});
  await admin.firestore().collection("appSettings").doc("nameModeration").set({blockedTerms:terms,updatedAt:admin.firestore.FieldValue.serverTimestamp(),updatedBy:actor.uid},{merge:true});
  res.json({success:true,message:"تم حفظ قائمة الكلمات المحظورة.",terms});
 }catch(error){sendAdminError(res,error);}
});
app.post("/api/name-check",pushCors,express.json({limit:"8kb"}),async(req,res)=>{
 try{
  await authenticatedUid(req);
  const name=String(req.body?.name||"").trim();
  if(name.length<2||name.length>50)return res.status(400).json({success:false,message:"يجب أن يكون الاسم بين حرفين و50 حرفًا."});
  await assertNameAllowed(name);
  res.json({success:true,allowed:true});
 }catch(error){
  const status=error.message==="AUTH_REQUIRED"?401:400;
  res.status(status).json({success:false,message:error.message==="AUTH_REQUIRED"?"يرجى تسجيل الدخول مجددًا.":error.message||"تعذر فحص الاسم."});
 }
});

app.get("/api/admin/groups",pushCors,async(req,res)=>{
 try{
  await requireMersaloAdmin(req);
  const snap=await admin.firestore().collection("conversations").where("type","==","group").get();
  const groups=snap.docs.map(doc=>{const v=doc.data(),until=v.adminGroupSuspendedUntil?.toMillis?.()||0;return{id:doc.id,name:String(v.groupName||"مجموعة"),suspended:v.adminGroupSuspended===true,suspendedUntil:until>Date.now()?until:0};}).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  res.json({success:true,groups});
 }catch(error){sendAdminError(res,error);}
});
app.post("/api/admin/group-control",pushCors,express.json({limit:"32kb"}),async(req,res)=>{
 try{
  const actor=await requireMersaloAdmin(req),id=String(req.body?.conversationId||"").trim(),action=String(req.body?.action||"");
  if(!id||!["suspend","restore","timed-suspend","delete"].includes(action))return res.status(400).json({success:false,message:"بيانات الإجراء غير صالحة."});
  const db=admin.firestore(),ref=db.collection("conversations").doc(id),snap=await ref.get();
  if(!snap.exists||snap.data().type!=="group")return res.status(404).json({success:false,message:"المجموعة غير موجودة."});
  const members=Array.isArray(snap.data().members)?snap.data().members:[];
  if(action==="delete"){
   // Delete messages in bounded batches from this HTTP admin route.
   // The socket-scoped deleteConversationMessages helper is not accessible here.
   const messagesRef=ref.collection("messages");
   let deletedMessages=0;
   while(true){
    const messageBatch=await messagesRef.limit(450).get();
    if(messageBatch.empty)break;
    const batch=db.batch();
    for(const message of messageBatch.docs)batch.delete(message.ref);
    await batch.commit();
    deletedMessages+=messageBatch.size;
    if(messageBatch.size<450)break;
   }
   await ref.delete();
   for(const uid of members){for(const client of connectedUsers.get(uid)||[])if(client.connected)client.emit("directConversationDeleted",{conversationId:id});}
  }else if(action==="restore"){
   await ref.set({adminGroupSuspended:false,adminGroupSuspendedUntil:admin.firestore.FieldValue.delete(),adminGroupStatusUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  }else if(action==="suspend"){
   await ref.set({adminGroupSuspended:true,adminGroupSuspendedUntil:admin.firestore.FieldValue.delete(),adminGroupStatusUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  }else{
   const hours=Number(req.body?.hours);
   if(!Number.isInteger(hours)||hours<1||hours>8760)return res.status(400).json({success:false,message:"المدة يجب أن تكون من ساعة إلى 365 يومًا."});
   await ref.set({adminGroupSuspended:false,adminGroupSuspendedUntil:admin.firestore.Timestamp.fromMillis(Date.now()+hours*3600000),adminGroupStatusUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  }
  try{await db.collection("adminActions").add({type:"group-"+action,conversationId:id,groupName:String(snap.data().groupName||"مجموعة"),adminUid:actor.uid,hours:action==="timed-suspend"?Number(req.body.hours):null,createdAt:admin.firestore.FieldValue.serverTimestamp()});}
  catch(auditError){console.warn("Admin group action audit failed:",{action,id,message:auditError.message});}
  res.json({success:true,message:action==="delete"?"تم حذف المجموعة ورسائلها نهائيًا.":action==="restore"?"تمت إعادة تفعيل المجموعة.":action==="suspend"?"تم إيقاف المجموعة.":"تم تعليق المجموعة مؤقتًا."});
 }catch(error){
  console.error("Admin group control failed:",{action:String(req.body?.action||""),conversationId:String(req.body?.conversationId||""),code:error.code||"",message:error.message||String(error)});
  sendAdminError(res,error);
 }
});
app.get("/api/admin/accounts",pushCors,async(req,res)=>{
  try {
    await requireMersaloAdmin(req);
    const snap=await admin.firestore().collection("users").get();
    const matches=snap.docs.sort((a,b)=>{
      const aName=String(a.data().playerName||a.data().displayName||"مستخدم");
      const bName=String(b.data().playerName||b.data().displayName||"مستخدم");
      return aName.localeCompare(bName,"ar");
    });
    const accounts=await Promise.all(matches.map(async doc=>{
      const v=doc.data();
      let authUser=null;
      try{authUser=await admin.auth().getUser(doc.id)}catch(_){}
      const [friends,conversations,warnings]=await Promise.all([
        admin.firestore().collection("users").doc(doc.id).collection("friends").count().get().catch(()=>null),
        admin.firestore().collection("conversations").where("members","array-contains",doc.id).count().get().catch(()=>null),
        admin.firestore().collection("adminActions").where("targetUid","==",doc.id).where("type","==","warning").count().get().catch(()=>null)
      ]);
      return{uid:doc.id,name:String(v.playerName||v.displayName||"مستخدم"),email:String(authUser?.email||v.email||""),disabled:!!authUser?.disabled,restricted:v.messagingRestricted===true,bio:String(v.bio||"").slice(0,200),createdAt:authUser?.metadata?.creationTime?Date.parse(authUser.metadata.creationTime):0,lastSeenAt:v.lastSeenAt?.toMillis?.()||0,friendCount:friends?.data().count||0,conversationCount:conversations?.data().count||0,warningCount:warnings?.data().count||0};
    }));
    res.json({success:true,accounts});
  } catch(error) { sendAdminError(res,error); }
});
app.post("/api/admin/account-name",pushCors,express.json({limit:"32kb"}),async(req,res)=>{
  try{
    const actor=await requireMersaloAdmin(req);
    const uid=String(req.body?.uid||"").trim();
    const name=String(req.body?.name||"").trim().replace(/\\s+/g," ").slice(0,40);
    if(!uid)return res.status(400).json({success:false,message:"حدد الحساب الذي تريد تغيير اسمه."});
    if(name.length<2)return res.status(400).json({success:false,message:"يجب أن يتكون الاسم من حرفين على الأقل."});
    try{await assertNameAllowed(name);}catch(error){return res.status(400).json({success:false,message:error.message});}
    if(/[<>]/.test(name))return res.status(400).json({success:false,message:"الاسم يحتوي على رموز غير مسموح بها."});

    const db=admin.firestore();
    const userRef=db.collection("users").doc(uid);
    const userSnap=await userRef.get();
    if(!userSnap.exists)return res.status(404).json({success:false,message:"الحساب غير موجود."});

    // Firestore is the source of truth for names displayed throughout Mersalo.
    await userRef.set({
      playerName:name,
      displayName:name,
      adminNameUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),
      adminNameUpdatedBy:actor.uid
    },{merge:true});

    // Keep Firebase Auth in sync, but do not undo a successful profile rename
    // if the Auth profile update is temporarily unavailable.
    let authProfileUpdated=true;
    try{await admin.auth().updateUser(uid,{displayName:name});}
    catch(error){authProfileUpdated=false;console.warn("Admin rename Auth profile sync failed:",{uid,message:error.message});}

    profileCache.delete(uid);
    for(const client of connectedUsers.get(uid)||[])client.data.playerName=name;
    io.emit("onlinePlayers",onlinePlayerList());
    io.emit("accountNameUpdated",{uid,name});

    // Historical message names are resolved from the current profile at read
    // time, so a large collectionGroup rewrite is unnecessary and can fail
    // when Firestore indexes or old message data are incomplete.
    try{
      await db.collection("adminActions").add({
        type:"rename-account",targetUid:uid,newName:name,adminUid:actor.uid,
        authProfileUpdated,
        createdAt:admin.firestore.FieldValue.serverTimestamp()
      });
    }catch(error){console.warn("Admin rename audit write failed:",error.message);}

    res.json({
      success:true,
      message:authProfileUpdated
        ?"تم تغيير الاسم بنجاح وسيظهر الاسم الجديد في مِرسالو."
        :"تم تغيير الاسم في مِرسالو، وتعذرت مزامنة الاسم في ملف تسجيل الدخول مؤقتًا.",
      name,
      authProfileUpdated
    });
  }catch(error){sendAdminError(res,error);}
});
app.post("/api/admin/account-control",pushCors,express.json({limit:"32kb"}),async(req,res)=>{
  try{
    const actor=await requireMersaloAdmin(req),uid=String(req.body?.uid||"").trim(),action=String(req.body?.action||""),reason=String(req.body?.reason||"").trim().slice(0,500);
    if(!uid||(uid===actor.uid&&action!=="update-bio"))return res.status(400).json({success:false,message:"لا يمكن تنفيذ هذا الإجراء على حسابك."});
    const db=admin.firestore(),ref=db.collection("users").doc(uid),snap=await ref.get();
    if(!snap.exists)return res.status(404).json({success:false,message:"الحساب غير موجود."});
    if(action==="restrict-messaging"||action==="unrestrict-messaging"){
      const restricted=action==="restrict-messaging";
      await ref.set({messagingRestricted:restricted,messagingRestrictionReason:restricted?reason:"",messagingRestrictedAt:restricted?admin.firestore.FieldValue.serverTimestamp():null},{merge:true});
      if(restricted)for(const client of connectedUsers.get(uid)||[])client.emit("accountMessagingRestricted",{message:"تم تقييد إرسال الرسائل لهذا الحساب."});
      await db.collection("adminActions").add({type:action,targetUid:uid,adminUid:actor.uid,reason,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return res.json({success:true,message:restricted?"تم تقييد المراسلة.":"تم إلغاء تقييد المراسلة."});
    }
    if(action==="warning"){
      if(!reason)return res.status(400).json({success:false,message:"سبب الإنذار مطلوب."});
      await db.collection("adminActions").add({type:"warning",targetUid:uid,adminUid:actor.uid,reason,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return res.json({success:true,message:"تم تسجيل الإنذار على الحساب."});
    }
    if(action==="update-bio"){
      if(typeof req.body?.bio!=="string")return res.status(400).json({success:false,message:"اكتب النبذة أو اتركها فارغة لمسحها."});
      const bio=req.body.bio.trim().slice(0,200);
      await ref.set({bio,adminBioUpdatedAt:admin.firestore.FieldValue.serverTimestamp(),adminBioUpdatedBy:actor.uid},{merge:true});
      profileCache.delete(uid);
      await db.collection("adminActions").add({type:"update-bio",targetUid:uid,adminUid:actor.uid,bioLength:bio.length,createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return res.json({success:true,message:bio?"تم تحديث نبذة الحساب بنجاح.":"تم مسح نبذة الحساب بنجاح.",bio});
    }
    if(action==="clear-bio"){
      await ref.set({bio:""},{merge:true});
      return res.json({success:true,message:"تم مسح النبذة الشخصية."});
    }
    if(action==="timed-suspend"){
      const hours=Number(req.body?.hours);
      if(!Number.isInteger(hours)||hours<1||hours>8760||!reason)return res.status(400).json({success:false,message:"مدة الإيقاف أو السبب غير صالح. الحد من ساعة إلى 365 يومًا."});
      const until=Date.now()+hours*3600000;
      await admin.auth().updateUser(uid,{disabled:true});
      await admin.auth().revokeRefreshTokens(uid);
      await ref.set({accountSuspended:true,accountStatus:"suspended",suspendedUntil:admin.firestore.Timestamp.fromMillis(until),accountSuspensionReason:reason,accountStatusUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
      for(const client of connectedUsers.get(uid)||[])client.disconnect(true);
      await db.collection("adminActions").add({type:"timed-suspend",targetUid:uid,adminUid:actor.uid,reason,hours,suspendedUntil:admin.firestore.Timestamp.fromMillis(until),createdAt:admin.firestore.FieldValue.serverTimestamp()});
      return res.json({success:true,message:"تم إيقاف الحساب مؤقتًا. ستتم إعادة تفعيله عند انتهاء المدة."});
    }
    return res.status(400).json({success:false,message:"الإجراء غير معروف."});
  }catch(error){sendAdminError(res,error);}
});
app.post("/api/admin/account-action",pushCors,express.json({limit:"32kb"}),async(req,res)=>{
  try{
    const actor=await requireMersaloAdmin(req);
    const uid=String(req.body?.uid||"").trim(),action=String(req.body?.action||"");
    if(!uid||uid===actor.uid)return res.status(400).json({success:false,message:"لا يمكن تنفيذ الإجراء على حسابك أو دون تحديد حساب."});
    if(!["suspend","restore","revoke-sessions"].includes(action))return res.status(400).json({success:false,message:"الإجراء المطلوب غير معروف."});
    const authUser=await admin.auth().getUser(uid);
    if(action==="suspend")await admin.auth().updateUser(uid,{disabled:true});
    if(action==="restore")await admin.auth().updateUser(uid,{disabled:false});
    await admin.auth().revokeRefreshTokens(uid);
    if(action==="suspend"||action==="restore"){
      await admin.firestore().collection("users").doc(uid).set({accountSuspended:action==="suspend",accountStatus:action==="suspend"?"suspended":"active",accountStatusUpdatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    }
    if(action==="suspend"){
      for(const client of connectedUsers.get(uid)||[])client.disconnect(true);
    }
    await admin.firestore().collection("adminActions").add({type:action,targetUid:uid,adminUid:actor.uid,createdAt:admin.firestore.FieldValue.serverTimestamp()});
    const messages={suspend:"تم إيقاف الحساب وإنهاء اتصالاته الحالية.",restore:"تمت إعادة تفعيل الحساب.", "revoke-sessions":"تم تسجيل خروج الحساب من الجلسات الحالية. سيحتاج إلى تسجيل الدخول مجددًا."};
    res.json({success:true,message:messages[action],account:{uid,disabled:action==="suspend"?true:action==="restore"?false:!!authUser.disabled}});
  }catch(error){sendAdminError(res,error);}
});



// Public community posts and AdSense configuration.
app.get("/api/public-posts",pushCors,async(req,res)=>{
  try{
    const snap=await admin.firestore().collection("publicPosts").where("status","==","approved").get();
    const posts=snap.docs.map(d=>{const v=d.data();return{id:d.id,title:String(v.title||""),body:String(v.body||""),authorName:String(v.authorName||"مستخدم"),createdAt:v.createdAt?.toDate?.().toISOString?.()||null,sortAt:v.createdAt?.toMillis?.()||0};}).sort((a,b)=>b.sortAt-a.sortAt).slice(0,100).map(({sortAt,...post})=>post);
    res.json({success:true,posts});
  }catch(error){console.error("Public posts load error:",error.message);res.status(500).json({success:false,message:"تعذر تحميل المنشورات العامة."});}
});
app.post("/api/public-posts",pushCors,async(req,res)=>{
  try{
    const uid=await authenticatedUid(req);
    const title=String(req.body?.title||"").trim().slice(0,100);
    const body=String(req.body?.body||"").trim().slice(0,2500);
    if(title.length<3||body.length<20)return res.status(400).json({success:false,message:"العنوان يجب ألا يقل عن 3 أحرف، والمنشور عن 20 حرفًا."});
    const db=admin.firestore(),userRef=db.collection("users").doc(uid),userSnap=await userRef.get();
    const last=userSnap.data()?.lastPublicPostAt?.toMillis?.()||0;
    if(Date.now()-last<120000)return res.status(429).json({success:false,message:"يمكنك إرسال منشور جديد بعد دقيقتين."});
    const name=String(userSnap.data()?.playerName||userSnap.data()?.displayName||"مستخدم").slice(0,40);
    const post=await db.collection("publicPosts").add({title,body,authorUid:uid,authorName:name,status:"pending",createdAt:admin.firestore.FieldValue.serverTimestamp()});
    await userRef.set({lastPublicPostAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
    res.json({success:true,message:"وصل منشورك للمراجعة، وسيظهر للجميع بعد موافقة الإدارة.",id:post.id});
  }catch(error){const status=error.message==="AUTH_REQUIRED"?401:500;res.status(status).json({success:false,message:status===401?"سجّل الدخول لإرسال منشور.":"تعذر إرسال المنشور."});}
});
app.get("/api/public-integrations",pushCors,async(req,res)=>{
  try{const snap=await admin.firestore().collection("siteSettings").doc("monetization").get();const v=snap.exists?snap.data():{};res.json({success:true,analyticsId:/^G-[A-Z0-9]{4,20}$/.test(String(v.analyticsId||""))?String(v.analyticsId):"",searchVerification:String(v.searchVerification||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,200)});}
  catch(error){res.json({success:true,analyticsId:"",searchVerification:""});}
});
app.get("/api/public-ads",pushCors,async(req,res)=>{
  try{
    const snap=await admin.firestore().collection("siteSettings").doc("monetization").get();
    const v=snap.exists?snap.data():{};
    const valid=!!v.adsEnabled&&/^ca-pub-[0-9]{10,25}$/.test(String(v.clientId||""))&&/^[0-9]{5,25}$/.test(String(v.slotId||""));
    res.json({success:true,enabled:valid,clientId:valid?String(v.clientId):"",slotId:valid?String(v.slotId):""});
  }catch(error){res.json({success:true,enabled:false,clientId:"",slotId:""});}
});
app.options("/api/public-posts",pushCors);
app.options("/api/public-ads",pushCors);
app.options("/api/admin/*",pushCors);
app.options("/api/push/:action", pushCors);
app.options("/api/notifications", pushCors);
app.options("/api/notifications/:id", pushCors);
app.options("/api/notifications/:id/read", pushCors);
app.get("/api/push/public-key", pushCors, (req,res) => {
  const key=String(process.env.VAPID_PUBLIC_KEY||"").trim();
  if(!key||!ensurePushConfigured()) return res.status(503).json({success:false,message:"Push notifications are not configured."});
  res.json({success:true,publicKey:key});
});
app.post("/api/push/subscribe", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    const sub=req.body&&req.body.subscription;
    if(!sub||typeof sub.endpoint!=="string"||!sub.endpoint.startsWith("https://")||!sub.keys||typeof sub.keys.p256dh!=="string"||typeof sub.keys.auth!=="string") return res.status(400).json({success:false,message:"Invalid subscription."});
    const key=crypto.createHash("sha256").update(sub.endpoint).digest("hex");
    await admin.firestore().collection("users").doc(uid).collection("pushSubscriptions").doc(key).set({endpoint:sub.endpoint,keys:sub.keys,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    res.json({success:true});
  } catch(error) { res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"Unable to save push subscription."}); }
});
app.post("/api/push/unsubscribe", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    const endpoint=String(req.body&&req.body.endpoint||"");
    if(!endpoint.startsWith("https://")) return res.status(400).json({success:false,message:"Invalid endpoint."});
    const key=crypto.createHash("sha256").update(endpoint).digest("hex");
    await admin.firestore().collection("users").doc(uid).collection("pushSubscriptions").doc(key).delete();
    res.json({success:true});
  } catch(error) { res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"Unable to remove push subscription."}); }
});
app.post("/api/push/test", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    if(!ensurePushConfigured()) return res.status(503).json({success:false,message:"إعدادات الإشعارات على الخادم غير مكتملة."});
    const subscriptions=await admin.firestore().collection("users").doc(uid).collection("pushSubscriptions").get();
    if(subscriptions.empty) return res.status(404).json({success:false,message:"لا يوجد اشتراك محفوظ لهذا الجهاز. أوقف الإشعارات ثم فعّلها مجددًا."});
    await createUserNotification(uid,{type:"pushTest",title:"اختبار إشعارات مِرسالو",body:"إذا ظهر هذا الإشعار، فإن استقبال الإشعارات يعمل على جهازك.",url:"settings.html",tag:"mersalo-push-test-"+Date.now()});
    res.json({success:true,message:"تم إرسال طلب إشعار تجريبي. تحقق من ظهور إشعار مِرسالو على الجهاز."});
  } catch(error) {
    console.error("Push test failed:",error.message);
    res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"تعذر تنفيذ اختبار الإشعارات."});
  }
});
app.get("/api/notifications", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    const snap=await admin.firestore().collection("users").doc(uid).collection("notifications").orderBy("createdAt","desc").limit(50).get();
    res.json({success:true,notifications:snap.docs.map(doc=>({id:doc.id,...doc.data(),createdAt:doc.data().createdAt&&doc.data().createdAt.toDate?doc.data().createdAt.toDate().toISOString():null}))});
  } catch(error) { res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"Unable to load notifications."}); }
});
app.patch("/api/notifications/:id/read", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    const ref=admin.firestore().collection("users").doc(uid).collection("notifications").doc(String(req.params.id));
    await ref.set({read:true}, {merge:true});
    res.json({success:true});
  } catch(error) { res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"Unable to update notification."}); }
});
app.delete("/api/notifications/:id", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    const ref=admin.firestore().collection("users").doc(uid).collection("notifications").doc(String(req.params.id));
    const snap=await ref.get();
    if(!snap.exists)return res.status(404).json({success:false,message:"الإشعار غير موجود."});
    await ref.delete();
    res.json({success:true});
  } catch(error) { res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"تعذر حذف الإشعار."}); }
});
app.delete("/api/notifications", pushCors, async (req,res) => {
  try {
    const uid=await authenticatedUid(req);
    const collection=admin.firestore().collection("users").doc(uid).collection("notifications");
    let deleted=0;
    while(true){
      const snap=await collection.limit(450).get();
      if(snap.empty)break;
      const batch=admin.firestore().batch();
      for(const doc of snap.docs)batch.delete(doc.ref);
      await batch.commit();
      deleted+=snap.size;
      if(snap.size<450)break;
    }
    res.json({success:true,deleted});
  } catch(error) { res.status(error.message==="AUTH_REQUIRED"?401:500).json({success:false,message:"تعذر حذف الإشعارات."}); }
});



const accountDeleteOrigins = new Set([
  "https://mersalo.onrender.com",
  "https://tareeq-al-layl.onrender.com"
]);
function accountDeleteCors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !accountDeleteOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: "Origin not allowed." });
  }
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
app.options("/api/delete-account", accountDeleteCors);
app.post("/api/delete-account", accountDeleteCors, async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).json({ success: false, message: "Authentication required." });
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const uid = decoded.uid;
    const db = admin.firestore();
    const userRef = db.collection("users").doc(uid);
    // Preserve every conversation and message so the other participant keeps the history.
    // Friend requests are stored under the recipient as friendRequests/{senderUid}.
    // Scan user documents and check that exact document path to find outgoing requests
    // without requiring a Firestore collection-group index.
    const [friends, incomingRequests, blockedUsers, hiddenConversations, hiddenConversationContent, allUsers] = await Promise.all([
      userRef.collection("friends").get(),
      userRef.collection("friendRequests").get(),
      userRef.collection("blockedUsers").get(),
      userRef.collection("hiddenConversations").get(),
      userRef.collection("hiddenConversationContent").get(),
      db.collection("users").get()
    ]);

    const refsToDelete = new Map();
    for (const item of friends.docs) {
      refsToDelete.set(item.ref.path, item.ref);
      const reciprocalFriendRef = db.collection("users").doc(item.id).collection("friends").doc(uid);
      refsToDelete.set(reciprocalFriendRef.path, reciprocalFriendRef);
    }
    for (const item of incomingRequests.docs) refsToDelete.set(item.ref.path, item.ref);
    // Deleting a Firestore user document does not delete its subcollections.
    // Explicitly remove the account's remaining private subcollection documents.
    for (const snapshot of [blockedUsers, hiddenConversations, hiddenConversationContent]) {
      for (const item of snapshot.docs) refsToDelete.set(item.ref.path, item.ref);
    }

    // Find requests sent by this account, including requests created before this fix.
    for (let i = 0; i < allUsers.docs.length; i += 20) {
      const userChunk = allUsers.docs.slice(i, i + 20);
      const [outgoingSnapshots, reciprocalBlocks] = await Promise.all([
        Promise.all(userChunk.map(userDoc => userDoc.ref.collection("friendRequests").doc(uid).get())),
        Promise.all(userChunk.map(userDoc => userDoc.ref.collection("blockedUsers").doc(uid).get()))
      ]);
      for (const request of outgoingSnapshots) {
        if (request.exists) refsToDelete.set(request.ref.path, request.ref);
      }
      for (const block of reciprocalBlocks) {
        if (block.exists) refsToDelete.set(block.ref.path, block.ref);
      }
    }
    refsToDelete.set(userRef.path, userRef);
    refsToDelete.set(db.collection("loginCredentials").doc(uid).path, db.collection("loginCredentials").doc(uid));
    const usernameMappings = await db.collection("usernameIndex").where("uid", "==", uid).get();
    for (const mapping of usernameMappings.docs) refsToDelete.set(mapping.ref.path, mapping.ref);

    const refs = [...refsToDelete.values()];
    for (let i = 0; i < refs.length; i += 450) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + 450)) batch.delete(ref);
      await batch.commit();
    }

    await admin.auth().deleteUser(uid);

    const sessions = connectedUsers.get(uid);
    if (sessions) {
      for (const client of [...sessions]) {
        client.disconnect(true);
      }
      connectedUsers.delete(uid);
      io.emit("onlinePlayers", onlinePlayerList());
    }

    return res.json({ success: true, conversationsPreserved: true });
  } catch (error) {
    console.error("Account deletion error:", error.message);
    return res.status(500).json({ success: false, message: "تعذر إكمال حذف الحساب. لم يتم تأكيد العملية؛ تواصل مع الدعم قبل إعادة المحاولة." });
  }
});

app.post("/api/welcome-email", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization || "");
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) return res.status(401).json({ success: false, message: "Authentication required." });
    const decoded = await admin.auth().verifyIdToken(match[1]);
    const userRef = admin.firestore().collection("users").doc(decoded.uid);
    const profileSnap = await userRef.get();
    if (!profileSnap.exists || !profileSnap.data().playerName) {
      return res.status(400).json({ success: false, message: "Complete your profile first." });
    }
    const profile = profileSnap.data();
    const email = String(decoded.email || profile.email || "").trim();
    if (!email) return res.status(400).json({ success: false, message: "No email address is available." });
    if (profile.welcomeEmailSentAt) return res.json({ success: true, alreadySent: true });
    if (!process.env.RESEND_API_KEY || !process.env.WELCOME_FROM) {
      return res.status(503).json({ success: false, setupRequired: true, message: "Welcome email sender is not configured." });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.WELCOME_FROM,
        to: [email],
        subject: "أهلاً بك في مِرسالو!",
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#172033;max-width:600px;margin:auto"><h2 style="color:#167c68">أهلاً بك في عائلة مِرسالو!</h2><p>مرحباً <strong>${String(profile.playerName).replace(/[&<>"]/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[ch]))}</strong>،</p><p>يسعدنا انضمامك إلينا. أصبح بإمكانك الآن التواصل مع أصدقائك والبحث عن الأشخاص وبدء المحادثات بسهولة.</p><p>نتمنى لك تجربة ممتعة!</p><p>فريق مِرسالو</p></div>`
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Welcome email provider error:", response.status, result.message || result.name || "Unknown error");
      return res.status(502).json({ success: false, message: "Email provider rejected the message." });
    }
    await userRef.set({
      welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      welcomeEmailId: result.id || null
    }, { merge: true });
    return res.json({ success: true });
  } catch (error) {
    console.error("Welcome email error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to send welcome email." });
  }
});

app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Connection", "keep-alive");
  res.status(200).json({ success: true, status: "ok", timestamp: Date.now() });
});

app.get("/login.html", (req, res) => {

  res.sendFile(path.join(__dirname, "login.html"));

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {

  console.log(`Server running on port ${PORT}`);

});
