import { describe, expect, it } from '@jest/globals';
import { redact } from '../security/redact.js';

describe('redact', () => {
  it('redacts credentials and truncates large strings', () => {
    const result = redact({
      password: 'super-secret',
      AEM_SERVICE_PASSWORD: 'x',
      fileContent: 'a'.repeat(3000),
      body: 'b'.repeat(3000),
      nested: { authorization: 'Basic abc' }
    }) as Record<string, unknown>;
    expect(result.password).toBe('[redacted]');
    expect(result.AEM_SERVICE_PASSWORD).toBe('[redacted]');
    expect(result.fileContent).toBe('[redacted]');
    expect(String(result.body)).toContain('[truncated');
    expect((result.nested as Record<string, unknown>).authorization).toBe('[redacted]');
  });
});
