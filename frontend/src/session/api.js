import { get, loadCsrfToken, postForm, remove } from '../lib/apiClient.js'

/** Llamadas de la sesión: todas pasan por el cliente único de la API. */

/**
 * Cuenta con la sesión iniciada, o null si no hay sesión. El backend responde
 * 401 cuando no la hay; aquí eso no es un error, sino la respuesta.
 */
export async function fetchCurrentAccount() {
  try {
    return await get('/session')
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
}

/**
 * Inicia sesión. Devuelve `{ id, email }`. Si las credenciales no valen, el
 * error lleva el código INVALID_CREDENTIALS, el mismo exista o no el correo.
 * El backend renueva el token CSRF en la propia respuesta.
 */
export function login({ email, password }) {
  return postForm('/session', { email, password })
}

/**
 * Cierra la sesión en el servidor. El backend retira el token CSRF al
 * cerrarla, así que se pide uno nuevo para que la siguiente petición que
 * modifique datos no tenga que esperar a obtenerlo.
 */
export async function logout() {
  await remove('/session')

  // Si falla, el cliente lo volverá a pedir antes de la siguiente petición
  // que lo necesite; no es motivo para dar el cierre de sesión por fallido.
  await loadCsrfToken().catch((error) => console.error('No se pudo renovar el token CSRF', error))
}
