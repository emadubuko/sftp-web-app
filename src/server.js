const { loadConfig } = require('./config');
const { buildApp } = require('./app');

const config = loadConfig();
const fastify = buildApp(config);

fastify
  .listen({ port: config.port, host: config.host })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
