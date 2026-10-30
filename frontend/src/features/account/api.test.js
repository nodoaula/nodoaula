import { describe, expect, it, vi } from 'vitest'

import { post } from '../../lib/apiClient.js'
import { registerAccount } from './api.js'

vi.mock('../../lib/apiClient.js', () => ({ post: vi.fn() }))

describe('registerAccount', () => {
  it('envía la autorización del tratamiento de datos junto con las credenciales', () => {
    registerAccount({ email: 'lectora@example.com', password: 'contrasena-larga', dataProcessingAuthorized: true })

    expect(post).toHaveBeenCalledWith('/accounts', {
      email: 'lectora@example.com',
      password: 'contrasena-larga',
      dataProcessingAuthorized: true,
    })
  })
})
