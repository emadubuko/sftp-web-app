async function requireAuth(request, reply) {
  if (!request.session.user) {
    reply.code(401).send({ error: 'unauthenticated' });
  }
}

module.exports = { requireAuth };
