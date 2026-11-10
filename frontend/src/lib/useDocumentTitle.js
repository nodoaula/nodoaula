import { useEffect } from 'react'

const SITE = 'NodoAula'

/**
 * El título de la pestaña: «<pantalla> · NodoAula». Sin pantalla, solo el nombre
 * del sitio. Cada pantalla lo pone al abrirse y lo deja como estaba al salir,
 * para que un lector de pantalla confirme a qué página llegó (WCAG 2.4.2).
 */
export function useDocumentTitle(screen) {
  useEffect(() => {
    document.title = screen ? `${screen} · ${SITE}` : SITE
    return () => {
      document.title = SITE
    }
  }, [screen])
}
