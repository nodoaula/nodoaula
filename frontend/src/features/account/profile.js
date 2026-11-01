/** Los dos tipos de usuario (HU506), con el valor que espera la API. */
export const USER_TYPES = [
  { value: 'STUDENT', label: 'Estudiante' },
  { value: 'TEACHER', label: 'Docente' },
]

/** «Estudiante» o «Docente»; null si la cuenta aún no lo tiene. */
export function userTypeLabel(value) {
  return USER_TYPES.find((type) => type.value === value)?.label ?? null
}

/**
 * "1 de noviembre de 2026, 5:40 p. m.": una fecha del perfil, con la hora,
 * porque la de la autorización dice qué versión de la política se aceptó.
 */
export function formatProfileDate(isoInstant) {
  return new Date(isoInstant).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })
}

/**
 * La inicial del nombre, para la cabecera en pantallas estrechas. Por puntos
 * de código y no por unidades UTF-16, para no partir un carácter en dos.
 */
export function initialOf(name) {
  const [first = ''] = name.trim()
  return first.toLocaleUpperCase('es-CO')
}
