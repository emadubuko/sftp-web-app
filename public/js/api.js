const api = {
  async me() {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    return res.json();
  },

  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Login failed');
    return body;
  },

  async logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  },

  async listFiles(pathValue) {
    const res = await fetch(`/api/files?path=${encodeURIComponent(pathValue || '')}`, {
      credentials: 'same-origin',
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to list files');
    return body;
  },

  async mkdir(parentPath, name) {
    const res = await fetch('/api/files/mkdir', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: parentPath, name }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create folder');
    return body;
  },
};
