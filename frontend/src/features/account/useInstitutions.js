import { useEffect, useState } from 'react'

import { fetchInstitutions } from './api.js'

/**
 * La lista cerrada de instituciones, para el registro y para completar el
 * perfil: `{ institutions, failed }`. `institutions` es null mientras carga.
 */
export function useInstitutions() {
  const [institutions, setInstitutions] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // StrictMode ejecuta el efecto dos veces en desarrollo; este indicador
    // evita que una consulta ya descartada escriba el estado.
    let active = true
    fetchInstitutions()
      .then((loaded) => {
        if (active) setInstitutions(loaded)
      })
      .catch((error) => {
        console.error('No se pudo cargar la lista de instituciones', error)
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  return { institutions, failed }
}
