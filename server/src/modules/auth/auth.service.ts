import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../db/pool.js';
import { conflict, unauthorized } from '../../lib/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import type { AuthUser } from './auth.types.js';

const BCRYPT_ROUNDS = 10;

// Used when the email doesn't exist, so a login attempt takes the same time
// whether or not the account exists (prevents discovering emails by timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

// The service layer holds business logic and talks to the DB.
// It knows nothing about Express (no req/res), which keeps it easy to test and reuse.

export async function register(input: RegisterInput): Promise<AuthUser> {
  const existing = await query('SELECT 1 FROM users WHERE lower(email) = $1', [input.email]);
  if (existing.rowCount) throw conflict('An account with that email already exists');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const { rows } = await query<AuthUser>(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [input.name, input.email, passwordHash, input.role],
  );
  return rows[0];
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const { rows } = await query<AuthUser & { password_hash: string }>(
    'SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = $1',
    [input.email],
  );
  const user = rows[0];

  const passwordOk = await bcrypt.compare(input.password, user?.password_hash ?? DUMMY_HASH);

  // Same message for "no such email" and "wrong password":
  // telling them apart would let anyone check which emails are registered.
  if (!user || !passwordOk) throw unauthorized('Invalid email or password');

  const { password_hash: _omit, ...publicUser } = user;
  return publicUser;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const { rows } = await query<AuthUser>('SELECT id, name, email, role FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { name: user.name, email: user.email, role: user.role },
    env.JWT_SECRET,
    { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
  );
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & Omit<AuthUser, 'id'>;
  return { id: payload.sub!, name: payload.name, email: payload.email, role: payload.role };
}
