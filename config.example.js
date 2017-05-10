module.exports = {
  project: 'myproject',
  elastic: 'https://es.example.com',
  pg: {
    user: 'postgres',
    database: 'catalog',
    password: 'xxxxxx',
    host: 'localhost',
    port: 5432,
    max: 1,
    idleTimeoutMillis: 30000,
  },
};
