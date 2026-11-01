import { useContext } from 'react'

import { SessionContext } from './SessionContext.js'

/**
 * Estado de la sesión: `{ status, account, login, logout, updateAccount }`.
 * `account` es `{ id, email, name, profileComplete }` o null si no hay sesión
 * iniciada. Con `profileComplete` en falso, `name` es null: la cuenta es
 * anterior al perfil y tiene que completarlo (HU506).
 */
export function useSession() {
  const session = useContext(SessionContext)
  if (session === null) {
    throw new Error('useSession solo puede usarse dentro de SessionProvider')
  }
  return session
}
