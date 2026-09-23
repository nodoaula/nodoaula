import { get, post } from '../../lib/apiClient.js'

/** Llamadas del módulo catalog: todas pasan por el cliente único de la API. */

export function listResources(courseId) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
  return get(`/resources${query}`)
}

export function listCoursesWithResources() {
  return get('/resources/courses')
}

/**
 * Registra un recurso. Exige sesión iniciada; el backend toma el autor de
 * ella. Devuelve el recurso creado, con la misma forma que el listado.
 */
export function createResource(resource) {
  return post('/resources', resource)
}
