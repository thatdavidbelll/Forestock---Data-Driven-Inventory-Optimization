/**
 * Extracts a human-readable error message from an unknown axios/fetch error.
 * Tries ApiResponse.message first, then falls back to the provided default.
 */
export function extractErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred. Please try again.'
): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { response?: { data?: { message?: string } } }
    const msg = e.response?.data?.message
    if (msg && typeof msg === 'string') return msg
  }
  return fallback
}
