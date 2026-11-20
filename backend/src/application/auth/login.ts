import type { CredentialsVerifier, IssuedToken, TokenService } from '../../domain/auth.js';
import { UnauthorizedError } from '../../domain/errors.js';

export class Login {
  constructor(
    private readonly credentials: CredentialsVerifier,
    private readonly tokens: TokenService,
  ) {}

  async execute(username: string, password: string): Promise<IssuedToken> {
    // One message for every failure, so callers cannot tell which part was wrong.
    if (!this.credentials.verify(username, password)) {
      throw new UnauthorizedError('Invalid username or password');
    }
    return this.tokens.issue(username);
  }
}
