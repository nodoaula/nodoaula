import { useEffect, useState } from 'react'

import { listResources } from './api.js'

// Espera esto sin teclear antes de buscar, para no mandar una petición por
// cada tecla.
const SEARCH_DEBOUNCE_MS = 400

/**
 * Búsqueda por texto en el catálogo, en todos los cursos o en uno. Solo pide
 * resultados cuando se deja de teclear. `pending` indica que los resultados
 * de lo escrito todavía no han llegado.
 */
export function useResourceSearch(initialText, courseId) {
  const [text, setText] = useState(initialText)
  const [query, setQuery] = useState(initialText.trim())
  // La respuesta guarda la búsqueda que la produjo: si no coincide con la
  // actual, todavía no ha llegado.
  const [response, setResponse] = useState({ query: '', resources: [], error: null })

  useEffect(() => {
    const timeoutId = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeoutId)
  }, [text])

  useEffect(() => {
    if (query === '') return undefined
    let active = true

    listResources(courseId === undefined ? { q: query } : { q: query, courseIds: [courseId] })
      .then((resources) => {
        if (active) setResponse({ query, resources, error: null })
      })
      .catch((error) => {
        if (active) setResponse({ query, resources: [], error })
      })

    return () => {
      active = false
    }
  }, [query, courseId])

  return {
    text,
    setText,
    searching: text.trim() !== '',
    // query vacía con texto escrito: se acaba de empezar y la espera aún no termina.
    pending: query === '' || response.query !== query,
    query,
    resources: response.resources,
    error: response.error,
  }
}
