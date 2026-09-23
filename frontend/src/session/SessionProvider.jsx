import { useCallback, useEffect, useMemo, useState } from 'react'

import * as sessionApi from './api.js'
import { SESSION_STATUS, SessionContext } from './SessionContext.js'

/**
 * Al montarse pregunta al backend si hay una sesión iniciada, de modo que la
 * interfaz lo sabe desde que carga. La cookie de sesión no la puede leer
 * ningún script, así que preguntar es la única forma de saberlo.
 */
export default function SessionProvider({ children }) {
  const [status, setStatus] = useState(SESSION_STATUS.LOADING)
  const [account, setAccount] = useState(null)

  useEffect(() => {
    // StrictMode ejecuta el efecto dos veces en desarrollo; este indicador
    // evita que una consulta ya descartada escriba el estado.
    let active = true

    sessionApi
      .fetchCurrentAccount()
      .then((current) => {
        if (active) setAccount(current)
      })
      .catch((error) => {
        // Sin respuesta clara se trata como sin sesión: el catálogo es
        // público, y quien la tenga puede recargar o volver a entrar.
        console.error('No se pudo comprobar la sesión', error)
      })
      .finally(() => {
        if (active) setStatus(SESSION_STATUS.READY)
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const loggedIn = await sessionApi.login(credentials)
    setAccount(loggedIn)
    return loggedIn
  }, [])

  const logout = useCallback(async () => {
    await sessionApi.logout()
    setAccount(null)
  }, [])

  const value = useMemo(() => ({ status, account, login, logout }), [status, account, login, logout])

  return <SessionContext value={value}>{children}</SessionContext>
}
