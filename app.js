const express = require("express");
const app = express();
const server = require("http").Server(app);
const port = 7070;
const io = require("socket.io")(server, {});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/client/index.html");
});

app.use("/client", express.static(__dirname + "/client"));
server.listen(port, () => {
  console.log("Server listening on " + port);
});

let socketList = {};

io.sockets.on("connection", (socket) => {
  console.log("nouvelle connection");

  socket.id = Math.random();
  socket.x = 0;
  socket.y = 0;

  socketList[socket.id] = socket;
});

setInterval(() => {
  let pack = [];
  for (let i in socketList) {
    let socket = socketList[i];
    socket.x++;
    socket.y++;
    pack.push({
      x: socket.x,
      y: socket.y,
    });

    socket.emit("newPos", pack);
  }
}, 1000 / 25);
