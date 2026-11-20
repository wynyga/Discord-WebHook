import { decodeJwt, errors, jwtVerify, SignJWT } from 'jose';
import type { IssuedToken, TokenClaims, TokenService } from '../../domain/auth.js';
import { UnauthorizedError } from '../../domain/errors.js';

const ALGORITHM = 'HS256';
const ISSUER = 'insignia-scheduler';
const AUDIENCE = 'insignia-scheduler-api';

export class JwtTokenService implements TokenService {
  private readonly key: Uint8Array;

  /** `expiresIn` uses jose's time span format, e.g. `15m`, `1h`. */
  constructor(
    secret: string,
    private readonly expiresIn: string,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(subject: string): Promise<IssuedToken> {
    const token = await new SignJWT()
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(subject)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(this.expiresIn)
      .sign(this.key);
    const { exp } = decodeJwt(token);
    return { token, expiresAt: new Date((exp ?? 0) * 1000) };
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        requiredClaims: ['sub', 'exp'],
      });
      return { subject: payload.sub as string };
    } catch (err) {
      if (err instanceof errors.JWTExpired) throw new UnauthorizedError('Token expired');
      throw new UnauthorizedError('Invalid token');
    }
  }
}
