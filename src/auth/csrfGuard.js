const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Backstop against CSRF on top of SameSite=Lax session cookies. Browsers
 * send an Origin header on every state-changing (non-GET) fetch/XHR/form
 * request, cross-site or not — if one is present and doesn't match this
 * app's own host, the request is rejected. Requests with no Origin header
 * (non-browser clients, e.g. curl/server-to-server) are allowed through,
 * since SameSite already blocks the browser-based CSRF this exists to
 * catch as defense-in-depth.
 */
async function csrfOriginGuard(request, reply) {
  if (SAFE_METHODS.has(request.method)) return;

  const origin = request.headers.origin;
  if (!origin) return;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    reply.code(403).send({ error: 'Invalid Origin header' });
    return;
  }

  // request.host (not request.hostname, which strips the port) so a
  // non-default port on either side compares correctly — e.g. local dev
  // on :3000 would otherwise always mismatch against Origin's port-
  // inclusive host and get rejected.
  if (originHost !== request.host) {
    reply.code(403).send({ error: 'Cross-origin request rejected' });
  }
}

module.exports = { csrfOriginGuard };
