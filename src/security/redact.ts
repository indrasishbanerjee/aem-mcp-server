const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|api[-_]?key|cookie|filecontent|file_content/i;

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return '[redacted]';
  }
  if (typeof value === 'string' && value.length > 2048) {
    return `${value.slice(0, 128)}…[truncated ${value.length} chars]`;
  }
  return value;
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.slice(0, 50).map(item => redact(item, depth + 1));
  }
  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = redactValue(key, redact(value, depth + 1));
    }
    return result;
  }
  return input;
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
