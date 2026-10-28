import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tras un envío rechazado lleva el foco al primer campo con error, después de
 * pintarse su mensaje, para que el lector de pantalla lo lea al llegar.
 * Devuelve la referencia para el formulario y la función que lo pide.
 */
export function useFocusFirstInvalid() {
  const formRef = useRef(null)
  const [requests, setRequests] = useState(0)

  useEffect(() => {
    if (requests > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [requests])

  const focusFirstInvalid = useCallback(() => setRequests((count) => count + 1), [])
  return [formRef, focusFirstInvalid]
}
