import { describe, expect, it, vi } from 'vitest';
import { Login } from '../../../src/application/auth/login.js';
import type { TokenService } from '../../../src/domain/auth.js';
import { UnauthorizedError } from '../../../src/domain/errors.js';

function setup(valid: boolean) {
  const expiresAt = new Date('2026-01-01T01:00:00Z');
  const tokens: TokenService = {
    issue: vi.fn().mockResolvedValue({ token: 'signed.jwt', expiresAt }),
    verify: vi.fn(),
  };
  const login = new Login({ verify: () => valid }, tokens);
  return { login, tokens, expiresAt };
}

describe('Login', () => {
  it('issues a token for valid credentials', async () => {
    const { login, tokens, expiresAt } = setup(true);

    await expect(login.execute('admin', 'secret')).resolves.toEqual({ token: 'signed.jwt', expiresAt });
    expect(tokens.issue).toHaveBeenCalledWith('admin');
  });

  it('rejects invalid credentials without issuing a token', async () => {
    const { login, tokens } = setup(false);

    await expect(login.execute('admin', 'wrong')).rejects.toThrow(UnauthorizedError);
    await expect(login.execute('admin', 'wrong')).rejects.toThrow('Invalid username or password');
    expect(tokens.issue).not.toHaveBeenCalled();
  });
});
