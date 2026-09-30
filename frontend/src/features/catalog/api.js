import { get, post } from '../../lib/apiClient.js'

/** Llamadas del módulo catalog: todas pasan por el cliente único de la API. */

/**
 * Lista el catálogo. Los cuatro filtros son opcionales y se combinan entre sí
 * (historias HU206 y HU207): un objeto vacío o sin alguno de ellos no
 * restringe nada.
 */
export function listResources({ courseId, topicId, resourceTypes, q } = {}) {
  const params = new URLSearchParams()
  if (courseId) params.set('courseId', courseId)
  if (topicId) params.set('topicId', topicId)
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
 * Temas con al menos un recurso, para poblar un selector. Con courseId,
 * solo los de ese curso; sin él, los de todos (historia HU206).
 */
export function listTopicsWithResources(courseId) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
  return get(`/resources/topics${query}`)
}

/**
 * Registra un recurso. Exige sesión iniciada; el backend toma el autor de
 * ella. Devuelve el recurso creado, con la misma forma que el listado.
 */
export function createResource(resource) {
  return post('/resources', resource)
}
