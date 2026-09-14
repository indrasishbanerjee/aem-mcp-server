import { AEM_ERROR_CODES, AemError } from '../errors.js';

interface Entry {
  expiresAt: number;
  value: unknown;
}

export class IdempotencyStore {
  private readonly map = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly ttlMs: number) {}

  remember<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key) {
      return fn();
    }
    if (key.length > 128 || !/^[A-Za-z0-9:_-]+$/.test(key)) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PARAMETERS,
        message: 'Invalid idempotency key',
        statusCode: 400
      });
    }
    this.purge();
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const hit = this.map.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return Promise.resolve(hit.value as T);
    }
    const run = fn()
      .then(value => {
        this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, run);
    return run;
  }

  private purge(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
      }
    }
  }
}
