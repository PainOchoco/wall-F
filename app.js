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
  self.getDistance = (pt) => {
    return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
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
  self.pressAttack = false;
  self.mouseAngle = 0;
  self.maxSpeed = 10;

  let superUpdate = self.update;
  self.update = () => {
    self.updateSpeed();
    superUpdate();
    if (self.pressAttack) {
      self.shootBullet(self.mouseAngle);
    }
  };

  self.shootBullet = (angle) => {
    let b = Bullet(self.id, angle);
    b.x = self.x;
    b.y = self.y;
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
      case "attack":
        player.pressAttack = data.state;
        break;
      case "mouseAngle":
        player.mouseAngle = data.state;
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

let Bullet = (parent, angle) => {
  let self = Entity();
  self.id = Math.random();
  self.speedX = Math.cos((angle / 180) * Math.PI) * 10;
  self.speedY = Math.sin((angle / 180) * Math.PI) * 10;
  self.parent = parent;
  self.timer = 0;
  self.toRemove = false;
  let superUpdate = self.update;
  self.update = () => {
    if (self.timer++ > 100) self.toRemove = true;
    superUpdate();

    for (let i in Player.list) {
      let p = Player.list[i];
      if (self.getDistance(p) < 32 && self.parent !== p.id) {
        self.toRemove = true;
      }
    }
  };
  Bullet.list[self.id] = self;
  return self;
};
Bullet.list = {};

Bullet.update = () => {
  let pack = [];
  for (let i in Bullet.list) {
    let bullet = Bullet.list[i];
    bullet.update();
    if (bullet.toRemove == true) delete Bullet.list[i];
    pack.push({
      x: bullet.x,
      y: bullet.y,
    });
  }
  return pack;
};
// PROVISOIRE
let USERS = {
  //user:password
  admin: "wxcvbn",
  painpain: "breadbread",
};

let isPasswordValid = (data, callback) => {
  callback(USERS[data.username] === data.password);
};

let isUsernameTaken = (data, callback) => {
  callback(USERS[data.username]);
};

let addUser = (data, callback) => {
  USERS[data.username] = data.password;
  callback();
};

io.sockets.on("connection", (socket) => {
  console.log("nouvelle connexion");

  socket.id = Math.random();
  socketList[socket.id] = socket;

  socket.on("signIn", (data) => {
    isPasswordValid(data, (res) => {
      if (res) {
        Player.onConnect(socket);
        socket.emit("signInResponse", { success: true });
      } else {
        socket.emit("signInResponse", { success: false });
      }
    });
  });

  socket.on("signUp", (data) => {
    isUsernameTaken(data, (res) => {
      if (res) {
        socket.emit("signUpResponse", { success: false });
      } else {
        addUser(data, () => {
          socket.emit("signUpResponse", { success: true });
        });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("déconnexion");
    delete socketList[socket.id];
    Player.onDisconnect(socket);
  });
});

setInterval(() => {
  let pack = {
    player: Player.update(),
    bullet: Bullet.update(),
  };

  for (let i in socketList) {
    let socket = socketList[i];
    socket.emit("newPos", pack);
  }
}, 1000 / 25);
