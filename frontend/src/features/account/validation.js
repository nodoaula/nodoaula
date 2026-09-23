/**
 * Las mismas reglas que RegistrationRequest en el backend: si cambian allí,
 * cambian aquí. El backend valida de nuevo; esto solo evita un viaje al
 * servidor para errores evidentes y da el aviso junto al campo.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 64

// Límite de bcrypt. 64 caracteres con tildes o eñes pueden superarlo, porque
// cada uno ocupa dos bytes o más.
const PASSWORD_MAX_BYTES = 72

const EMAIL_MAX_LENGTH = 254

// Tan permisiva como la validación del backend, que no restringe el dominio
// ni exige un punto en él: solo algo, una arroba y algo, sin espacios.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

const utf8 = new TextEncoder()

export function validateEmail(email) {
  if (email === '') return 'Escribe tu correo.'
  if (email.length > EMAIL_MAX_LENGTH) return 'El correo no puede tener más de 254 caracteres.'
  if (!EMAIL_PATTERN.test(email)) return 'Escribe un correo válido, como nombre@ejemplo.com.'
  return null
}

// `length` cuenta unidades UTF-16, igual que @Size en Java, de modo que ambos
// lados coinciden en el límite incluso con emojis.
export function validatePassword(password) {
  if (password === '') return 'Escribe una contraseña.'
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres.`
  }
  if (utf8.encode(password).length > PASSWORD_MAX_BYTES) {
    return 'La contraseña es demasiado larga: las tildes, eñes y otros símbolos ocupan más espacio. Usa menos caracteres.'
  }
  return null
}

/**
 * Al iniciar sesión solo se exige que los campos no estén vacíos. Las reglas
 * de formato son del registro: aplicarlas aquí dejaría fuera a una cuenta
 * creada antes de que cambiaran, y las credenciales las juzga el backend.
 */
export function validateLogin({ email, password }) {
  const errors = {}
  if (email === '') errors.email = 'Escribe tu correo.'
  if (password === '') errors.password = 'Escribe tu contraseña.'
  return errors
}

/** Devuelve un objeto con el error de cada campo inválido; vacío si todo es válido. */
export function validateRegistration({ email, password }) {
  const errors = {}

  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError

  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError

  return errors
}
