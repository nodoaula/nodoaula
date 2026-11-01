import { useCallback, useSyncExternalStore } from 'react'

/** Si la consulta de medios se cumple ahora; se actualiza al cambiar. */
export function useMediaQuery(query) {
  // La misma función en cada render: si cambiara, React volvería a suscribirse.
  const subscribe = useCallback(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** Para un efecto puntual (un desplazamiento), sin volver a pintar. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
