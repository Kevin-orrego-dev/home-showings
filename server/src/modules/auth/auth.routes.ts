import { Router } from 'express';
import { AUTH_COOKIE, authCookieOptions, requireAuth } from '../../middleware/auth.js';
import { unauthorized } from '../../lib/errors.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

// Route handlers stay thin: parse input -> call service -> send response.
// With Express 5, anything thrown here (including ZodError from .parse)
// goes straight to errorHandler. No try/catch needed.
export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await authService.register(input);
  res.cookie(AUTH_COOKIE, authService.signToken(user), authCookieOptions);
  res.status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await authService.login(input);
  res.cookie(AUTH_COOKIE, authService.signToken(user), authCookieOptions);
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _ignored, ...clearOptions } = authCookieOptions;
  res.clearCookie(AUTH_COOKIE, clearOptions);
  res.status(204).end();
});

// The frontend calls this on page load to know if there's an active session.
// We re-read the user from the DB, so a deleted account stops working immediately.
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await authService.findUserById(req.user!.id);
  if (!user) throw unauthorized('Account no longer exists');
  res.json({ user });
});
