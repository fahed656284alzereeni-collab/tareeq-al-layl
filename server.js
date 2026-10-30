const express = require("express");

const http = require("http");

const path = require("path");
const fs = require("fs");

const { Server } = require("socket.io");
const admin = require("firebase-admin");

// Prefer keyless Google Workload Identity Federation when Render configures ADC.
// Otherwise support a Render Secret File or the legacy JSON environment variable.
let credential;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
      "/etc/secrets/firebase-service-account.json";
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

const app = express();

const server = http.createServer(app);

const io = new Server(server, {

  cors: { origin: "*" }

});

const rooms = new Map();
// A user may be connected from more than one device or browser tab.
const connectedUsers = new Map();
const friendRequestLimits = new Map();

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
    const profile = await admin.firestore().collection("users").doc(decoded.uid).get();
    const profileData = profile.exists ? profile.data() : {};
    const playerName = String(profileData.playerName || profileData.phoneNumber || decoded.phone_number || "مستخدم").trim().slice(0, 40);
    socket.data.uid = decoded.uid;
    socket.data.playerName = playerName;
    socket.data.phoneNumber = String(profileData.phoneNumber || decoded.phone_number || "");
    next();
  } catch (error) {
    next(new Error("AUTH_INVALID"));
  }
});

function getRoom(code) {

  return rooms.get(code);

}

function publicPlayers(room) {

  return [...room.players.values()].map(p => ({

    id: p.id,

    name: p.name,

    host: p.id === room.host

  }));

}

function roomInfo(code, room) {

  return {

    code,

    name: room.name,

    privateRoom: room.privateRoom,

    started: room.started,

    playerCount: room.players.size,

    players: publicPlayers(room)

  };

}

function publicRoomList() {

  return [...rooms.entries()]

    .filter(([code, room]) =>

      !room.privateRoom && room.players.size > 0

    )

    .map(([code, room]) => roomInfo(code, room));

}

function updateRoomList() {

  io.emit("publicRooms", publicRoomList());

}

function sendRoomUpdate(code) {

  const room = getRoom(code);

  if (!room) return;

  io.to(code).emit("playersUpdate", publicPlayers(room));

  io.to(code).emit("roomPrivacy", {

    privateRoom: room.privateRoom

  });

  updateRoomList();

}

function leaveCurrentRoom(socket) {

  const code = socket.data.room;

  if (!code) return;

  const room = getRoom(code);

  socket.leave(code);

  delete socket.data.room;

  if (!room) return;

  room.players.delete(socket.id);

  if (room.host === socket.id) {

    room.host = room.players.keys().next().value || null;

  }

  if (room.players.size === 0) {

    rooms.delete(code);

  } else {

    sendRoomUpdate(code);

  }

  updateRoomList();

}

