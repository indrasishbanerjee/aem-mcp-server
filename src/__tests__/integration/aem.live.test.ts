import { describe, expect, it } from '@jest/globals';

const live = process.env.AEM_INTEGRATION === '1';

describe('live AEM 6.5 integration', () => {
  it('is skipped unless AEM_INTEGRATION=1 and AEM_HOST is set', () => {
    if (!live) {
      expect(process.env.AEM_INTEGRATION ?? '0').not.toBe('1');
    }
  });

  (live ? it : it.skip)('connects to Author CSRF endpoint', async () => {
    const { loadConfig } = await import('../../config.js');
    const { Logger } = await import('../../logger.js');
    const { AemConnector } = await import('../../aem/connector.js');
    const config = loadConfig(process.env);
    const connector = new AemConnector(config, new Logger(config.logging));
    await expect(connector.testConnection()).resolves.toBe(true);
  });
});
