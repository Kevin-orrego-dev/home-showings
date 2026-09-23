import type { CookieOptions, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verifyToken } from '../modules/auth/auth.service.js';
import type { Role } from '../modules/auth/auth.types.js';

export const AUTH_COOKIE = 'token';

export const authCookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the browser can't read it -> an XSS bug can't steal the token
  sameSite: 'lax', // not sent on cross-site POSTs -> basic CSRF protection
  secure: env.NODE_ENV === 'production', // HTTPS only in production
  maxAge: 24 * 60 * 60 * 1000, // 1 day, same as the JWT
  path: '/',
};

// AUTHENTICATION: "who are you?"  -> 401 if we don't know.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw unauthorized();

  try {
    req.user = verifyToken(token);
  } catch {
    throw unauthorized('Session expired, please log in again');
  }
  next();
};

// AUTHORIZATION: "are you allowed to do this?"  -> 403 if not.
// Usage: router.post('/', requireAuth, requireRole('seller'), handler)
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden(`Only ${roles.join(' or ')} accounts can do this`);
    }
    next();
  };
