import { AEM_ERROR_CODES, AemError } from '../errors.js';

interface Entry {
  expiresAt: number;
  value: unknown;
}

export class IdempotencyStore {
  private readonly map = new Map<string, Entry>();

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
    const hit = this.map.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return Promise.resolve(hit.value as T);
    }
    return fn().then(value => {
      this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
      return value;
    });
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
