const express = require("express");

const http = require("http");

const path = require("path");

const { Server } = require("socket.io");
const admin = require("firebase-admin");

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT environment secret.");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const app = express();

const server = http.createServer(app);

const io = new Server(server, {

  cors: { origin: "*" }

});

const rooms = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error("AUTH_REQUIRED"));
    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.uid = decoded.uid;
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

  socket.emit("publicRooms", publicRoomList());

  socket.on("getPublicRooms", reply => {

    if (typeof reply === "function") {

      reply(publicRoomList());

    }

  });

  socket.on("createRoom", (data = {}, reply) => {
    const requestedRoomName = String(data.name || "").trim().slice(0, 60);
    const requestedPlayerName = String(data.playerName || "").trim().slice(0, 30);
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

      players: new Map(),\n      invited: new Set()

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
    const joiningName = String(data.name || data.playerName || "").trim().slice(0, 30);
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
