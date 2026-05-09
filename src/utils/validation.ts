// ─── Input Validation & Sanitization ─────────────────────────────

/**
 * Sanitize text input: trim, strip control characters, enforce max length.
 */
export function sanitizeText(input: string, maxLen = 500): string {
  // Strip control characters (except newline/tab for multiline fields)
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen)
}

/**
 * Validate username: 3-20 chars, alphanumeric + underscores only.
 * Returns error message or null if valid.
 */
export function validateUsername(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 3) return "Username must be at least 3 characters"
  if (trimmed.length > 20) return "Username must be under 20 characters"
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return "Username can only contain letters, numbers, and underscores"
  return null
}

/**
 * Validate group name: 2-40 chars.
 * Returns error message or null if valid.
 */
export function validateGroupName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length < 2) return "Group name must be at least 2 characters"
  if (trimmed.length > 40) return "Group name must be under 40 characters"
  return null
}
