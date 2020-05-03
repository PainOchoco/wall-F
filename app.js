require("./Database");
require("./Entity");

let express = require("express");
let app = express();
let serv = require("http").Server(app);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/client/index.html");
});
app.use("/client", express.static(__dirname + "/client"));

serv.listen(process.env.PORT || 7070);
console.log("Server started.");

let SOCKET_LIST = {};
let DEBUG = true;

let io = require("socket.io")(serv, {});
io.sockets.on("connection", (socket) => {
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  socket.on("signIn", (data) => {
    //{username,password}
    Database.isValidPassword(data, (res) => {
      if (!res) return socket.emit("signInResponse", { success: false });
      Database.getPlayerProgress(data.username, (progress) => {
        Player.onConnect(socket, data.username, progress);
        socket.emit("signInResponse", { success: true });
      });
    });
  });
  socket.on("signUp", (data) => {
    Database.isUsernameTaken(data, (res) => {
      if (res) {
        socket.emit("signUpResponse", { success: false });
      } else {
        Database.addUser(data, () => {
          socket.emit("signUpResponse", { success: true });
        });
      }
    });
  });

  socket.on("disconnect", () => {
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
  });

  socket.emit("leaderboard", Database.getLeaderboard());
});

setInterval(() => {
  let packs = Entity.getFrameUpdateData();
  for (let i in SOCKET_LIST) {
    let socket = SOCKET_LIST[i];
    socket.emit("init", packs.initPack);
    socket.emit("update", packs.updatePack);
    socket.emit("remove", packs.removePack);
  }
}, 1000 / 25);
