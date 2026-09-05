import { describe, expect, it } from '@jest/globals';
import { loadConfig } from '../config.js';
import { AEM_ERROR_CODES } from '../errors.js';

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    AEM_HOST: 'http://localhost:4502',
    AEM_SERVICE_USER: 'mcp-technical',
    AEM_SERVICE_PASSWORD: 'secret',
    HTTP_ENABLED: 'false',
    ...overrides
  };
}

describe('loadConfig', () => {
  it('requires AEM credentials', () => {
    expect(() => loadConfig({ NODE_ENV: 'development' })).toThrow(
      expect.objectContaining({ code: AEM_ERROR_CODES.INVALID_PARAMETERS })
    );
  });

  it('rejects admin/admin in production', () => {
    expect(() =>
      loadConfig(
        baseEnv({
          NODE_ENV: 'production',
          AEM_SERVICE_USER: 'admin',
          AEM_SERVICE_PASSWORD: 'admin',
          HTTP_ENABLED: 'false'
        })
      )
    ).toThrow(expect.objectContaining({ code: AEM_ERROR_CODES.AUTHENTICATION_FAILED }));
  });

  it('requires HTTP credentials in production', () => {
    expect(() =>
      loadConfig(
        baseEnv({
          NODE_ENV: 'production',
          HTTP_ENABLED: 'true'
        })
      )
    ).toThrow(expect.objectContaining({ code: AEM_ERROR_CODES.AUTHENTICATION_FAILED }));
  });

  it('loads a valid local configuration', () => {
    const config = loadConfig(baseEnv({ MCP_API_KEY: 'k', HTTP_ENABLED: 'true' }));
    expect(config.aem.username).toBe('mcp-technical');
    expect(config.aem.defaultPageResourceType).toContain('core/wcm/components/page');
  });
});
