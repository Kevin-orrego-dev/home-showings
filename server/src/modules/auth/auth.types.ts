export type Role = 'seller' | 'buyer';

// What we put inside the JWT and attach to req.user.
// Only non-sensitive, rarely-changing data: never the password hash.
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
