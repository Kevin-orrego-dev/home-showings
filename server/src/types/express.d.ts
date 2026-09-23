import type { AuthUser } from '../modules/auth/auth.types.js';

// Declaration merging: teaches TypeScript that, after requireAuth runs,
// req.user exists and has this shape. No more `(req as any).user`.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
