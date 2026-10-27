/**
 * Domain/application errors. The HTTP layer maps each `code` to a status code,
 * so business code never needs to know about HTTP.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_FUNDS'
  | 'QUOTE_UNAVAILABLE';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid credentials') {
    super('UNAUTHORIZED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message: string) {
    super('INSUFFICIENT_FUNDS', message);
  }
}

export class QuoteUnavailableError extends AppError {
  constructor(message = 'BTC quote is temporarily unavailable, try again in a few seconds') {
    super('QUOTE_UNAVAILABLE', message);
  }
}
