import { createHash, timingSafeEqual } from 'node:crypto';
import type { CredentialsVerifier } from '../../domain/auth.js';

/** Checks against the single admin account from the environment. */
export class EnvCredentialsVerifier implements CredentialsVerifier {
  constructor(private readonly admin: { username: string; password: string }) {}

  verify(username: string, password: string): boolean {
    // Both comparisons always run, so timing does not reveal which part was wrong.
    const usernameMatches = constantTimeEquals(username, this.admin.username);
    const passwordMatches = constantTimeEquals(password, this.admin.password);
    return usernameMatches && passwordMatches;
  }
}

/** Hashing first gives equal-length buffers, which `timingSafeEqual` requires. */
function constantTimeEquals(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
