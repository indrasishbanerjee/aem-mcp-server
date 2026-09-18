import { describe, expect, it } from '@jest/globals';
import { IdempotencyStore } from '../aem/idempotency.js';
import { WriteSemaphore } from '../aem/semaphore.js';
import { CircuitBreaker } from '../aem/circuit-breaker.js';

describe('bounded execution helpers', () => {
  it('replays idempotent results', async () => {
    const store = new IdempotencyStore(60_000);
    let runs = 0;
    const first = await store.remember('createPage:abc', async () => {
      runs += 1;
      return { ok: true };
    });
    const second = await store.remember('createPage:abc', async () => {
      runs += 1;
      return { ok: false };
    });
    expect(first).toEqual(second);
    expect(runs).toBe(1);
  });

  it('limits concurrent writes', async () => {
    const lock = new WriteSemaphore(1);
    let current = 0;
    let max = 0;
    await Promise.all(
      [1, 2, 3].map(() =>
        lock.run(async () => {
          current += 1;
          max = Math.max(max, current);
          await new Promise(resolve => setTimeout(resolve, 20));
          current -= 1;
        })
      )
    );
    expect(max).toBe(1);
  });

  it('opens after repeated failures', () => {
    const breaker = new CircuitBreaker(2, 60_000);
    breaker.recordFailure();
    breaker.assertClosed();
    breaker.recordFailure();
    expect(() => breaker.assertClosed()).toThrow(/circuit breaker/);
  });
});
