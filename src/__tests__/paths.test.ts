import { describe, expect, it } from '@jest/globals';
import {
  assertAllowedPath,
  canonicalizeJcrPath,
  isPrefix,
  pageNameFromTitle
} from '../security/paths.js';
import { AEM_ERROR_CODES } from '../errors.js';

const policy = { allowedRoots: ['/content', '/content/dam', '/conf'], maxDepth: 5 };

describe('JCR path policy', () => {
  it('canonicalizes absolute paths', () => {
    expect(canonicalizeJcrPath('/content/mysite/en')).toBe('/content/mysite/en');
  });

  it('rejects prefix-confused paths such as /content-evil', () => {
    expect(() => assertAllowedPath('/content-evil', policy)).toThrow(
      expect.objectContaining({ code: AEM_ERROR_CODES.INVALID_PATH })
    );
    expect(isPrefix('/content', '/content-evil')).toBe(false);
    expect(isPrefix('/content', '/content/mysite')).toBe(true);
  });

  it('rejects traversal and encoded separators', () => {
    expect(() => canonicalizeJcrPath('/content/../apps')).toThrow();
    expect(() => canonicalizeJcrPath('/content/%2e%2e/apps')).toThrow();
    expect(() => canonicalizeJcrPath('/content/site;selector.json')).toThrow();
  });

  it('derives page names from titles', () => {
    expect(pageNameFromTitle('Hello World')).toBe('hello-world');
    expect(pageNameFromTitle('Hello', 'Custom_1')).toBe('Custom_1');
  });
});
