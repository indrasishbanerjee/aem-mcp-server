import { AEM_ERROR_CODES, AemError } from '../errors.js';

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly threshold = 5,
    private readonly resetMs = 30_000
  ) {}

  assertClosed(): void {
    if (this.failures < this.threshold) {
      return;
    }
    if (Date.now() - this.openedAt >= this.resetMs) {
      this.failures = 0;
      this.openedAt = 0;
      return;
    }
    throw new AemError({
      code: AEM_ERROR_CODES.CONNECTION_FAILED,
      message: 'AEM circuit breaker is open after repeated upstream failures',
      recoverable: true,
      statusCode: 503,
      retryAfterMs: this.resetMs - (Date.now() - this.openedAt)
    });
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }
}
