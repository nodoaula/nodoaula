import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import ContributorCard from './ContributorCard.jsx'

const NO_PROFILE = { name: null, userType: null, institution: null }

function renderCard(contributor, contributedOn = null) {
  render(<ContributorCard contributor={contributor} contributedOn={contributedOn} />)
  return screen.getByRole('region', { name: 'Quién lo aportó' })
}

describe('ContributorCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('muestra el nombre, el tipo de usuario, la institución y el día del aporte', () => {
    const card = renderCard(
      { origin: 'COMMUNITY', name: 'Ana Pérez', userType: 'STUDENT', institution: 'Universidad de Antioquia' },
      '2026-10-06',
    )

    expect(card).toHaveTextContent('Ana Pérez')
    expect(card).toHaveTextContent('Comunidad')
    expect(card).toHaveTextContent('Estudiante · Universidad de Antioquia')
    expect(screen.getByText('6 de octubre de 2026')).toHaveAttribute('dateTime', '2026-10-06')
  })

  it('con la institución «Otra», que no llega, muestra solo el nombre y el tipo', () => {
    const card = renderCard({ origin: 'COMMUNITY', name: 'Luis Gómez', userType: 'TEACHER', institution: null })

    expect(screen.getByText('Docente')).toBeInTheDocument()
    expect(card).not.toHaveTextContent('·')
    expect(card).not.toHaveTextContent('Otra')
  })

  it('sin fecha de aporte, como un video anterior a la historia, no muestra ninguna', () => {
    const card = renderCard({ origin: 'TEAM', ...NO_PROFILE })

    expect(card).not.toHaveTextContent('Aportado el')
    expect(card.querySelector('time')).toBeNull()
  })

  it('lo del equipo sin cuenta de autor dice «Equipo de NodoAula» y no lleva datos de una persona', () => {
    const card = renderCard({ origin: 'TEAM', ...NO_PROFILE }, '2026-11-01')

    expect(card).toHaveTextContent('Equipo de NodoAula')
    expect(card).not.toHaveTextContent('Estudiante')
    expect(card).not.toHaveTextContent('Comunidad')
  })

  it('una cuenta sin el perfil completo dice «Miembro de la comunidad»', () => {
    const card = renderCard({ origin: 'COMMUNITY', ...NO_PROFILE })

    expect(card).toHaveTextContent('Miembro de la comunidad')
    expect(card).not.toHaveTextContent('Equipo de NodoAula')
  })

  // CA 3: lo del equipo y lo de la comunidad no se ven igual.
  it('distingue a la vista lo aportado por el equipo de lo aportado por la comunidad', () => {
    const team = renderCard({ origin: 'TEAM', name: 'Marta Ruiz', userType: 'STUDENT', institution: null })
    const teamClasses = team.className
    expect(screen.getByText('Equipo de NodoAula')).toHaveClass('text-accent')
    cleanup()

    const community = renderCard({ origin: 'COMMUNITY', name: 'Marta Ruiz', userType: 'STUDENT', institution: null })
    expect(screen.getByText('Comunidad')).not.toHaveClass('text-accent')
    expect(community.className).not.toBe(teamClasses)
  })

  it('nunca muestra un correo ni enlaza al perfil de la cuenta', () => {
    const card = renderCard({ origin: 'COMMUNITY', name: 'Ana Pérez', userType: 'STUDENT', institution: null })

    expect(card).not.toHaveTextContent('@')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
