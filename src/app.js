const path = require('node:path');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const rateLimit = require('@fastify/rate-limit');
const helmet = require('@fastify/helmet');

const sessionPlugin = require('./plugins/session');
const multipartPlugin = require('./plugins/multipart');
const { csrfOriginGuard } = require('./auth/csrfGuard');
const authRoutes = require('./routes/auth.routes');
const filesRoutes = require('./routes/files.routes');
const uploadRoutes = require('./routes/upload.routes');

function buildApp(config) {
  const fastify = Fastify({
    logger:
      config.nodeEnv === 'production'
        ? true
        : { transport: { target: 'pino-pretty' } },
    trustProxy: config.trustProxy,
  });

  fastify.decorate('config', config);

  fastify.setErrorHandler((error, request, reply) => {
    // Our own error classes (fs/fs.errors.js) always set statusCode
    // explicitly, including expected >=500 cases like InsufficientStorageError
    // (507) — those are legitimate conditions, not bugs, so their real
    // message should reach the client. Only truly unexpected errors (no
    // statusCode set) get masked and logged.
    if (error.statusCode) {
      reply.code(error.statusCode).send({ error: error.message });
      return;
    }
    request.log.error(error);
    reply.code(500).send({ error: 'Internal server error' });
  });

  fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' is needed for styleSrc because public/index.html
        // inlines its CSS directly in <head> (deliberately, to avoid a
        // render-blocking network round-trip for a stylesheet this small).
        // scriptSrc stays locked to 'self' — all JS is external same-origin
        // files, no inline scripts anywhere.
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  fastify.addHook('preHandler', csrfOriginGuard);

  fastify.register(sessionPlugin, { config });
  fastify.register(multipartPlugin, { config });

  fastify.register(rateLimit, {
    global: false,
  });

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
  });

  fastify.register(authRoutes, { prefix: '/api' });
  fastify.register(filesRoutes, { prefix: '/api' });
  fastify.register(uploadRoutes, { prefix: '/api' });

  return fastify;
}

module.exports = { buildApp };
