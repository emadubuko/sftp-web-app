const { verifyCredentials } = require('../auth/auth.service');

async function authRoutes(fastify) {
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body || {};
      const ok = await verifyCredentials(fastify.config, username, password);
      if (!ok) {
        reply.code(401).send({ ok: false, error: 'Invalid credentials' });
        return;
      }
      request.session.user = { username: fastify.config.adminUsername };
      reply.send({
        ok: true,
        username: fastify.config.adminUsername,
        allowedFileExtensions: fastify.config.allowedFileExtensions,
      });
    }
  );

  fastify.post('/logout', async (request, reply) => {
    request.session.destroy();
    reply.send({ ok: true });
  });

  fastify.get('/me', async (request, reply) => {
    if (!request.session.user) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    reply.send({
      username: request.session.user.username,
      allowedFileExtensions: fastify.config.allowedFileExtensions,
    });
  });
}

module.exports = authRoutes;
