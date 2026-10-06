/** Storage key under which the current Session is kept. */
export const SESSION_KEY = 'at.session';

/** Failure of an account operation; `status` is the HTTP status when it came from the server. */
export class AuthError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}
