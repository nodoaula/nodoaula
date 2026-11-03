import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RequireCompleteProfile from '../../session/RequireCompleteProfile.jsx'
import SessionProvider from '../../session/SessionProvider.jsx'
import { fetchCurrentAccount } from '../../session/api.js'
import { completeProfile, fetchInstitutions } from './api.js'
import CompleteProfilePage from './CompleteProfilePage.jsx'

// Historia HU506: una cuenta anterior al perfil lo completa al volver a
// iniciar sesión, y da en el mismo paso la nueva autorización. Con la sesión
// real, para probar que la cuenta completada es la que ve el resto.
vi.mock('../../session/api.js', () => ({ fetchCurrentAccount: vi.fn(), login: vi.fn(), logout: vi.fn() }))
vi.mock('./api.js', () => ({ completeProfile: vi.fn(), fetchInstitutions: vi.fn() }))

const INCOMPLETE = { id: 5, email: 'lectora@example.com', name: null, profileComplete: false }
const COMPLETE = { ...INCOMPLETE, name: 'Ana Pérez', profileComplete: true }

const INSTITUTIONS = [
  { id: 12, name: 'UNIVERSIDAD DE ANTIOQUIA', other: false },
  { id: 99, name: 'Otra', other: true },
]

const AUTHORIZATION = /Tengo 18 años o más y autorizo el tratamiento de mis datos personales/

function renderAt(pathname) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route element={<RequireCompleteProfile />}>
            <Route path="completar-perfil" element={<CompleteProfilePage />} />
            <Route path="recursos/:resourceId" element={<p>Ficha del apunte</p>} />
            <Route path="catalogo" element={<p>Catálogo</p>} />
            <Route path="iniciar-sesion" element={<p>Inicio de sesión</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

async function fillProfile({ authorize = true } = {}) {
  fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: '  Ana  Pérez ' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Institución' }), { target: { value: 'antioquia' } })
  fireEvent.mouseDown(await screen.findByRole('option', { name: 'UNIVERSIDAD DE ANTIOQUIA' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Docente' }))
  if (authorize) fireEvent.click(screen.getByRole('checkbox', { name: AUTHORIZATION }))
}

describe('completar el perfil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentAccount.mockResolvedValue(INCOMPLETE)
    fetchInstitutions.mockResolvedValue(INSTITUTIONS)
    completeProfile.mockResolvedValue(COMPLETE)
  })

  afterEach(() => {
    cleanup()
  })

  it('una cuenta sin perfil que entra a una página va primero a completarlo y luego vuelve a ella', async () => {
    renderAt('/recursos/24')

    expect(await screen.findByRole('heading', { name: 'Completa tu perfil' })).toBeInTheDocument()
    expect(screen.queryByText('Ficha del apunte')).not.toBeInTheDocument()

    await fillProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('Ficha del apunte')).toBeInTheDocument()
    expect(completeProfile).toHaveBeenCalledWith({
      name: 'Ana Pérez',
      institutionId: 12,
      userType: 'TEACHER',
      dataProcessingAuthorized: true,
    })
  })

  it('sin la nueva autorización no guarda el perfil y lleva el foco a la casilla', async () => {
    renderAt('/completar-perfil')

    await fillProfile({ authorize: false })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    const checkbox = screen.getByRole('checkbox', { name: AUTHORIZATION })
    expect(checkbox).toHaveFocus()
    expect(checkbox).toHaveAccessibleDescription(/según la política vigente/)
    expect(completeProfile).not.toHaveBeenCalled()
  })

  it('explica por qué se pide y enlaza la política, que se abre en otra pestaña', async () => {
    renderAt('/completar-perfil')

    expect(await screen.findByText(/la política de tratamiento de datos cambió/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'política (se abre en otra pestaña)' })).toHaveAttribute(
      'href',
      '/politica-de-datos',
    )
  })

  it('si el backend responde que ya estaba completo, sigue con la cuenta que quedó guardada', async () => {
    completeProfile.mockRejectedValue({ code: 'PROFILE_ALREADY_COMPLETE', status: 409 })
    renderAt('/completar-perfil')

    await fillProfile()
    fetchCurrentAccount.mockResolvedValue(COMPLETE)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })

  it('si no se pudo guardar, lo dice y deja el formulario como estaba', async () => {
    completeProfile.mockRejectedValue({ status: null, timedOut: false })
    renderAt('/completar-perfil')

    await fillProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se guardó tu perfil')
    expect(screen.getByLabelText('Nombre')).toHaveValue('  Ana  Pérez ')
  })

  it('con el perfil ya completo no se queda en este paso', async () => {
    fetchCurrentAccount.mockResolvedValue(COMPLETE)
    renderAt('/completar-perfil')

    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })
})
