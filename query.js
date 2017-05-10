const config = require('./config').pg;
const pool = new pg.Pool(config);
const query = (...args) => {
  return new Promise((resolve, reject) => {
    pool.query(...(args.concat((err, res) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(res);
    })))
  });
};

pool.on('error', (err, client) => {
  console.error(err.stack());
  process.exit(1);
});

module.exports = query;
