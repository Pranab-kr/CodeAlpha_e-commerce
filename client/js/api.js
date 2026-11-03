export class ApiError extends Error {
  constructor(message, { code, status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let tokenProvider = () => null;
let refreshHandler = null;

export function configureAuth({ getToken, refresh }) {
  if (typeof getToken === 'function') tokenProvider = getToken;
  if (typeof refresh === 'function') refreshHandler = refresh;
}

async function request(path, { method = 'GET', body, headers, signal } = {}, retryAuth = true) {
  const token = tokenProvider();
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  }

  if (response.status === 401 && retryAuth && refreshHandler) {
    const refreshed = await refreshHandler();
    if (refreshed) return request(path, { method, body, headers, signal }, false);
  }

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(error?.message ?? 'The request failed.', {
      code: error?.code,
      status: response.status,
      details: error?.details,
    });
  }

  return payload;
}

export function apiFetch(path, { method = 'GET', body, headers, signal } = {}) {
  return request(path, { method, body, headers, signal });
}

export function apiGet(path, options = {}) {
  return request(path, { ...options, method: 'GET' });
}

export function apiPost(path, body, options = {}) {
  return request(path, { ...options, method: 'POST', body });
}

export function apiPatch(path, body, options = {}) {
  return request(path, { ...options, method: 'PATCH', body });
}

export function apiDelete(path, options = {}) {
  return request(path, { ...options, method: 'DELETE' });
}

export function apiRequestNoAuthRetry(path, options = {}) {
  return request(path, options, false);
}
