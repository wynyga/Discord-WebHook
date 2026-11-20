import { describe, expect, it } from 'vitest';
import { EnvCredentialsVerifier } from '../../../src/infrastructure/auth/env-credentials-verifier.js';

const verifier = new EnvCredentialsVerifier({ username: 'admin', password: 'correct-horse' });

describe('EnvCredentialsVerifier', () => {
  it('accepts the configured credentials', () => {
    expect(verifier.verify('admin', 'correct-horse')).toBe(true);
  });

  it.each([
    ['wrong password', 'admin', 'wrong'],
    ['wrong username', 'root', 'correct-horse'],
    ['both wrong', 'root', 'wrong'],
    ['password prefix', 'admin', 'correct'],
    ['different case', 'Admin', 'correct-horse'],
    ['empty', '', ''],
  ])('rejects %s', (_label, username, password) => {
    expect(verifier.verify(username, password)).toBe(false);
  });
});
