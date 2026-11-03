import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'

const MESSAGES = {
  [CSRF_ERROR_CODE]: 'La página caducó. Recárgala e intenta de nuevo.',
  QUESTION_NOT_FOUND: 'Esta pregunta ya no está disponible. Recarga la página.',
  ANSWER_NOT_FOUND: 'Esa respuesta ya no está disponible.',
  QUESTION_CHANGE_FORBIDDEN: 'Solo quien publicó esta pregunta o una cuenta del equipo puede retirarla.',
  ANSWER_CHANGE_FORBIDDEN: 'Solo quien publicó esta respuesta o una cuenta del equipo puede retirarla.',
  USEFUL_ANSWER_FORBIDDEN: 'Solo quien hizo la pregunta puede marcar o quitar la respuesta útil.',
  GROUP_MEMBERS_ONLY: 'Solo los miembros del grupo responden en su hilo. Únete al grupo para participar.',
  GROUP_THREAD_CHANGE_FORBIDDEN: 'El hilo de un grupo se retira retirando el grupo.',
  // Al unirse al grupo desde su hilo (HU405), si lo retiraron mientras tanto.
  STUDY_GROUP_NOT_FOUND: 'Este grupo ya no está disponible. Recarga la página.',
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
