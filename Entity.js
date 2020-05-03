let initPack = { player: [], bullet: [] };
let removePack = { player: [], bullet: [] };

Entity = (param) => {
  let self = {
    x: 250,
    y: 250,
    spdX: 0,
    spdY: 0,
    id: "",
  };
  if (param) {
    if (param.x) self.x = param.x;
    if (param.y) self.y = param.y;
    if (param.id) self.id = param.id;
  }

  self.update = () => {
    self.updatePosition();
  };
  self.updatePosition = () => {
    self.x += self.spdX;
    self.y += self.spdY;
  };
  self.getDistance = (pt) => {
    return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2));
  };
  return self;
};
Entity.getFrameUpdateData = () => {
  let pack = {
    initPack: {
      player: initPack.player,
      bullet: initPack.bullet,
    },
    removePack: {
      player: removePack.player,
      bullet: removePack.bullet,
    },
    updatePack: {
      player: Player.update(),
      bullet: Bullet.update(),
    },
  };
  initPack.player = [];
  initPack.bullet = [];
  removePack.player = [];
  removePack.bullet = [];
  return pack;
};

Player = (param) => {
  let self = Entity(param);
  self.number = "" + Math.floor(10 * Math.random());
  self.username = param.username;
  self.pressingRight = false;
  self.pressingLeft = false;
  self.pressingUp = false;
  self.pressingDown = false;
  self.pressingAttack = false;
  self.mouseAngle = 0;
  self.maxSpd = 10;
  self.hp = 10;
  self.hpMax = 10;
  self.score = param.progress.score;

  self.socket = param.socket;

  let super_update = self.update;
  self.update = () => {
    self.updateSpd();

    super_update();
    // if (self.x < 125) self.x = oldX;
    // if (self.x > 1875) self.x = oldX;
    // if (self.y < 125) self.y = oldY;
    // if (self.y > 1875) self.y = oldY;

    if (self.pressingAttack) {
      self.shootBullet(self.mouseAngle);
    }
  };
  self.shootBullet = (angle) => {
    Bullet({
      parent: self.id,
      angle: angle,
      x: self.x,
      y: self.y,
    });
  };

  self.updateSpd = () => {
    if (self.pressingRight) self.spdX = self.maxSpd;
    else if (self.pressingLeft) self.spdX = -self.maxSpd;
    else self.spdX = 0;

    if (self.pressingUp) self.spdY = -self.maxSpd;
    else if (self.pressingDown) self.spdY = self.maxSpd;
    else self.spdY = 0;
  };

  self.getInitPack = () => {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      number: self.number,
      username: self.username,
      hp: self.hp,
      hpMax: self.hpMax,
      score: self.score,
      angle: self.mouseAngle,
    };
  };
  self.getUpdatePack = () => {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      hp: self.hp,
      score: self.score,
      angle: self.mouseAngle,
    };
  };

  Player.list[self.id] = self;

  initPack.player.push(self.getInitPack());
  return self;
};
Player.list = {};
Player.onConnect = (socket, username, progress) => {
  let player = Player({
    username: username,
    id: socket.id,
    socket: socket,
    progress: progress,
  });

  socket.on("keyPress", (data) => {
    if (data.inputId === "left") player.pressingLeft = data.state;
    else if (data.inputId === "right") player.pressingRight = data.state;
    else if (data.inputId === "up") player.pressingUp = data.state;
    else if (data.inputId === "down") player.pressingDown = data.state;
    else if (data.inputId === "attack") player.pressingAttack = data.state;
    else if (data.inputId === "mouseAngle") player.mouseAngle = data.state;
  });

  socket.on("sendMsgToServer", (data) => {
    for (let i in Player.list) {
      Player.list[i].socket.emit("addToChat", player.username + ": " + data);
    }
  });
  socket.on("sendPmToServer", (data) => {
    //data:{username,message}
    let recipientSocket = null;
    for (let i in Player.list)
      if (Player.list[i].username === data.username)
        recipientSocket = Player.list[i].socket;
    if (recipientSocket === null) {
      socket.emit(
        "addToChat",
        "The player " + data.username + " is not online."
      );
    } else {
      recipientSocket.emit(
        "addToChat",
        "From " + player.username + ":" + data.message
      );
      socket.emit("addToChat", "To " + data.username + ":" + data.message);
    }
  });

  socket.emit("init", {
    selfId: socket.id,
    player: Player.getAllInitPack(),
    bullet: Bullet.getAllInitPack(),
  });
};
Player.getAllInitPack = () => {
  let players = [];
  for (let i in Player.list) players.push(Player.list[i].getInitPack());
  return players;
};

Player.onDisconnect = (socket) => {
  let player = Player.list[socket.id];
  if (!player) return;
  Database.savePlayerProgress({
    username: player.username,
    score: player.score,
  });
  delete Player.list[socket.id];
  removePack.player.push(socket.id);
};
Player.update = () => {
  let pack = [];
  for (let i in Player.list) {
    let player = Player.list[i];
    player.update();
    pack.push(player.getUpdatePack());
  }
  return pack;
};

Bullet = (param) => {
  let self = Entity(param);
  self.id = Math.random();
  self.angle = param.angle;
  self.spdX = Math.cos((param.angle / 180) * Math.PI) * 10;
  self.spdY = Math.sin((param.angle / 180) * Math.PI) * 10;
  self.parent = param.parent;

  self.timer = 0;
  self.toRemove = false;
  let super_update = self.update;
  self.update = () => {
    if (self.timer++ > 25) self.toRemove = true;
    super_update();

    for (let i in Player.list) {
      let p = Player.list[i];
      if (self.getDistance(p) < 32 && self.parent !== p.id) {
        p.hp -= 1;

        if (p.hp <= 0) {
          let shooter = Player.list[self.parent];
          if (shooter) shooter.score += 1;
          p.hp = p.hpMax;
          p.x = Math.random() * 500;
          p.y = Math.random() * 500;
        }
        self.toRemove = true;
      }
    }
  };
  self.getInitPack = () => {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
    };
  };
  self.getUpdatePack = () => {
    return {
      id: self.id,
      x: self.x,
      y: self.y,
    };
  };

  Bullet.list[self.id] = self;
  initPack.bullet.push(self.getInitPack());
  return self;
};
Bullet.list = {};

Bullet.update = () => {
  let pack = [];
  for (let i in Bullet.list) {
    let bullet = Bullet.list[i];
    bullet.update();
    if (bullet.toRemove) {
      delete Bullet.list[i];
      removePack.bullet.push(bullet.id);
    } else pack.push(bullet.getUpdatePack());
  }
  return pack;
};

Bullet.getAllInitPack = () => {
  let bullets = [];
  for (let i in Bullet.list) bullets.push(Bullet.list[i].getInitPack());
  return bullets;
};
