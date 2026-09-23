import { createContext } from 'react'

/** Lo rellena SessionProvider; se lee con useSession. */
export const SessionContext = createContext(null)

export const SESSION_STATUS = {
  // Todavía no se sabe si hay sesión: la interfaz no debe decidir nada aún.
  LOADING: 'loading',
  READY: 'ready',
}
