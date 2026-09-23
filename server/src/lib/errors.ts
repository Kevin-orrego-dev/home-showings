// An error we throw on purpose, carrying the HTTP status to answer with.
// Anything that is NOT an AppError is treated as a bug (500).
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Small factories keep call sites short and consistent:
//   throw notFound('Listing not found')
export const badRequest = (message: string) => new AppError(400, 'BAD_REQUEST', message);
export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
