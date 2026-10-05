import { useState } from 'react'

import { useSession } from './useSession.js'

/**
 * Cierre de sesión para un botón: `{ loggingOut, logoutFailed, handleLogout }`.
 * Lo comparten las cabeceras, que son las que lo ofrecen.
 */
export function useLogout() {
  const { logout } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    setLogoutFailed(false)
    try {
      await logout()
    } catch (error) {
      // Sin respuesta del servidor no se sabe si la sesión se cerró; se deja
      // como estaba para que el usuario pueda reintentar.
      console.error('No se pudo cerrar la sesión', error)
      setLogoutFailed(true)
    } finally {
      setLoggingOut(false)
    }
  }

  return { loggingOut, logoutFailed, handleLogout }
}
