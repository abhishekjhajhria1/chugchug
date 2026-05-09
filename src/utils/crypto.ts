// ─── Secure Random Code Generation ──────────────────────────────
// Uses crypto.getRandomValues() instead of Math.random() for
// cryptographically strong random codes.

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No ambiguous: 0/O, 1/I/L

/**
 * Generate a cryptographically secure random code.
 * @param length Number of random characters (default 6)
 * @param prefix Optional prefix (e.g. "CHUG")
 */
export function generateSecureCode(length = 6, prefix = ''): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  let code = prefix
  for (let i = 0; i < length; i++) {
    code += CHARSET[array[i] % CHARSET.length]
  }
  return code
}

/**
 * Generate invite code with CHUG prefix + 5 random chars
 * Total: 9 chars → 30^5 = 24.3M combinations
 */
export function generateInviteCode(): string {
  return generateSecureCode(5, 'CHUG')
}

/**
 * Generate session join code — 6 random chars
 * Total: 30^6 = 729M combinations
 */
export function generateSessionCode(): string {
  return generateSecureCode(6)
}
