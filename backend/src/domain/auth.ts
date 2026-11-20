export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

export interface TokenClaims {
  subject: string;
}

export interface TokenService {
  issue(subject: string): Promise<IssuedToken>;
  /** Throws `UnauthorizedError` when the token is malformed, forged or expired. */
  verify(token: string): Promise<TokenClaims>;
}

export interface CredentialsVerifier {
  /** Must take the same time whether the username, the password or both are wrong. */
  verify(username: string, password: string): boolean;
}
