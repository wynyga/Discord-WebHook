import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../../src/domain/errors.js';
import { JwtTokenService } from '../../../src/infrastructure/auth/jwt-token-service.js';

const SECRET = 'test-secret-that-is-at-least-32-characters';
const service = new JwtTokenService(SECRET, '1h');

function sign(claims: { sub?: string; iss?: string; aud?: string; exp?: number }, secret = SECRET) {
  const jwt = new SignJWT().setProtectedHeader({ alg: 'HS256' }).setIssuedAt();
  if (claims.sub) jwt.setSubject(claims.sub);
  jwt.setIssuer(claims.iss ?? 'insignia-scheduler');
  jwt.setAudience(claims.aud ?? 'insignia-scheduler-api');
  jwt.setExpirationTime(claims.exp ?? '1h');
  return jwt.sign(new TextEncoder().encode(secret));
}

describe('JwtTokenService', () => {
  it('issues a token that verifies back to its subject', async () => {
    const { token, expiresAt } = await service.issue('admin');

    await expect(service.verify(token)).resolves.toEqual({ subject: 'admin' });
    const ttl = expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(59 * 60_000);
    expect(ttl).toBeLessThanOrEqual(60 * 60_000);
  });

  it('rejects an expired token with its own message', async () => {
    const token = await sign({ sub: 'admin', exp: Math.floor(Date.now() / 1000) - 60 });

    await expect(service.verify(token)).rejects.toThrow(new UnauthorizedError('Token expired'));
  });

  it.each([
    ['signed with another secret', () => sign({ sub: 'admin' }, 'another-secret-that-is-also-32-chars-long')],
    ['for another audience', () => sign({ sub: 'admin', aud: 'someone-else' })],
    ['from another issuer', () => sign({ sub: 'admin', iss: 'someone-else' })],
    ['without a subject', () => sign({})],
    ['that is not a JWT', async () => 'not-a-jwt'],
  ])('rejects a token %s', async (_label, makeToken) => {
    await expect(service.verify(await makeToken())).rejects.toThrow(new UnauthorizedError('Invalid token'));
  });

  it('rejects the unsigned "none" algorithm', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encode({ alg: 'none' })}.${encode({ sub: 'admin', exp })}.`;

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedError);
  });
});
