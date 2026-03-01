/**
 * Input sanitization utilities to prevent XSS and malformed data.
 * Apply before any user input is written to Firebase.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch)
}

/** Remove HTML/script tags and control chars; trim; limit length. */
export function sanitizeString(value: string, maxLen = 200): string {
  if (typeof value !== 'string') return ''
  let s = value
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}

/** Sanitize display-safe string ( escapes HTML entities ). */
export function sanitizeDisplayString(value: string, maxLen = 200): string {
  return escapeHtml(sanitizeString(value, maxLen))
}

/** Validate and sanitize email for storage. */
export function sanitizeEmail(value: string): string {
  if (typeof value !== 'string') return ''
  const s = value.trim().toLowerCase().slice(0, 128)
  // Basic format check
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return re.test(s) ? s : ''
}

/** Validate MAC address format (XX:XX:XX:XX:XX:XX). */
export function sanitizeMac(value: string): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toUpperCase().replace(/-/g, ':')
  const re = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/
  return re.test(normalized) ? normalized : ''
}

/** Clamp number to range; returns NaN if invalid. */
export function sanitizeNumber(
  value: string | number,
  min: number,
  max: number
): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(n)) return NaN
  return Math.max(min, Math.min(max, Math.round(n)))
}

/** Clamp int; returns default if invalid. */
export function sanitizeInt(
  value: string | number,
  min: number,
  max: number,
  fallback: number
): number {
  const n = sanitizeNumber(value, min, max)
  return Number.isNaN(n) ? fallback : Math.round(n)
}
