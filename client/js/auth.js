import { apiRequestNoAuthRetry, configureAuth } from './api.js';
import { sanitizeNext } from './format.js';

let accessToken = null;
let currentUser = null;
let refreshing = null;
let resolveSessionReady = null;

const sessionReady = new Promise((resolve) => {
  resolveSessionReady = resolve;
});

export function markSessionReady() {
  resolveSessionReady?.();
  resolveSessionReady = null;
}

export function whenSessionReady() {
  return sessionReady;
}

export function getAccessToken() {
  return accessToken;
}

export function getCurrentUser() {
  return currentUser;
}

export function isSignedIn() {
  return Boolean(currentUser);
}

function setSession(user, token, { announce = true } = {}) {
  currentUser = user;
  accessToken = token;
  if (announce) {
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user } }));
  }
}

function clearSession({ announce = true } = {}) {
  const hadUser = Boolean(currentUser);
  currentUser = null;
  accessToken = null;

  if (announce && hadUser) {
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null } }));
  }
  if (announce && hadUser) {
    window.dispatchEvent(new Event('auth:signed-out'));
  }
}

export async function refreshSession({ announce = true } = {}) {
  if (currentUser) return true;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const payload = await apiRequestNoAuthRetry('/api/auth/refresh', { method: 'POST' });
      setSession(payload.data.user, payload.data.accessToken, { announce });
      return true;
    } catch {
      clearSession({ announce });
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function signIn(email, password) {
  const payload = await apiRequestNoAuthRetry('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setSession(payload.data.user, payload.data.accessToken);
  return payload.data.user;
}

export async function signUp(name, email, password) {
  const payload = await apiRequestNoAuthRetry('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
  setSession(payload.data.user, payload.data.accessToken);
  return payload.data.user;
}

export async function signOut() {
  try {
    await apiRequestNoAuthRetry('/api/auth/logout', { method: 'POST' });
  } finally {
    clearSession();
  }
}

export async function requireAuth({ next = `${location.pathname}${location.search}` } = {}) {
  if (currentUser) return currentUser;

  const restored = await refreshSession();
  if (restored) return currentUser;

  location.assign(`/login.html?next=${encodeURIComponent(sanitizeNext(next))}`);
  return null;
}

configureAuth({
  getToken: () => accessToken,
  refresh: () => refreshSession({ announce: true }),
});
