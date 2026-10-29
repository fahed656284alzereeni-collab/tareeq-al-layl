const express = require("express");

const http = require("http");

const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {

  cors: { origin: "*" }

});

const rooms = new Map();

function getRoom(code) {

  if (!rooms.has(code)) {

    rooms.set(code, {

      host: null,

      started: false,

      players: new Map()

    });

  }

  return rooms.get(code);

}

function publicPlayers(room) {

  return [...room.players.values()].map(p => ({

    id: p.id,

    name: p.name,

    host: p.id === room.host

  }));

}

io.on("connection", socket => {

  socket.on("createRoom", ({ name, privateRoom }, reply) => {

    const code = Math.random().toString(36)

      .slice(2, 8).toUpperCase();

    const room = getRoom(code);

    room.host = socket.id;

    room.players.set(socket.id, {

      id: socket.id,

      name: String(name || "لاعب").slice(0, 30),

      privateRoom: Boolean(privateRoom)

    });
     socket.join(code);

    socket.data.room = code;

    reply?.({

      success: true,

      code,

      host: true,

      players: publicPlayers(room)

    });

    io.to(code).emit("playersUpdate", publicPlayers(room));

  });

  socket.on("joinRoom", ({ code, name }, reply) => {

    code = String(code || "").trim().toUpperCase();

    const room = rooms.get(code);

    if (!room) {

      return reply?.({

        success: false,

        message: "الغرفة غير موجودة"

      });

    }

    room.players.set(socket.id, {

      id: socket.id,

      name: String(name || "لاعب").slice(0, 30)

    });

    socket.join(code);

    socket.data.room = code;

    reply?.({

      success: true,

      code,

      host: room.host === socket.id,

      started: room.started,

      players: publicPlayers(room)

    });

    io.to(code).emit("playersUpdate", publicPlayers(room));

    socket.to(code).emit("systemMessage", "انضم لاعب جديد");

  });

  socket.on("chatMessage", message => {

    const code = socket.data.room;

    if (!code || !rooms.has(code)) return;

    const room = rooms.get(code);

    const player = room.players.get(socket.id);

    if (!player) return;

    io.to(code).emit("chatMessage", {

      name: player.name,

      message: String(message || "").slice(0, 1000),

      time: new Date().toISOString()

    });

  });

  socket.on("startGame", reply => {

    const code = socket.data.room;

    const room = rooms.get(code);

    if (!room || room.host !== socket.id) {

      return reply?.({ success: false });

    }

    room.started = true;

    io.to(code).emit("gameState", { started: true });

    reply?.({ success: true });

  });

  socket.on("stopGame", reply => {

    const code = socket.data.room;

    const room = rooms.get(code);

    if (!room || room.host !== socket.id) {

      return reply?.({ success: false });

    }

    room.started = false;

    io.to(code).emit("gameState", { started: false });

    reply?.({ success: true });

  });

  socket.on("voiceSignal", ({ target, signal }) => {

    const code = socket.data.room;

    const room = rooms.get(code);

    if (!room || !room.players.has(target)) return;

    io.to(target).emit("voiceSignal", {

      from: socket.id,

      signal

    });

  });

  socket.on("disconnect", () => {

    const code = socket.data.room;

    const room = rooms.get(code);

    if (!room) return;

    room.players.delete(socket.id);

    if (room.host === socket.id) {

      room.host = room.players.keys().next().value || null;

    }

    if (room.players.size === 0) {

      rooms.delete(code);

    } else {

      io.to(code).emit("playersUpdate", publicPlayers(room));

    }

  });

});

app.get("/", (req, res) => {

  res.send("خادم طريق الليل يعمل");

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {

  console.log(`Server running on port ${PORT}`);

});
