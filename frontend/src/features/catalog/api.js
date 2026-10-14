import { get, post, put } from '../../lib/apiClient.js'

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

// Un campo opcional vacío se envía como null: así el backend lo borra.
const orNull = (value) => (value === '' ? null : value)

/**
 * Corrige los datos de un recurso (historia HU311). Exige sesión y que quien
 * corrige sea quien lo aportó o una cuenta del equipo. Un apunte solo envía
 * título, descripción, curso y temas: su fecha es la de la subida, y el
 * backend rechaza la fecha, la duración y el canal en un apunte. El enlace y
 * el archivo no se corrigen y nunca se envían. Devuelve la ficha corregida.
 */
export function updateResource(resourceId, { resourceType, title, description, publishedAt, durationSeconds, channel, course, topics }) {
  const data = { title, description: orNull(description), course, topics }
  if (resourceType !== 'DOCUMENT') {
    data.publishedAt = publishedAt
    data.durationSeconds = durationSeconds === '' ? null : Number(durationSeconds)
    data.channel = orNull(channel)
  }
  return put(`/resources/${encodeURIComponent(resourceId)}`, data)
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
