import type { AppConfig } from '../config.js';
import { pathPolicy } from '../config.js';
import { AEM_ERROR_CODES, AemError } from '../errors.js';
import { assertAllowedPath, pageNameFromTitle } from '../security/paths.js';
import type { AemHttpClient } from './client.js';

export interface SuccessEnvelope<T> {
  success: true;
  operation: string;
  timestamp: string;
  data: T;
}

export function ok<T>(operation: string, data: T): SuccessEnvelope<T> {
  return {
    success: true,
    operation,
    timestamp: new Date().toISOString(),
    data
  };
}

export function clampLimit(requested: number | undefined, config: AppConfig): number {
  const value = requested ?? config.aem.defaultLimit;
  return Math.min(Math.max(1, value), config.aem.maxLimit);
}

export function clampDepth(requested: number | undefined, config: AppConfig): number {
  const value = requested ?? 2;
  return Math.min(Math.max(0, value), config.aem.maxDepth);
}

export function requirePath(raw: string, config: AppConfig): string {
  return assertAllowedPath(raw, pathPolicy(config));
}

export function systemKey(key: string): boolean {
  return (
    key.startsWith('jcr:') ||
    key.startsWith('sling:') ||
    key.startsWith('cq:') ||
    key.startsWith('rep:') ||
    key.startsWith('oak:')
  );
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function ensureExists(
  client: AemHttpClient,
  path: string,
  label: string
): Promise<Record<string, unknown>> {
  try {
    return asRecord(await client.get(`${path}.json`, { ':depth': 1 }));
  } catch (error) {
    if (error instanceof AemError && error.code === AEM_ERROR_CODES.RESOURCE_NOT_FOUND) {
      throw new AemError({
        code: AEM_ERROR_CODES.RESOURCE_NOT_FOUND,
        message: `${label} not found: ${path}`,
        statusCode: 404,
        details: { path }
      });
    }
    throw error;
  }
}

export { pageNameFromTitle };
