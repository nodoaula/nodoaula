import { CSRF_ERROR_CODE } from '../../lib/apiClient.js'

/** Lo que se hace con un recurso desde su ficha (historia HU307). */
export const RETIREMENT_ACTION = {
  RETIRE: 'retire',
  REPUBLISH: 'republish',
}

// Se comparan por código, nunca por el texto del backend.
const FAILURE_MESSAGES = {
  RESOURCE_CHANGE_FORBIDDEN: 'Solo quien aportó este recurso o una cuenta del equipo puede retirarlo.',
  RESOURCE_REPUBLISH_FORBIDDEN: 'Solo quien retiró este recurso puede volver a publicarlo.',
  RESOURCE_RETIRED: 'Este recurso ya estaba retirado.',
  RESOURCE_NOT_RETIRED: 'Este recurso ya estaba publicado.',
  RESOURCE_NOT_FOUND: 'Este recurso ya no existe.',
  [CSRF_ERROR_CODE]: 'No se pudo verificar la seguridad de la petición. Recarga la página e inténtalo de nuevo.',
}

// Rechazos que dicen que la ficha a la vista ya no refleja el recurso: otra
// cuenta lo retiró o lo volvió a publicar, o cambió el permiso de quien la ve.
const STALE_CODES = new Set([
  'RESOURCE_CHANGE_FORBIDDEN',
  'RESOURCE_REPUBLISH_FORBIDDEN',
  'RESOURCE_RETIRED',
  'RESOURCE_NOT_RETIRED',
])

/**
 * Explica por qué no se pudo retirar o volver a publicar un recurso, y si la
 * ficha debe recargarse para mostrar su estado real.
 *
 * @param {object} error el ApiError de la llamada
 * @param {string} action uno de RETIREMENT_ACTION
 * @returns {{ title: string, message: string, reload: boolean }}
 */
export function describeRetirementFailure(error, action) {
  const retiring = action === RETIREMENT_ACTION.RETIRE
  const title = retiring ? 'No se retiró el recurso' : 'No se volvió a publicar el recurso'
  const reload = STALE_CODES.has(error.code)

  if (FAILURE_MESSAGES[error.code]) return { title, message: FAILURE_MESSAGES[error.code], reload }
  if (error.status === 401) {
    return { title, message: 'Tu sesión ya no está activa. Vuelve a iniciar sesión e inténtalo de nuevo.', reload }
  }
  // Tras un tiempo agotado no se sabe si el cambio se hizo: se invita a
  // comprobarlo antes de repetir.
  if (error.timedOut) {
    return {
      title,
      message: retiring
        ? 'El servidor tardó demasiado en responder y no sabemos si se retiró. Recarga la página para ver su estado.'
        : 'El servidor tardó demasiado en responder y no sabemos si se volvió a publicar. Recarga la página para ver su estado.',
      reload,
    }
  }
  if (error.status === null || error.status === undefined) {
    return { title, message: 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.', reload }
  }
  return { title, message: 'Ocurrió un error del servidor. Inténtalo de nuevo en unos minutos.', reload }
}
