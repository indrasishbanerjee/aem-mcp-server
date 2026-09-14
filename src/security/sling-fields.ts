import { AEM_ERROR_CODES, AemError } from '../errors.js';

export const SAFE_SLING_FIELD = /^[a-zA-Z][a-zA-Z0-9:_-]*$/;

export function assertSafeSlingFieldName(key: string): void {
  if (key.startsWith(':') || key.includes('@') || !SAFE_SLING_FIELD.test(key)) {
    throw new AemError({
      code: AEM_ERROR_CODES.INVALID_PARAMETERS,
      message: `Property '${key}' is not an allowed Sling field name`,
      statusCode: 400
    });
  }
}
