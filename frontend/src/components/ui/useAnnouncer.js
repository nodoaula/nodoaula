import { useEffect, useRef, useState } from 'react'

/**
 * Anuncia un cambio a los lectores de pantalla: devuelve el mensaje, que se
 * pinta en una región <output>, y la función que lo cambia. Vacía la región
 * antes de escribir, para que un mismo texto se anuncie también dos veces
 * seguidas.
 */
export function useAnnouncer() {
  const [message, setMessage] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function announce(text) {
    setMessage('')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(text), 100)
  }

  return [message, announce]
}
