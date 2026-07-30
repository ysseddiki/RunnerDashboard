import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { AuthUser } from './auth'

type AuthContextValue = {
  user: AuthUser | null
  setUser: Dispatch<SetStateAction<AuthUser | null | undefined>>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth hors AuthProvider')
  }
  return ctx
}
