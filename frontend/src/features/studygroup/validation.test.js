import { describe, expect, it } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { describeCreateFailure, validateGroup } from './validation.js'

describe('validateGroup', () => {
  it('acepta un nombre y deja la descripción opcional', () => {
    expect(validateGroup({ name: 'Repaso del parcial', description: '' })).toEqual({})
  })

  it('exige el nombre, también si solo tiene espacios', () => {
    expect(validateGroup({ name: '   ', description: '' })).toEqual({ name: 'Escribe el nombre del grupo.' })
  })

  it('admite hasta 200 caracteres de nombre y 2000 de descripción, sin contar los espacios de los extremos', () => {
    expect(validateGroup({ name: ` ${'n'.repeat(200)} `, description: ` ${'d'.repeat(2000)} ` })).toEqual({})
    expect(validateGroup({ name: 'n'.repeat(201), description: 'd'.repeat(2001) })).toEqual({
      name: 'El nombre no puede tener más de 200 caracteres.',
      description: 'La descripción no puede tener más de 2000 caracteres.',
    })
  })
})

describe('describeCreateFailure', () => {
  it('un nombre repetido en el curso es un error del campo nombre', () => {
    const error = new ApiError('x', { status: 409, body: { code: 'STUDY_GROUP_NAME_TAKEN' } })
    expect(describeCreateFailure(error)).toEqual({
      fieldErrors: { name: 'Ya hay un grupo con ese nombre en este curso. Elige otro.' },
    })
  })

  it('los errores de validación del servidor van junto a su campo, el primero de cada uno', () => {
    const error = new ApiError('x', {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        errors: [
          { field: 'courseId', message: 'Elige un curso del catálogo.' },
          { field: 'name', message: 'Primero' },
          { field: 'name', message: 'Segundo' },
        ],
      },
    })
    expect(describeCreateFailure(error)).toEqual({
      fieldErrors: { courseId: 'Elige un curso del catálogo.', name: 'Primero' },
    })
  })

  it('la sesión vencida, el tiempo agotado y lo demás son avisos generales', () => {
    expect(describeCreateFailure(new ApiError('x', { status: 401 })).general).toMatch(/Tu sesión terminó/)
    expect(describeCreateFailure(new ApiError('x', { timedOut: true })).general).toMatch(/Revisa la lista/)
    expect(describeCreateFailure(new ApiError('x', { status: 500 })).general).toBe('No se pudo crear el grupo. Intenta de nuevo.')
  })
})
