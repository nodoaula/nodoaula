import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import RequireCompleteProfile from './RequireCompleteProfile.jsx'

let session = { status: 'ready', account: null }
vi.mock('./useSession.js', () => ({ useSession: () => session }))

function CompleteProfile() {
  const { state } = useLocation()
  return <p>Completar perfil, y luego a {state?.from}</p>
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<RequireCompleteProfile />}>
          <Route path="completar-perfil" element={<CompleteProfile />} />
          <Route path="politica-de-datos" element={<p>Política</p>} />
          <Route path="catalogo" element={<p>Catálogo</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

// Historia HU506: las cuentas anteriores completan el perfil al volver a entrar.
describe('RequireCompleteProfile', () => {
  afterEach(() => {
    cleanup()
    session = { status: 'ready', account: null }
  })

  it('una cuenta sin perfil va a completarlo, recordando a dónde iba', () => {
    session = { status: 'ready', account: { id: 1, email: 'a@ejemplo.com', name: null, profileComplete: false } }
    renderAt('/catalogo?curso=7')

    expect(screen.getByText('Completar perfil, y luego a /catalogo?curso=7')).toBeInTheDocument()
  })

  it('una cuenta sin perfil puede leer la política antes de autorizarla', () => {
    session = { status: 'ready', account: { id: 1, email: 'a@ejemplo.com', name: null, profileComplete: false } }
    renderAt('/politica-de-datos')

    expect(screen.getByText('Política')).toBeInTheDocument()
  })

  it('con el perfil completo, o sin sesión, deja pasar', () => {
    session = { status: 'ready', account: { id: 1, email: 'a@ejemplo.com', name: 'Ana', profileComplete: true } }
    renderAt('/catalogo')
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
    cleanup()

    session = { status: 'ready', account: null }
    renderAt('/catalogo')
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
  })
})
