export const MAX_NAME = 200
export const MAX_DESCRIPTION = 2000

/**
 * Errores del formulario de crear un grupo (HU404), por campo, con los mismos
 * límites que la API: nombre obligatorio de hasta 200 caracteres y
 * descripción opcional de hasta 2000. Se mide el texto sin los espacios de
 * los extremos, que es lo que se guarda.
 */
export function validateGroup({ name, description }) {
  const errors = {}
  if (name.trim() === '') errors.name = 'Escribe el nombre del grupo.'
  else if (name.trim().length > MAX_NAME) errors.name = `El nombre no puede tener más de ${MAX_NAME} caracteres.`
  if (description.trim().length > MAX_DESCRIPTION) {
    errors.description = `La descripción no puede tener más de ${MAX_DESCRIPTION} caracteres.`
  }
  return errors
}

/**
 * Traduce el rechazo del backend a mensajes junto al campo o, si no es de un
 * campo, a un aviso general. Un nombre repetido en el curso es del campo
 * nombre aunque llegue como 409.
 */
export function describeCreateFailure(error) {
  if (error.code === 'STUDY_GROUP_NAME_TAKEN') {
    return { fieldErrors: { name: 'Ya hay un grupo con ese nombre en este curso. Elige otro.' } }
  }
  if (error.code === 'VALIDATION_FAILED' && Array.isArray(error.body?.errors)) {
    const fieldErrors = {}
    for (const { field, message } of error.body.errors) fieldErrors[field] ??= message
    return { fieldErrors }
  }
  if (error.status === 401) return { general: 'Tu sesión terminó. Inicia sesión de nuevo para crear el grupo.' }
  if (error.timedOut) return { general: 'El servidor tardó demasiado. Revisa la lista antes de volver a enviar.' }
  return { general: 'No se pudo crear el grupo. Intenta de nuevo.' }
}
