import { get, post } from '../../lib/apiClient.js'

/** Llamadas del módulo catalog: todas pasan por el cliente único de la API. */

/**
 * Lista el catálogo, entero o de un curso, y con búsqueda de texto si se da
 * `q`. Pública, como la ficha.
 */
export function listResources({ courseId, q } = {}) {
  const params = new URLSearchParams()
  if (courseId !== undefined) params.set('courseId', courseId)
  if (q) params.set('q', q)

  const query = params.toString()
  return get(query ? `/resources?${query}` : '/resources')
}

/** Ficha de un recurso. Pública, como el listado. */
export function getResource(resourceId) {
  return get(`/resources/${encodeURIComponent(resourceId)}`)
}

export function listCoursesWithResources() {
  return get('/resources/courses')
}

/** Temas de un curso con al menos un recurso, para sugerirlos al registrar otro. */
export function listTopicsWithResources(courseId) {
  return get(`/resources/topics?${new URLSearchParams({ courseId })}`)
}

// El intento y el plazo total coinciden para que el cliente no reintente: un
// 503 de esta consulta es la respuesta del backend cuando YouTube no está
// disponible, no un backend que todavía arranca, y repetirla solo haría
// esperar al usuario y gastar cuota.
const YOUTUBE_LOOKUP_TIMEOUT_MS = 15_000

/**
 * Datos de un video de YouTube para autocompletar el registro (historia
 * HU202). Exige sesión iniciada. `link` es un enlace o el identificador suelto.
 */
export function getYouTubeMetadata(link) {
  const params = new URLSearchParams({ url: link })
  return get(`/resources/youtube-metadata?${params}`, {
    attemptTimeoutMs: YOUTUBE_LOOKUP_TIMEOUT_MS,
    totalTimeoutMs: YOUTUBE_LOOKUP_TIMEOUT_MS,
  })
}

/**
 * Registra un recurso. Exige sesión iniciada; el backend toma el autor de
 * ella. Devuelve el recurso creado, con la misma forma que el listado.
 */
export function createResource(resource) {
  return post('/resources', resource)
}

// Un PDF de 20 MB tarda minutos con una conexión lenta: con el plazo de una
// petición ordinaria, el navegador la cortaría aunque el backend la estuviera
// recibiendo. Cinco minutos cubren unos 0,5 Mbit/s.
const UPLOAD_TIMEOUT_MS = 5 * 60_000

/**
 * Sube un apunte (historia HU302). Exige sesión iniciada; el backend toma el
 * autor de ella. Devuelve el recurso creado, con la misma forma que el listado.
 */
export function createDocument({ file, title, description, course, topics, rightsDeclared }) {
  const form = new FormData()
  form.append('file', file)
  form.append('title', title)
  if (description) form.append('description', description)
  form.append('course', course)
  topics.forEach((topic) => form.append('topics', topic))
  form.append('rightsDeclared', String(rightsDeclared))

  return post('/resources/documents', form, {
    attemptTimeoutMs: UPLOAD_TIMEOUT_MS,
    totalTimeoutMs: UPLOAD_TIMEOUT_MS,
  })
}
