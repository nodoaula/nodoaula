import { describe, expect, it } from 'vitest'

import { ApiError, CSRF_ERROR_CODE } from '../../lib/apiClient.js'
import { describeRetirementFailure, RETIREMENT_ACTION } from './retirement.js'

const { RETIRE, REPUBLISH } = RETIREMENT_ACTION

function rejected(status, code) {
  return new ApiError(String(status), { status, body: code ? { code } : null })
}

// Historia HU307: cada rechazo se explica por su código, nunca por el texto.
describe('describeRetirementFailure', () => {
  it('distingue el título de retirar del de volver a publicar', () => {
    expect(describeRetirementFailure(rejected(500), RETIRE).title).toBe('No se retiró el recurso')
    expect(describeRetirementFailure(rejected(500), REPUBLISH).title).toBe('No se volvió a publicar el recurso')
  })

  it('explica el rechazo por autoría y pide recargar la ficha', () => {
    const failure = describeRetirementFailure(rejected(403, 'RESOURCE_CHANGE_FORBIDDEN'), RETIRE)

    expect(failure.message).toBe('Solo quien aportó este recurso o una cuenta del equipo puede retirarlo.')
    expect(failure.reload).toBe(true)
  })

  it('explica que solo quien lo retiró puede volver a publicarlo', () => {
    const failure = describeRetirementFailure(rejected(403, 'RESOURCE_REPUBLISH_FORBIDDEN'), REPUBLISH)

    expect(failure.message).toBe('Solo quien retiró este recurso puede volver a publicarlo.')
    expect(failure.reload).toBe(true)
  })

  it('cuando otra cuenta cambió el estado, lo dice y pide recargar', () => {
    expect(describeRetirementFailure(rejected(409, 'RESOURCE_RETIRED'), RETIRE)).toMatchObject({
      message: 'Este recurso ya estaba retirado.',
      reload: true,
    })
    expect(describeRetirementFailure(rejected(409, 'RESOURCE_NOT_RETIRED'), REPUBLISH)).toMatchObject({
      message: 'Este recurso ya estaba publicado.',
      reload: true,
    })
  })

  // Un 403 por CSRF se arregla recargando; no es un problema de permisos.
  it('no confunde el rechazo por CSRF con uno por permisos', () => {
    const failure = describeRetirementFailure(rejected(403, CSRF_ERROR_CODE), RETIRE)

    expect(failure.message).toMatch(/seguridad de la petición/)
    expect(failure.reload).toBe(false)
  })

  it('distingue la sesión caducada, el tiempo agotado y la falta de conexión', () => {
    expect(describeRetirementFailure(rejected(401, 'AUTHENTICATION_REQUIRED'), RETIRE).message).toMatch(/sesión ya no está activa/)
    expect(describeRetirementFailure(new ApiError('x', { timedOut: true }), RETIRE).message).toMatch(/no sabemos si se retiró/)
    expect(describeRetirementFailure(new ApiError('x', { timedOut: true }), REPUBLISH).message).toMatch(/no sabemos si se volvió a publicar/)
    expect(describeRetirementFailure(new ApiError('x'), RETIRE).message).toMatch(/No se pudo contactar con el servidor/)
  })

  it('cualquier otro fallo es un error del servidor', () => {
    const failure = describeRetirementFailure(rejected(500), RETIRE)

    expect(failure.message).toMatch(/error del servidor/)
    expect(failure.reload).toBe(false)
  })
})
