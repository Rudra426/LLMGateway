const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const token = sessionStorage.getItem('adminToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'x-admin-token': token } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(`${GATEWAY_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401) {
      sessionStorage.removeItem('adminToken');
      window.dispatchEvent(new Event('unauthorized'));
    }
    
    let body;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }

    if (!res.ok) {
      throw new ApiError(body?.error || `Request failed with status ${res.status}`, res.status);
    }
    return body;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Could not reach the gateway.', 0);
  }
}

export const api = {
  getStats: (range = '7d') => request(`/admin/stats?range=${range}`),
  getKeys: () => request('/admin/keys'),
  createKey: (data) => request('/admin/keys', { method: 'POST', body: JSON.stringify(data) }),
  revokeKey: (id) => request(`/admin/keys/${id}`, { method: 'DELETE' }),
  getLogs: (keyId = '') => request(`/admin/logs?limit=50${keyId ? `&keyId=${keyId}` : ''}`)
};
