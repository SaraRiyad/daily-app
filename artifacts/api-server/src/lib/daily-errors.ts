export class DailyError extends Error {
  constructor(
    public readonly status: 400 | 401 | 409 | 429 | 500 | 503,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "DailyError";
  }
}

export function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return undefined;
}

export function databaseUnavailable(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return !!code && (
    code.startsWith("08") || code.startsWith("53") || code.startsWith("57") ||
    ["42P01", "42703", "28P01", "3D000", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(code)
  );
}