import { AEM_ERROR_CODES, AemError } from '../errors.js';

const FORBIDDEN_SEGMENTS = new Set(['.', '..']);
// Intentionally reject C0 controls and DEL in JCR paths.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[;?#\\%\u0000-\u001f\u007f]/;

export interface PathPolicy {
  allowedRoots: string[];
  maxDepth: number;
}

/**
 * Decode, reject traversal/selectors, and return a normalized absolute JCR path.
 */
export function canonicalizeJcrPath(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PATH,
      message: 'Path is required',
      statusCode: 400
    });
  }
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PATH,
      message: 'Path contains invalid encoding',
      statusCode: 400
    });
  }
  if (ILLEGAL.test(decoded) || decoded.includes('%')) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PATH,
      message: 'Path contains illegal characters, selectors, or encoded separators',
      statusCode: 400,
      details: { path: raw }
    });
  }
  if (!decoded.startsWith('/')) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PATH,
      message: 'Path must be an absolute JCR path',
      statusCode: 400
    });
  }
  const segments = decoded.split('/').filter(Boolean);
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment) || segment.includes('\\')) {
      throw new AemError({
        code: AEM_ERROR_CODES.INVALID_PATH,
        message: 'Path traversal is not allowed',
        statusCode: 400
      });
    }
  }
  return `/${segments.join('/')}`;
}

export function isPrefix(root: string, path: string): boolean {
  const normalizedRoot = root.endsWith('/') ? root.slice(0, -1) : root;
  return path === normalizedRoot || path.startsWith(`${normalizedRoot}/`);
}

export function assertAllowedPath(raw: string, policy: PathPolicy): string {
  const path = canonicalizeJcrPath(raw);
  const allowed = policy.allowedRoots.some(root => isPrefix(root, path));
  if (!allowed) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PATH,
      message: `Path '${path}' is outside allowed roots`,
      statusCode: 400,
      details: { path, allowedRoots: policy.allowedRoots }
    });
  }
  return path;
}

export function pageNameFromTitle(title: string, fallback?: string): string {
  if (fallback && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(fallback)) {
    return fallback;
  }
  const name = title
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  if (!name) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message: 'Unable to derive a valid page name from title',
      statusCode: 400
    });
  }
  return name;
}
