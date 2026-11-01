import { get, post, put } from '../../lib/apiClient.js'

/** Llamadas del módulo account: todas pasan por el cliente único de la API. */

/**
 * Crea una cuenta con su perfil. No inicia sesión. Devuelve
 * `{ id, email, name, profileComplete }`.
 */
export function registerAccount({ email, password, name, institutionId, userType, dataProcessingAuthorized }) {
  return post('/accounts', { email, password, name, institutionId, userType, dataProcessingAuthorized })
}

/** La lista cerrada de instituciones, `[{ id, name, other }]`, con «Otra» al final. */
export function fetchInstitutions() {
  return get('/institutions')
}

/**
 * Todos los datos de la cuenta con sesión, para su perfil. Un dato que la
 * cuenta no tiene llega como null.
 */
export function fetchProfile() {
  return get('/accounts/me')
}

/**
 * Completa el perfil de una cuenta anterior a él, con la nueva autorización.
 * Devuelve la cuenta de la sesión, ya con el perfil completo.
 */
export function completeProfile({ name, institutionId, userType, dataProcessingAuthorized }) {
  return put('/accounts/me/profile', { name, institutionId, userType, dataProcessingAuthorized })
}
