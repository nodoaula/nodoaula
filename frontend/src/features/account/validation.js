import { tidyText } from '../../lib/text.js'

/**
 * Las mismas reglas que RegistrationRequest y ProfileCompletionRequest en el
 * backend: si cambian allí, cambian aquí. El backend valida de nuevo; esto
 * solo evita un viaje al servidor para errores evidentes y da el aviso junto
 * al campo.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 64

// Límite de bcrypt. 64 caracteres con tildes o eñes pueden superarlo, porque
// cada uno ocupa dos bytes o más.
const PASSWORD_MAX_BYTES = 72

const EMAIL_MAX_LENGTH = 254

export const NAME_MAX_LENGTH = 100

const DATA_PROCESSING_MESSAGE =
  'Para crear la cuenta tienes que confirmar que tienes 18 años o más y autorizar el tratamiento de tus datos.'

const PROFILE_DATA_PROCESSING_MESSAGE =
  'Para continuar tienes que confirmar que tienes 18 años o más y autorizar el tratamiento de tus datos según la política vigente.'

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

// La longitud se mide sobre el nombre tal como se guardará, sin los espacios
// de sobra que el backend también quita.
export function validateName(name) {
  const tidy = tidyText(name)
  if (tidy === '') return 'Escribe tu nombre.'
  if (tidy.length > NAME_MAX_LENGTH) return `El nombre no puede tener más de ${NAME_MAX_LENGTH} caracteres.`
  return null
}

/**
 * Errores del perfil (HU506), con las claves que usa el backend para que los
 * de uno y otro lado se señalen igual: `name`, `institutionId` y `userType`.
 */
export function validateProfile({ name, institutionId, userType }) {
  const errors = {}

  const nameError = validateName(name)
  if (nameError) errors.name = nameError

  if (institutionId == null) errors.institutionId = 'Elige tu institución de la lista.'
  if (userType == null) errors.userType = 'Elige si eres estudiante o docente.'

  return errors
}

/** Devuelve un objeto con el error de cada campo inválido; vacío si todo es válido. */
export function validateRegistration({ email, password, dataProcessingAuthorized, ...profile }) {
  const errors = {}

  const nameError = validateName(profile.name)
  if (nameError) errors.name = nameError

  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError

  const passwordError = validatePassword(password)
  if (passwordError) errors.password = passwordError

  const { institutionId, userType } = validateProfile(profile)
  if (institutionId) errors.institutionId = institutionId
  if (userType) errors.userType = userType

  if (!dataProcessingAuthorized) errors.dataProcessingAuthorized = DATA_PROCESSING_MESSAGE

  return errors
}

/** Al completar el perfil, la autorización se pide de nuevo sobre la política vigente. */
export function validateProfileCompletion({ dataProcessingAuthorized, ...profile }) {
  const errors = validateProfile(profile)
  if (!dataProcessingAuthorized) errors.dataProcessingAuthorized = PROFILE_DATA_PROCESSING_MESSAGE
  return errors
}
