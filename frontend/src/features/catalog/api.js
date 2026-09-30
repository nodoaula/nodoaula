import { get, post } from '../../lib/apiClient.js'

/** Llamadas del módulo catalog: todas pasan por el cliente único de la API. */

// Normaliza un filtro a lista: acepta un solo id (uso histórico, p. ej. desde
// el formulario de alta de recurso) o varios (selección múltiple del
// catálogo, historia HU206); undefined/null/'' se queda en lista vacía.
function toIdList(value) {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Lista el catálogo. Los cuatro filtros son opcionales y se combinan entre sí
 * (historias HU206 y HU207): un objeto vacío o sin alguno de ellos no
 * restringe nada. courseIds, topicIds y resourceTypes admiten varios valores
 * a la vez.
 */
export function listResources({ courseIds, topicIds, resourceTypes, q } = {}) {
  const params = new URLSearchParams()
  for (const id of toIdList(courseIds)) params.append('courseId', id)
  for (const id of toIdList(topicIds)) params.append('topicId', id)
  if (q) params.set('q', q)
  for (const type of resourceTypes ?? []) {
    params.append('resourceType', type)
  }

  const query = params.toString()
  return get(`/resources${query ? `?${query}` : ''}`)
}

/** Ficha de un recurso. Pública, como el listado. */
export function getResource(resourceId) {
  return get(`/resources/${encodeURIComponent(resourceId)}`)
}

export function listCoursesWithResources() {
  return get('/resources/courses')
}

/**
 * Temas con al menos un recurso, para poblar un selector. Con courseIds,
 * solo los de esos cursos; sin ellos, los de todos (historia HU206). Admite
 * un único id (formulario de alta, historia HU105) o varios (catálogo).
 */
export function listTopicsWithResources(courseIds) {
  const params = new URLSearchParams()
  for (const id of toIdList(courseIds)) params.append('courseId', id)
  const query = params.toString()
  return get(`/resources/topics${query ? `?${query}` : ''}`)
}

/**
 * Registra un recurso. Exige sesión iniciada; el backend toma el autor de
 * ella. Devuelve el recurso creado, con la misma forma que el listado.
 */
export function createResource(resource) {
  return post('/resources', resource)
}
