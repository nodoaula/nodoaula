import { get } from '../../lib/apiClient.js'

/** Llamadas del módulo catalog: todas pasan por el cliente único de la API. */

export function listResources(courseId) {
  const query = courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''
  return get(`/resources${query}`)
}

export function listCoursesWithResources() {
  return get('/resources/courses')
}
