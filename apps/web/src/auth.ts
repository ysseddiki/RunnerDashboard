/** Fetch API avec cookie de session. */

export type AuthUser = {
  id: number
  strava_athlete_id: number
  firstname: string | null
  lastname: string | null
  display_name: string | null
  role: 'user' | 'admin'
  created_at: string | null
  last_login_at: string | null
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: init.headers,
  })
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await apiFetch('/api/auth/me')
  if (res.status === 401) return null
  if (!res.ok) {
    throw new ApiError(res.status, `Auth HTTP ${res.status}`)
  }
  return (await res.json()) as AuthUser
}

export async function logout(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' })
}

export function stravaLoginUrl(): string {
  return '/api/auth/strava/login'
}
