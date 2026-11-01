import { useSyncExternalStore } from 'react'

/** Si la consulta de medios se cumple ahora; se actualiza al cambiar. */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Para un efecto puntual (un desplazamiento), sin volver a pintar. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
