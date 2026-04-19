import { nanoid } from 'nanoid'

/**
 * Generates a URL-safe session ID.
 * e.g. "V1StGXR8_Z5jdHi6B-myT"
 */
export function generateSessionId(): string {
  return nanoid(10)
}
