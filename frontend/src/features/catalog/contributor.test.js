import { describe, expect, it } from 'vitest'

import { COMMUNITY_MEMBER_LABEL, describeContributor, TEAM_LABEL } from './contributor.js'

describe('quién aportó un recurso (HU507)', () => {
  it('un miembro de la comunidad con perfil: su nombre, su tipo de usuario y su institución', () => {
    expect(
      describeContributor({ origin: 'COMMUNITY', name: 'Ana Pérez', userType: 'STUDENT', institution: 'Universidad X' }),
    ).toEqual({ team: false, name: 'Ana Pérez', details: ['Estudiante', 'Universidad X'], origin: 'Comunidad' })
  })

  it('sin institución, que es «Otra», solo el nombre y el tipo', () => {
    expect(
      describeContributor({ origin: 'COMMUNITY', name: 'Luis Gómez', userType: 'TEACHER', institution: null }).details,
    ).toEqual(['Docente'])
  })

  it('sin nombre, el equipo es «Equipo de NodoAula» y la comunidad, «Miembro de la comunidad»', () => {
    const none = { name: null, userType: null, institution: null }

    expect(describeContributor({ ...none, origin: 'TEAM' })).toEqual({
      team: true,
      name: TEAM_LABEL,
      details: [],
      origin: null,
    })
    expect(describeContributor({ ...none, origin: 'COMMUNITY' })).toEqual({
      team: false,
      name: COMMUNITY_MEMBER_LABEL,
      details: [],
      origin: null,
    })
  })

  it('una cuenta del equipo con perfil lleva su nombre y dice que es del equipo', () => {
    expect(
      describeContributor({ origin: 'TEAM', name: 'Marta Ruiz', userType: 'STUDENT', institution: null }),
    ).toEqual({ team: true, name: 'Marta Ruiz', details: ['Estudiante'], origin: TEAM_LABEL })
  })
})
