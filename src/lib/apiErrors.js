/**
 * Единый формат ошибок API: { message, status, code }.
 * 400 — некорректные данные, 403 — чужие данные / нет прав.
 */

export class ApiError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  toJSON() {
    return {
      message: this.message,
      status: this.status,
      ...(this.code ? { code: this.code } : {}),
    };
  }
}

const FORBIDDEN_PATTERNS = [
 /42501/i,
 /permission denied/i,
 /access denied/i,
 /нет доступа/i,
 /недостаточно прав/i,
 /forbidden/i,
 /row-level security/i,
 /чуж/i,
];

const BAD_REQUEST_PATTERNS = [
 /22023/i,
 /23514/i,
 /23505/i,
 /22P02/i,
 /invalid/i,
 /должен быть/i,
 /некорректн/i,
 /не указан/i,
 /не найден/i,
 /не более/i,
];

function matchesPatterns(text, patterns) {
  return patterns.some((re) => re.test(text));
}

/**
 * @param {import('@supabase/supabase-js').AuthError | { message?: string, code?: string, status?: number } | null | undefined} error
 * @param {string} [fallback]
 * @returns {ApiError}
 */
export function fromSupabaseError(error, fallback = 'Ошибка запроса') {
  if (!error) {
    return new ApiError(fallback, 500);
  }

  const message = error.message || fallback;
  const code = error.code || null;
  const httpStatus = error.status ?? error.statusCode ?? null;

  if (httpStatus === 403 || code === '42501' || matchesPatterns(message, FORBIDDEN_PATTERNS)) {
    return new ApiError(message, 403, code);
  }

  if (httpStatus === 400 || matchesPatterns(message, BAD_REQUEST_PATTERNS)) {
    return new ApiError(message, 400, code);
  }

  if (httpStatus === 401) {
    return new ApiError(message, 401, code);
  }

  if (httpStatus === 404 || code === 'PGRST116') {
    return new ApiError(message, 404, code);
  }

  return new ApiError(message, httpStatus || 500, code);
}

/** @param {unknown} err */
export function toApiError(err, fallback = 'Ошибка запроса') {
  if (err instanceof ApiError) {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return fromSupabaseError(err, fallback);
  }
  return new ApiError(fallback, 500);
}

export function badRequest(message) {
  return new ApiError(message, 400);
}

export function forbidden(message = 'Нет доступа к чужим данным') {
  return new ApiError(message, 403);
}
