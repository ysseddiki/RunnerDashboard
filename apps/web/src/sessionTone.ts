/** CSS tone class for a session type id (e.g. `session-tone-ef`). */
export function sessionToneClass(sessionType: string | null | undefined): string {
  if (!sessionType) return 'session-tone-empty'
  return `session-tone-${sessionType}`
}
