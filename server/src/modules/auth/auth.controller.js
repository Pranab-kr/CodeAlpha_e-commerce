import * as authService from './auth.service.js';

export async function register(req, res) {
  const data = await authService.register(req.body, req, res);
  res.status(201).json({ data });
}

export async function login(req, res) {
  const data = await authService.login(req.body, req, res);
  res.json({ data });
}

export async function refresh(req, res) {
  const data = await authService.refresh(req);
  res.json({ data });
}

export async function logout(req, res) {
  await authService.logout(req, res);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ data: authService.me(req) });
}
