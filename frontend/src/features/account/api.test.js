import { describe, expect, it, vi } from 'vitest'

import { get, post, put } from '../../lib/apiClient.js'
import { completeProfile, fetchInstitutions, fetchProfile, registerAccount } from './api.js'

vi.mock('../../lib/apiClient.js', () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))

describe('registerAccount', () => {
  it('envía el perfil y la autorización del tratamiento de datos junto con las credenciales', () => {
    registerAccount({
      email: 'lectora@example.com',
      password: 'contrasena-larga',
      name: 'Ana Pérez',
      institutionId: 12,
      userType: 'STUDENT',
      dataProcessingAuthorized: true,
    })

    expect(post).toHaveBeenCalledWith('/accounts', {
      email: 'lectora@example.com',
      password: 'contrasena-larga',
      name: 'Ana Pérez',
      institutionId: 12,
      userType: 'STUDENT',
      dataProcessingAuthorized: true,
    })
  })
})

// Historia HU506.
describe('perfil de la cuenta', () => {
  it('la lista de instituciones y el perfil se piden por GET', () => {
    fetchInstitutions()
    fetchProfile()

    expect(get).toHaveBeenCalledWith('/institutions')
    expect(get).toHaveBeenCalledWith('/accounts/me')
  })

  it('completar el perfil envía la nueva autorización', () => {
    completeProfile({ name: 'Ana', institutionId: 99, userType: 'TEACHER', dataProcessingAuthorized: true })

    expect(put).toHaveBeenCalledWith('/accounts/me/profile', {
      name: 'Ana',
      institutionId: 99,
      userType: 'TEACHER',
      dataProcessingAuthorized: true,
    })
  })
})
