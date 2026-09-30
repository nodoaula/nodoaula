import { post } from '../../lib/apiClient.js'

/** Llamadas del módulo account: todas pasan por el cliente único de la API. */

/** Crea una cuenta. No inicia sesión. Devuelve `{ id, email }`. */
export function registerAccount({ email, password }) {
  return post('/accounts', { email, password })
}
