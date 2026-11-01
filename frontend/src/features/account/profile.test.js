import { describe, expect, it } from 'vitest'

import { initialOf, USER_TYPES, userTypeLabel } from './profile.js'

describe('datos del perfil', () => {
  it('el tipo de usuario es «Estudiante» o «Docente»', () => {
    expect(USER_TYPES.map((type) => type.label)).toEqual(['Estudiante', 'Docente'])
    expect(userTypeLabel('STUDENT')).toBe('Estudiante')
    expect(userTypeLabel('TEACHER')).toBe('Docente')
    expect(userTypeLabel(null)).toBeNull()
  })

  it('la inicial del nombre, en mayúscula y sin partir un carácter', () => {
    expect(initialOf('  ángela')).toBe('Á')
    expect(initialOf('𝓐na')).toBe('𝓐')
  })
})
