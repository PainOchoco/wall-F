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

let Entity = () => {
  let self = {
    x: 250,
    y: 250,
    speedX: 0,
    speedY: 0,
    id: "",
  };
  self.update = () => {
    self.updatePos();
  };
  self.updatePos = () => {
    self.x += self.speedX;
    self.y += self.speedY;
  };
  return self;
};

let Player = (id) => {
  let self = Entity();
  self.id = id;
  self.number = "" + Math.floor(10 * Math.random());
  self.pressRight = false;
  self.pressLeft = false;
  self.pressUp = false;
  self.pressDown = false;
  self.maxSpeed = 10;

  let superUpdate = self.update;
  self.update = () => {
    self.updateSpeed();
    superUpdate();
  };

  self.updateSpeed = () => {
    if (self.pressRight) self.speedX = self.maxSpeed;
    else if (self.pressLeft) self.speedX = -self.maxSpeed;
    else self.speedX = 0;

    if (self.pressUp) self.speedY = -self.maxSpeed;
    else if (self.pressDown) self.speedY = self.maxSpeed;
    else self.speedY = 0;
  };
  Player.list[id] = self;
  return self;
};

Player.list = {};
Player.onConnect = (socket) => {
  let player = Player(socket.id);

  socket.on("keyPress", (data) => {
    switch (data.input) {
      case "right":
        player.pressRight = data.state;
        break;
      case "left":
        player.pressLeft = data.state;
        break;
      case "up":
        player.pressUp = data.state;
        break;
      case "down":
        player.pressDown = data.state;
        break;
    }
  });
};

Player.onDisconnect = (socket) => {
  delete Player.list[socket.id];
};

Player.update = () => {
  let pack = [];
  for (let i in Player.list) {
    let player = Player.list[i];
    player.update();
    pack.push({
      x: player.x,
      y: player.y,
      number: player.number,
    });
  }
  return pack;
};

io.sockets.on("connection", (socket) => {
  console.log("nouvelle connexion");

  socket.id = Math.random();
  socketList[socket.id] = socket;

  Player.onConnect(socket);

  socket.on("disconnect", () => {
    console.log("déconnexion");
    delete socketList[socket.id];
    Player.onDisconnect(socket);
  });
});

setInterval(() => {
  let pack = Player.update();

  for (let i in socketList) {
    let socket = socketList[i];
    socket.emit("newPos", pack);
  }
}, 1000 / 25);
