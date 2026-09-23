/**
 * Las mismas reglas que CreateResourceRequest en el backend: si cambian allí,
 * cambian aquí. El backend valida de nuevo; esto solo evita un viaje al
 * servidor para errores evidentes y da el aviso junto al campo.
 */

const TITLE_MAX_LENGTH = 300
const DESCRIPTION_MAX_LENGTH = 2000
const CHANNEL_MAX_LENGTH = 200
const URL_MAX_LENGTH = 2048
const COURSE_MAX_LENGTH = 200
const TOPIC_MAX_LENGTH = 200

// Exige un esquema (http/https lo normal) para descartar de entrada algo que
// claramente no es un enlace; el backend hace la comprobación completa.
const URL_PATTERN = /^https?:\/\/.+/i

export function validateTitle(title) {
  if (title === '') return 'Escribe el título.'
  if (title.length > TITLE_MAX_LENGTH) return `El título no puede tener más de ${TITLE_MAX_LENGTH} caracteres.`
  return null
}

export function validateDescription(description) {
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return `La descripción no puede tener más de ${DESCRIPTION_MAX_LENGTH} caracteres.`
  }
  return null
}

export function validatePublishedAt(publishedAt) {
  if (publishedAt === '') return 'Elige la fecha de publicación.'
  return null
}

// Cadena vacía es "sin duración": el campo es opcional.
export function validateDurationSeconds(durationSeconds) {
  if (durationSeconds === '') return null
  const value = Number(durationSeconds)
  if (!Number.isInteger(value) || value <= 0) {
    return 'La duración debe ser un número de segundos mayor que cero.'
  }
  return null
}

export function validateChannel(channel) {
  if (channel.length > CHANNEL_MAX_LENGTH) return `El canal no puede tener más de ${CHANNEL_MAX_LENGTH} caracteres.`
  return null
}

export function validateUrl(url) {
  if (url === '') return 'Escribe el enlace.'
  if (url.length > URL_MAX_LENGTH) return `El enlace no puede tener más de ${URL_MAX_LENGTH} caracteres.`
  if (!URL_PATTERN.test(url)) return 'Escribe un enlace válido, como https://ejemplo.com.'
  return null
}

export function validateResourceType(resourceType) {
  if (resourceType === '') return 'Elige el tipo de recurso.'
  return null
}

export function validateCourse(course) {
  if (course === '') return 'Escribe el curso.'
  if (course.length > COURSE_MAX_LENGTH) return `El curso no puede tener más de ${COURSE_MAX_LENGTH} caracteres.`
  return null
}

/** `topics` ya viene como lista de nombres recortados y sin vacíos: ver parseTopics. */
export function validateTopics(topics) {
  if (topics.length === 0) return 'Escribe al menos un tema.'
  if (topics.some((topic) => topic.length > TOPIC_MAX_LENGTH)) {
    return `Un tema no puede tener más de ${TOPIC_MAX_LENGTH} caracteres.`
  }
  return null
}

/** El formulario pide los temas separados por comas; aquí se convierten en la lista que espera la API. */
export function parseTopics(topicsText) {
  return topicsText
    .split(',')
    .map((topic) => topic.trim())
    .filter((topic) => topic !== '')
}

/** Devuelve un objeto con el error de cada campo inválido; vacío si todo es válido. */
export function validateCreateResource({ title, description, publishedAt, durationSeconds, channel, url,
  resourceType, course, topics }) {
  const errors = {}

  const titleError = validateTitle(title)
  if (titleError) errors.title = titleError

  const descriptionError = validateDescription(description)
  if (descriptionError) errors.description = descriptionError

  const publishedAtError = validatePublishedAt(publishedAt)
  if (publishedAtError) errors.publishedAt = publishedAtError

  const durationError = validateDurationSeconds(durationSeconds)
  if (durationError) errors.durationSeconds = durationError

  const channelError = validateChannel(channel)
  if (channelError) errors.channel = channelError

  const urlError = validateUrl(url)
  if (urlError) errors.url = urlError

  const resourceTypeError = validateResourceType(resourceType)
  if (resourceTypeError) errors.resourceType = resourceTypeError

  const courseError = validateCourse(course)
  if (courseError) errors.course = courseError

  const topicsError = validateTopics(topics)
  if (topicsError) errors.topics = topicsError

  return errors
}
