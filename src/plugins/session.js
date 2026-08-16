const fp = require('fastify-plugin');
const cookie = require('@fastify/cookie');
const session = require('@fastify/session');

async function sessionPlugin(fastify, opts) {
  await fastify.register(cookie);
  await fastify.register(session, {
    secret: opts.config.sessionSecret,
    cookieName: 'sftpapp_sid',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.config.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
    saveUninitialized: false,
  });
}

module.exports = fp(sessionPlugin, { name: 'session-plugin' });
