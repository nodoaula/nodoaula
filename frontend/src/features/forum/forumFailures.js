import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'

const MESSAGES = {
  [CSRF_ERROR_CODE]: 'La página caducó. Recárgala e intenta de nuevo.',
  QUESTION_NOT_FOUND: 'Esta pregunta ya no está disponible. Recarga la página.',
  ANSWER_NOT_FOUND: 'Esa respuesta ya no está disponible.',
  QUESTION_CHANGE_FORBIDDEN: 'Solo quien publicó esta pregunta o una cuenta del equipo puede retirarla.',
  ANSWER_CHANGE_FORBIDDEN: 'Solo quien publicó esta respuesta o una cuenta del equipo puede retirarla.',
  USEFUL_ANSWER_FORBIDDEN: 'Solo quien hizo la pregunta puede marcar o quitar la respuesta útil.',
}

/**
 * Lo que se le dice a quien ve una pregunta cuando falla lo que intentó.
 * `fallback` es el mensaje si la causa no es ninguna de las conocidas.
 */
export function describeForumFailure(error, fallback) {
  if (MESSAGES[error.code]) return MESSAGES[error.code]
  if (error.status === 401) return 'Tu sesión terminó. Inicia sesión de nuevo.'
  if (error.timedOut) return 'El servidor tardó demasiado. Recarga la página para ver si se hizo el cambio.'
  return fallback
}
