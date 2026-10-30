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
const connectedUsers = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("AUTH_REQUIRED"));
    const decoded = await admin.auth().verifyIdToken(token);
    const profile = await admin.firestore().collection("users").doc(decoded.uid).get();
    const playerName = profile.exists ? String(profile.data().playerName || "").trim().slice(0, 30) : "";
    if (!playerName) return next(new Error("PLAYER_PROFILE_REQUIRED"));
    socket.data.uid = decoded.uid;
    socket.data.playerName = playerName;
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
  connectedUsers.set(socket.data.uid, socket);
  const onlinePlayers = () => [...connectedUsers.entries()].map(([uid, client]) => ({ uid, name: client.data.playerName }));
  io.emit("onlinePlayers", onlinePlayers());
  socket.emit("publicRooms", publicRoomList());
  socket.on("getOnlinePlayers", reply => {
    if (typeof reply === "function") reply(onlinePlayers());
  });

  const usersRef = admin.firestore().collection("users");
  const friendshipRef = (uid, otherUid) => usersRef.doc(uid).collection("friends").doc(otherUid);
  const requestRef = (uid, otherUid) => usersRef.doc(uid).collection("friendRequests").doc(otherUid);

  socket.on("sendFriendRequest", async (data = {}, reply) => {
    try {
      const targetUid = String(data.targetUid || "").trim();
      if (!targetUid || targetUid === socket.data.uid) throw new Error("طلب صداقة غير صالح.");
      const targetProfile = await usersRef.doc(targetUid).get();
      if (!targetProfile.exists) throw new Error("الحساب غير موجود.");
      const existing = await friendshipRef(socket.data.uid, targetUid).get();
      if (existing.exists) throw new Error("هذا اللاعب ضمن قائمة أصدقائك.");
      await requestRef(targetUid, socket.data.uid).set({
        fromUid: socket.data.uid, fromName: socket.data.playerName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      const target = connectedUsers.get(targetUid);
      if (target) target.emit("friendRequestReceived", { fromUid: socket.data.uid, fromName: socket.data.playerName });
      if (typeof reply === "function") reply({ success: true, message: "تم إرسال طلب الصداقة." });
    } catch (error) {
      if (typeof reply === "function") reply({ success: false, message: error.message || "تعذر إرسال الطلب." });
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
        return { uid: d.id, name: p.exists ? String(p.data().playerName || "اسم غير متوفر") : "اسم غير متوفر", online: connectedUsers.has(d.id) };
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
      const request = await ref.get();
      if (!request.exists) throw new Error("طلب الصداقة غير موجود.");
      if (accepted) {
        const batch = admin.firestore().batch();
        batch.set(friendshipRef(socket.data.uid, fromUid), { createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(friendshipRef(fromUid, socket.data.uid), { createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.delete(ref);
        await batch.commit();
      } else {
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
    const target = connectedUsers.get(targetUid);
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
    room.invited.add(targetUid);
    target.emit("roomInvitation", {
      roomId: code,
      roomName: room.name,
      inviterName: socket.data.playerName,
      privateRoom: room.privateRoom
    });
    if (typeof reply === "function") reply({ success: true });
  });

  socket.on("acceptRoomInvitation", (data = {}, reply) => {
    const code = String(data.roomId || "").trim().toUpperCase();
    const room = getRoom(code);
    if (!room || !room.invited.has(socket.data.uid)) {
      if (typeof reply === "function") reply({ success: false, message: "الدعوة غير صالحة أو انتهت." });
      return;
    }
    room.invited.delete(socket.data.uid);
    leaveCurrentRoom(socket);
    room.players.set(socket.id, { id: socket.id, name: socket.data.playerName });
    socket.join(code);
    socket.data.room = code;
    if (typeof reply === "function") reply({ success: true, room: roomInfo(code, room) });
    sendRoomUpdate(code);
    socket.to(code).emit("systemMessage", "انضم لاعب جديد.");
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

    if (!room || !room.players.has(data.target)) return;

    io.to(data.target).emit("voiceSignal", {

      from: socket.id,

      signal: data.signal

    });

  });

  socket.on("leaveRoom", () => {

    leaveCurrentRoom(socket);

  });

  socket.on("disconnect", () => {
    if (connectedUsers.get(socket.data.uid) === socket) {
      connectedUsers.delete(socket.data.uid);
      io.emit("onlinePlayers", [...connectedUsers.entries()].map(([uid, client]) => ({ uid, name: client.data.playerName })));
    }
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
