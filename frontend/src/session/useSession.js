import { useContext } from 'react'

import { SessionContext } from './SessionContext.js'

/**
 * Estado de la sesión: `{ status, account, login, logout }`. `account` es
 * `{ id, email }` o null si no hay sesión iniciada.
 */
export function useSession() {
  const session = useContext(SessionContext)
  if (session === null) {
    throw new Error('useSession solo puede usarse dentro de SessionProvider')
  }
  return session
}