io.on("connection", socket => {
  addConnectedSocket(socket.data.uid, socket);
  const onlinePlayers = onlinePlayerList;
  io.emit("onlinePlayers", onlinePlayers());
  socket.emit("publicRooms", publicRoomList());
  socket.on("getOnlinePlayers", reply => {
    if (typeof reply === "function") reply(onlinePlayers());
  });

  const usersRef = admin.firestore().collection("users");
  const db = admin.firestore();
  const conversationsRef = db.collection("conversations");

  socket.on("findUserByPhone", async (data = {}, reply) => {
    try {
      const phone = String(data.phone || "").trim();
      if (!/^\\+[1-9]\\d{7,14}$/.test(phone)) throw new Error("أدخل الرقم بالصيغة الدولية.");
      if (phone === socket.data.phoneNumber) throw new Error("هذا رقم حسابك.");
      const snap = await usersRef.where("phoneNumber", "==", phone).limit(1).get();
      if (snap.empty) throw new Error("لا يوجد حساب مسجل بهذا الرقم.");
      const target = snap.docs[0];
      if (typeof reply === "function") reply({ success: true, user: { uid: target.id, phoneNumber: phone } });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر البحث." });
    }
  });

  socket.on("startDirectConversation", async (data = {}, reply) => {
    try {
      const targetUid = String(data.targetUid || "").trim();
      if (!targetUid || targetUid === socket.data.uid) throw new Error("المستخدم غير صالح.");
      const targetSnap = await usersRef.doc(targetUid).get();
      if (!targetSnap.exists || !targetSnap.data().phoneNumber) throw new Error("الحساب غير موجود.");
      const members = [socket.data.uid, targetUid].sort();
      const conversationId = members.join("_");
      const ref = conversationsRef.doc(conversationId);
      await ref.set({ type: "direct", members, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      if (typeof reply === "function") reply({ success: true, conversation: { id: conversationId, phoneNumber: targetSnap.data().phoneNumber } });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر بدء المحادثة." });
    }
  });

  socket.on("listConversations", async reply => {
    try {
      const snap = await conversationsRef.where("members", "array-contains", socket.data.uid).get();
      const conversations = await Promise.all(snap.docs.map(async item => {
        const data = item.data();
        const otherUid = (data.members || []).find(uid => uid !== socket.data.uid);
        const other = otherUid ? await usersRef.doc(otherUid).get() : null;
        const last = await item.ref.collection("messages").orderBy("createdAt", "desc").limit(1).get();
        const msg = last.empty ? null : last.docs[0].data();
        return { id: item.id, otherUid, phoneNumber: other && other.exists ? (other.data().phoneNumber || "") : "", lastMessage: msg ? String(msg.text || "رسالة") : "", updatedAt: data.updatedAt ? data.updatedAt.toMillis() : 0 };
      }));
      conversations.sort((a,b) => b.updatedAt-a.updatedAt);
      if (typeof reply === "function") reply({ success: true, conversations });
    } catch (error) {
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
      if (typeof reply === "function") reply({ success: true, messages: snap.docs.map(d => ({ id:d.id, ...d.data(), createdAt:d.data().createdAt ? d.data().createdAt.toMillis() : 0 })) });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر تحميل الرسائل." });
    }
  });

  socket.on("sendDirectMessage", async (data = {}, reply) => {
    try {
      const id = String(data.conversationId || "");
      const text = String(data.text || "").trim();
      if (!text || text.length > 4000) throw new Error("اكتب رسالة لا تتجاوز 4000 حرف.");
      const ref = conversationsRef.doc(id);
      const conversation = await ref.get();
      if (!conversation.exists || !(conversation.data().members || []).includes(socket.data.uid)) throw new Error("غير مصرح بإرسال رسالة هنا.");
      const message = { senderUid: socket.data.uid, text, createdAt: admin.firestore.FieldValue.serverTimestamp() };
      const added = await ref.collection("messages").add(message);
      await ref.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp(), lastMessage: text.slice(0,120) }, { merge: true });
      const payload = { id: added.id, senderUid: socket.data.uid, text, createdAt: Date.now() };
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

  socket.on("updatePlayerName", async (data = {}, reply) => {
    try {
      const playerName = String(data.playerName || "").trim().slice(0, 30);
      if (!playerName) throw new Error("اسم اللاعب مطلوب.");
      await usersRef.doc(socket.data.uid).set({
        playerName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      // Keep every active session and any current room membership in sync.
      const sessions = connectedUsers.get(socket.data.uid);
      if (sessions) {
        for (const session of sessions) {
          session.data.playerName = playerName;
          const room = getRoom(session.data.room);
          const player = room && room.players.get(session.id);
          if (player) player.name = playerName;
          if (room) sendRoomUpdate(session.data.room);
        }
      } else {
        socket.data.playerName = playerName;
      }
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
      const friends = await Promise.all(friendsSnap.docs.map(async d => {
        const p = await usersRef.doc(d.id).get();
        return { uid: d.id, name: p.exists ? String(p.data().playerName || "اسم غير متوفر") : "اسم غير متوفر", online: Boolean(getConnectedSocket(d.id)) };
      }));
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
      if (!otherUid || otherUid === socket.data.uid) throw new Error("حساب الصديق غير صالح.");
      const batch = admin.firestore().batch();
      batch.delete(friendshipRef(socket.data.uid, otherUid));
      batch.delete(friendshipRef(otherUid, socket.data.uid));
      await batch.commit();
      if (typeof reply === "function") reply({ success: true, message: "تمت إزالة الصديق." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: "تعذر إزالة الصديق." });
    }
  });



  socket.on("getPublicRooms", reply => {

    if (typeof reply === "function") {

      reply(publicRoomList());

    }

  });

  socket.on("createRoom", (data = {}, reply) => {
    const requestedRoomName = String(data.name || "").trim().slice(0, 60);
    const requestedPlayerName = socket.data.playerName;
    if (!requestedRoomName || !requestedPlayerName) {
      if (typeof reply === "function") reply({ success: false, message: "أدخل اسم اللاعب واسم الطاولة أولا." });
      return;
    }
    leaveCurrentRoom(socket);

    let code;

    do {

      code = Math.random().toString(36).slice(2, 8).toUpperCase();

    } while (rooms.has(code));

    const room = {

      name: requestedRoomName,

      host: socket.id,

      privateRoom: Boolean(data.privateRoom),

      started: false,

      players: new Map(),
      invited: new Set()

    };

    room.players.set(socket.id, {

      id: socket.id,

      uid: socket.data.uid,

      name: requestedPlayerName

    });

    rooms.set(code, room);

    socket.join(code);

    socket.data.room = code;

    if (typeof reply === "function") {

      reply({

        success: true,

        code,

        host: true,

        room: roomInfo(code, room)

      });

    }

    sendRoomUpdate(code);

  });

  socket.on("joinRoom", (data = {}, reply) => {
    const joiningName = socket.data.playerName;
    if (!joiningName) {
      if (typeof reply === "function") reply({ success: false, message: "اسم اللاعب مطلوب." });
      return;
    }
    const code = String(data.roomId || data.code || "").trim().toUpperCase();

    const room = getRoom(code);

    if (!room) {

      if (typeof reply === "function") {

        reply({ 
          success: false,

          message: "الطاولة غير موجودة أو لم تعد متاحة."

        });

      }

      return;

    }

    if (room.privateRoom && !room.invited?.has(socket.data.uid)) {

      if (typeof reply === "function") {

        reply({

          success: false,

          message: "هذه الطاولة خاصة. الدخول ممنوع حتى يعيدها المالك إلى عامة."

        });

      }

      return;

    }

    leaveCurrentRoom(socket);

    room.players.set(socket.id, {

      id: socket.id,

      uid: socket.data.uid,

      name: joiningName

    });

    socket.join(code);

    socket.data.room = code;

    if (typeof reply === "function") {

      reply({

        success: true,

        code,

        host: false,

        started: room.started,

        room: roomInfo(code, room)

      });

    }

    sendRoomUpdate(code);

    socket.to(code).emit("systemMessage", "انضم لاعب جديد.");

  });

  socket.on("invitePlayer", (data = {}, reply) => {
    const code = socket.data.room;
    const room = getRoom(code);
    const targetUid = String(data.targetUid || "").trim();
    const target = getConnectedSocket(targetUid);
    if (!room || room.host !== socket.id) {
      if (typeof reply === "function") reply({ success: false, message: "فقط مالك الطاولة يستطيع إرسال الدعوات." });
      return;
    }
    if (!room.privateRoom) {
      if (typeof reply === "function") reply({ success: false, message: "الدعوات المباشرة مخصصة للطاولات الخاصة." });
      return;
    }
    if (!targetUid || targetUid === socket.data.uid || !target || !target.connected) {
      if (typeof reply === "function") reply({ success: false, message: "اللاعب غير متصل حاليا." });
      return;
    }
    if ([...room.players.values()].some(player => player.uid === targetUid) || room.invited.has(targetUid) || room.pendingInvites?.has(targetUid)) {
      if (typeof reply === "function") reply({ success: false, message: "اللاعب موجود في الطاولة أو أُرسلت له دعوة بالفعل." });
      return;
    }
    if (!room.pendingInvites) room.pendingInvites = new Set();
    room.pendingInvites.add(targetUid);
    friendshipRef(socket.data.uid, targetUid).get().then(friendship => {
      if (!friendship.exists) {
        if (typeof reply === "function") reply({ success: false, message: "يمكن دعوة الأصدقاء فقط إلى الطاولة الخاصة." });
        return;
      }
      // Re-check room and recipient after the asynchronous friendship lookup.
      const activeTargets = connectedUsers.get(targetUid);
      if (getRoom(code) !== room || room.host !== socket.id || !activeTargets || ![...activeTargets].some(client => client.connected)) {
        if (typeof reply === "function") reply({ success: false, message: "تعذر إرسال الدعوة؛ تحقق من حالة الطاولة واللاعب." });
        return;
      }
      if (room.invited.has(targetUid)) {
        if (typeof reply === "function") reply({ success: false, message: "أُرسلت دعوة بالفعل." });
        return;
      }
      room.invited.add(targetUid);
      for (const recipient of [...activeTargets].filter(client => client.connected)) recipient.emit("roomInvitation", {
        roomId: code,
        roomName: room.name,
        inviterName: socket.data.playerName,
        privateRoom: room.privateRoom
      });
      if (typeof reply === "function") reply({ success: true });
    }).catch(() => {
      if (typeof reply === "function") reply({ success: false, message: "تعذر التحقق من الصداقة." });
    }).finally(() => {
      room.pendingInvites?.delete(targetUid);
    });
    return;

  });

  socket.on("acceptRoomInvitation", async (data = {}, reply) => {
    try {
      const code = String(data.roomId || "").trim().toUpperCase();
      const room = getRoom(code);
      if (!room || !room.privateRoom || !room.invited.has(socket.data.uid)) {
        throw new Error("الدعوة غير صالحة أو انتهت.");
      }
      // Claim the invitation synchronously so two tabs cannot accept it concurrently.
      if (!room.claimedInvites) room.claimedInvites = new Set();
      if (room.claimedInvites.has(socket.data.uid)) throw new Error("جارٍ قبول هذه الدعوة من جلسة أخرى.");
      room.claimedInvites.add(socket.data.uid);
      room.invited.delete(socket.data.uid);
      try {
        const hostPlayer = [...room.players.values()].find(player => player.id === room.host);
        if (!hostPlayer || !hostPlayer.uid) throw new Error("تعذر التحقق من مالك الطاولة.");
        const friendship = await friendshipRef(hostPlayer.uid, socket.data.uid).get();
        if (!friendship.exists) throw new Error("لم تعد ضمن قائمة أصدقاء مالك الطاولة.");
        if (getRoom(code) !== room || !room.privateRoom || !room.claimedInvites.has(socket.data.uid)) {
          throw new Error("انتهت صلاحية الدعوة.");
        }
        leaveCurrentRoom(socket);
        room.players.set(socket.id, { id: socket.id, uid: socket.data.uid, name: socket.data.playerName });
        room.claimedInvites.delete(socket.data.uid);
      } catch (error) {
        room.claimedInvites.delete(socket.data.uid);
        if (getRoom(code) === room && room.privateRoom) room.invited.add(socket.data.uid);
        throw error;
      }
      socket.join(code);
      socket.data.room = code;
      if (typeof reply === "function") reply({ success: true, room: roomInfo(code, room) });
      sendRoomUpdate(code);
      socket.to(code).emit("systemMessage", "انضم لاعب جديد.");
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر قبول الدعوة." });
    }
  });

  socket.on("setRoomPrivacy", (data = {}, reply) => {

    const code = socket.data.room;

    const room = getRoom(code);

    if (!room || room.host !== socket.id) {

      if (typeof reply === "function") {

        reply({

          success: false,

          message: "فقط مالك الطاولة يستطيع تغيير الخصوصية."

        });

      }

      return;

    }

    room.privateRoom = Boolean(data.privateRoom);

    io.to(code).emit("systemMessage",

      room.privateRoom

        ? "أصبحت الطاولة خاصة. لن يُسمح بدخول لاعبين جدد."

        : "أصبحت الطاولة عامة. يمكن للاعبين الجدد الدخول."

    );

    if (typeof reply === "function") {

      reply({

        success: true,

        privateRoom: room.privateRoom

      });

    }

    sendRoomUpdate(code);

  });

  socket.on("chatMessage", message => {

    const code = socket.data.room;

    const room = getRoom(code);

    if (!room || !room.players.has(socket.id)) return;

    const player = room.players.get(socket.id);

    io.to(code).emit("chatMessage", {

      name: player.name,

      message: String(message || "").slice(0, 1000),

      time: new Date().toISOString()

    });

  });

  socket.on("startGame", reply => {

    const code = socket.data.room;

    const room = getRoom(code);

    if (!room || room.host !== socket.id) {

      if (typeof reply === "function") {

        reply({

          success: false,

          message: "فقط المالك يستطيع بدء اللعبة."

        });

      }

      return;

    }

    room.started = true;

    io.to(code).emit("gameState", { started: true });

    if (typeof reply === "function") {

      reply({ success: true });

    }

  });

  socket.on("stopGame", reply => {

    const code = socket.data.room;

    const room = getRoom(code);

    if (!room || room.host !== socket.id) {

      if (typeof reply === "function") {

        reply({

          success: false,

          message: "فقط المالك يستطيع إيقاف اللعبة."

        });

      }

      return;

    }

    room.started = false;

    io.to(code).emit("gameState", { started: false });

    if (typeof reply === "function") {

      reply({ success: true });

    }

  });

  socket.on("voiceSignal", data => {

    const code = socket.data.room;

    const room = getRoom(code);

    if (!room || !room.players.has(socket.id) || !data ||
        typeof data.target !== "string" || !room.players.has(data.target) ||
        !data.signal || !["description", "candidate"].includes(data.signal.type)) return;

    io.to(data.target).emit("voiceSignal", {

      from: socket.id,

      signal: data.signal

    });

  });

  socket.on("leaveRoom", () => {

    leaveCurrentRoom(socket);

  });

  socket.on("disconnect", () => {
    removeConnectedSocket(socket.data.uid, socket);
    io.emit("onlinePlayers", onlinePlayerList());
    leaveCurrentRoom(socket);

  });

});

app.get("/", (req, res) => {

  res.send("خادم طريق الليل يعمل");

});

app.get("/health", (req, res) => {

  res.json({ success: true });

});

app.get("/login.html", (req, res) => {

  res.sendFile(path.join(__dirname, "login.html"));

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {

  console.log(`Server running on port ${PORT}`);

});
