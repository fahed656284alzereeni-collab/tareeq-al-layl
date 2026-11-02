const express = require("express");

const http = require("http");

const path = require("path");
const fs = require("fs");

const { Server } = require("socket.io");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const webpush = require("web-push");
const crypto = require("crypto");

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
    const playerName = String(profileData.playerName || profileData.displayName || decoded.name || profileData.email || decoded.email || "مستخدم").trim().slice(0, 40);
    socket.data.uid = decoded.uid;
    socket.data.playerName = playerName;
    socket.data.email = String(profileData.email || decoded.email || "").toLowerCase();
    socket.data.phoneNumber = "";
    next();
  } catch (error) {
    next(new Error("AUTH_INVALID"));
  }
});

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
  socket.on("voiceCall:start", async (data = {}, reply) => {
    try {
      const targetUid = String(data.targetUid || "");
      const conversationId = String(data.conversationId || "");
      if (!targetUid || targetUid === socket.data.uid || !conversationId) throw new Error("بيانات المكالمة غير مكتملة.");
      const conversationSnap = await conversationsRef.doc(conversationId).get();
      if (!conversationSnap.exists) throw new Error("المحادثة غير موجودة.");
      const conversation = conversationSnap.data();
      if (conversation.type === "group" || !(conversation.members || []).includes(socket.data.uid) || !(conversation.members || []).includes(targetUid)) {
        throw new Error("المكالمات الصوتية متاحة في المحادثات الفردية فقط.");
      }
      if (!getConnectedSocket(targetUid)) throw new Error("هذا الشخص غير متصل الآن.");
      if (activeVoiceCallFor(socket.data.uid) || activeVoiceCallFor(targetUid)) throw new Error("أحد الطرفين مشغول بمكالمة أخرى.");
      const callId = require("crypto").randomUUID();
      const call = { callId, callerUid: socket.data.uid, calleeUid: targetUid, conversationId, state: "ringing", createdAt: Date.now() };
      voiceCalls.set(callId, call);
      socket.data.voiceCallId = callId;
      const caller = { uid: socket.data.uid, name: socket.data.playerName };
      for (const client of connectedUsers.get(targetUid) || []) if (client.connected) client.emit("voiceCall:incoming", { callId, conversationId, caller });
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
    socket.data.voiceCallId = call.callId;
    for (const client of connectedUsers.get(call.callerUid) || []) if (client.connected) client.emit("voiceCall:accepted", { callId: call.callId, answer });
    if (typeof reply === "function") reply({ success: true });
  });

  socket.on("voiceCall:signal", (data = {}) => {
    const call = voiceCalls.get(String(data.callId || ""));
    if (!call || !["ringing", "active"].includes(call.state)) return;
    const peerUid = call.callerUid === socket.data.uid ? call.calleeUid : call.calleeUid === socket.data.uid ? call.callerUid : null;
    if (!peerUid || !getConnectedSocket(peerUid)) return;
    for (const client of connectedUsers.get(peerUid) || []) if (client.connected) client.emit("voiceCall:signal", { callId: call.callId, candidate: data.candidate });
  });

  socket.on("voiceCall:end", (data = {}) => {
    const callId = String(data.callId || socket.data.voiceCallId || "");
    const call = voiceCalls.get(callId);
    if (!call || (call.callerUid !== socket.data.uid && call.calleeUid !== socket.data.uid)) return;
    voiceCalls.delete(callId);
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
      const name = String(data.name || "").trim().slice(0, 50);
      const requested = Array.isArray(data.memberUids) ? [...new Set(data.memberUids.map(String))] : [];
      const memberUids = requested.filter(uid => uid && uid !== socket.data.uid).slice(0, 49);
      if (!name) throw new Error("اكتب اسمًا للمجموعة.");
      if (!memberUids.length) throw new Error("اختر شخصًا واحدًا على الأقل لإضافته.");
      const profiles = await db.getAll(...memberUids.map(uid => usersRef.doc(uid)));
      if (profiles.some(profile => !profile.exists || !profile.data().playerName)) throw new Error("تعذر العثور على أحد الحسابات المختارة.");
      const checks = await Promise.all(memberUids.flatMap(uid => [blockedRef(socket.data.uid, uid).get(), blockedRef(uid, socket.data.uid).get()]));
      if (checks.some(snap => snap.exists)) throw new Error("لا يمكن إضافة أحد المستخدمين بسبب إعدادات الحظر.");
      const members = [socket.data.uid, ...memberUids];
      const ref = conversationsRef.doc();
      const now = admin.firestore.FieldValue.serverTimestamp();
      await ref.set({ type: "group", groupName: name, createdBy: socket.data.uid, members, createdAt: now, updatedAt: now, lastMessage: "تم إنشاء المجموعة" });
      await Promise.all(memberUids.map(uid=>createUserNotification(uid,{type:"groupInvite",title:"إضافة إلى مجموعة",body:socket.data.playerName+" أضافك إلى مجموعة "+name,url:"chat.html?conversationId="+encodeURIComponent(ref.id),tag:"group-"+ref.id})));
      const payload = { id: ref.id, type: "group", groupName: name, displayName: name, members, createdBy: socket.data.uid, lastMessage: "تم إنشاء المجموعة" };
      if (typeof reply === "function") reply({ success: true, conversation: payload });
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
      if (snap.data().createdBy !== socket.data.uid) throw new Error("منشئ المجموعة فقط يستطيع إضافة أعضاء.");
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
      const ref = conversationsRef.doc(conversationId);
      const snap = await ref.get();
      if (!snap.exists || snap.data().type !== "group" || !(snap.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بتعديل هذه المجموعة.");
      const group = snap.data();
      if (group.createdBy !== socket.data.uid && !(group.moderatorUids || []).includes(socket.data.uid)) throw new Error("منشئ المجموعة أو أحد مشرفيها فقط يستطيع تعديل اسمها.");
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
          online: Boolean(getConnectedSocket(profile.id)),
          isModerator: (conversationData.moderatorUids || []).includes(profile.id)
        }));
        const countSnap = await conversationRef.collection("messages").count().get();
        if (typeof reply === "function") reply({ success: true, details: {
          type: "group", name: String(conversationData.groupName || "مجموعة"),
          members, createdBy: conversationData.createdBy || "", isAdmin: conversationData.createdBy === socket.data.uid, isModerator: (conversationData.moderatorUids || []).includes(socket.data.uid),
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
      const conversations = await Promise.all(snap.docs.filter(item => !hiddenIds.has(item.id)).map(async item => {
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

  socket.on("getConversationMessages", async (data = {}, reply) => {
    try {
      const id = String(data.conversationId || "");
      const ref = conversationsRef.doc(id);
      const conversation = await ref.get();
      if (!conversation.exists || !(conversation.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بفتح هذه المحادثة.");
      const snap = await ref.collection("messages").orderBy("createdAt", "asc").limit(100).get();
      const visibleDocs = snap.docs.filter(d => !(d.data().hiddenFor || []).includes(socket.data.uid));
      const senderUids = [...new Set(visibleDocs.map(doc => doc.data().senderUid).filter(Boolean))];
      const senderProfiles = senderUids.length ? await db.getAll(...senderUids.map(uid => usersRef.doc(uid))) : [];
      const senderNames = new Map(senderProfiles.map(profile => [profile.id, String(profile.exists ? (profile.data().playerName || profile.data().displayName || "مستخدم") : "مستخدم")]));

      const messages = visibleDocs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, senderName: data.senderName || senderNames.get(data.senderUid) || "مستخدم", createdAt: data.createdAt ? data.createdAt.toMillis() : 0 };
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
      const conversationData = conversation.data();
      const isGroup = conversationData.type === "group";
      if (!isGroup) {
        const otherUid = (conversationData.members || []).find(uid => uid !== socket.data.uid);
        if (!otherUid) throw new Error("تعذر تحديد الطرف الآخر.");
        const [myBlock, theirBlock] = await Promise.all([blockedRef(socket.data.uid, otherUid).get(), blockedRef(otherUid, socket.data.uid).get()]);
        if (myBlock.exists || theirBlock.exists) throw new Error("لا يمكن إرسال الرسائل بسبب إعدادات الحظر بين الحسابين.");
      }
      if (attachment && (attachment.type || "").startsWith("video/")) attachment.name = "فيديو";
       const message = { senderUid: socket.data.uid, senderName: socket.data.playerName, text, ...(attachment?{attachment}:{}), createdAt: admin.firestore.FieldValue.serverTimestamp() };
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
      const payload = { id: messageRef.id, senderUid: socket.data.uid, senderName: socket.data.playerName, text, ...(attachment?{attachment}:{}), createdAt: Date.now() };
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
    const authHeader=String(req.headers.authorization||"");
    const match=authHeader.match(/^Bearer (.+)$/i);
    if(!match)return res.status(401).json({success:false,message:"Authentication required."});
    const decoded=await admin.auth().verifyIdToken(match[1]);
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
    if (!ensurePushConfigured()) return;
    const subscriptions = await db.collection("users").doc(uid).collection("pushSubscriptions").get();
    const payload = JSON.stringify({
      title: String(item.title || "إشعار جديد").slice(0, 100),
      body: String(item.body || "").slice(0, 180),
      url: String(item.url || "chat.html").slice(0, 500),
      tag: String(item.tag || item.type || "mersalo").slice(0, 80)
    });
    await Promise.all(subscriptions.docs.map(async doc => {
      try {
        await webpush.sendNotification(doc.data(), payload);
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
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


app.options("/api/push/:action", pushCors);
app.options("/api/notifications", pushCors);
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
