let USE_DB = true;
let mongojs = USE_DB ? require("mongojs") : null;
let db = USE_DB
  ? mongojs("localhost:27017/wallF", ["account", "progress"])
  : null;

//account:  {username:string, password:string}
//progress:  {username:string, score: number}

Database = {};
Database.isValidPassword = (data, cb) => {
  if (!USE_DB) return cb(true);
  db.account.findOne(
    { username: data.username, password: data.password },
    (err, res) => {
      if (res) cb(true);
      else cb(false);
    }
  );
};
Database.isUsernameTaken = (data, cb) => {
  if (!USE_DB) return cb(false);
  db.account.findOne({ username: data.username }, (err, res) => {
    if (res) cb(true);
    else cb(false);
  });
};
Database.addUser = (data, cb) => {
  if (!USE_DB) return cb();

  db.account.insert({ username: data.username, password: data.password });
  db.progress.insert({ username: data.username, score: data.score });
};
Database.getPlayerProgress = (username, cb) => {
  if (!USE_DB) return cb({ score });
  db.progress.findOne({ username: username }, (err, res) => {
    cb({ score: res.score });
  });
};
Database.savePlayerProgress = (data, cb) => {
  if (!USE_DB) return cb();
  db.progress.update(
    { username: data.username },
    { $set: { score: data.score } },
    {},
    cb
  );
};

Database.getLeaderboard = (cb) => {
  if (!USE_DB) return cb();
  return db.progress
    .find()
    .sort({ score: -1 })
    .limit(10)
    .toArray((err, res) => {
      if (err) console.error(err);
      return res;
    }, cb);
};
