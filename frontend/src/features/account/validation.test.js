import { describe, expect, it } from 'vitest'

import { validateName, validateProfile, validateProfileCompletion, validateRegistration } from './validation.js'

const PROFILE = { name: 'Ana Pérez', institutionId: 12, userType: 'STUDENT' }

// Historia HU506: las mismas reglas del perfil que aplica el backend.
describe('validación del perfil', () => {
  it('el nombre es obligatorio y se mide sin los espacios de sobra', () => {
    expect(validateName('   ')).toBe('Escribe tu nombre.')
    expect(validateName(`  ${'a'.repeat(100)}  `)).toBeNull()
    expect(validateName('a'.repeat(101))).toBe('El nombre no puede tener más de 100 caracteres.')
  })

  it('la institución y el tipo de usuario son obligatorios', () => {
    expect(validateProfile(PROFILE)).toEqual({})
    expect(validateProfile({ name: '', institutionId: null, userType: null })).toEqual({
      name: 'Escribe tu nombre.',
      institutionId: 'Elige tu institución de la lista.',
      userType: 'Elige si eres estudiante o docente.',
    })
  })

  it('el registro exige el perfil además del correo, la contraseña y la autorización', () => {
    const valid = { ...PROFILE, email: 'a@ejemplo.com', password: 'contrasena-larga', dataProcessingAuthorized: true }
    expect(validateRegistration(valid)).toEqual({})
    expect(Object.keys(validateRegistration({ ...valid, name: '', institutionId: null, userType: null }))).toEqual([
      'name',
      'institutionId',
      'userType',
    ])
  })

  it('completar el perfil vuelve a pedir la autorización, sobre la política vigente', () => {
    expect(validateProfileCompletion({ ...PROFILE, dataProcessingAuthorized: true })).toEqual({})
    expect(validateProfileCompletion({ ...PROFILE, dataProcessingAuthorized: false }).dataProcessingAuthorized).toMatch(
      /según la política vigente/,
    )
  })
})
