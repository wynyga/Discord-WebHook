/** Base class for expected failures; the HTTP layer maps `code` to a status. */
export abstract class DomainError extends Error {
  abstract readonly code: 'NOT_FOUND' | 'VALIDATION' | 'UNAUTHORIZED' | 'CONFLICT';

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
