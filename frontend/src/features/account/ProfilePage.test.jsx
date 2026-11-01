import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchProfile } from './api.js'
import { formatProfileDate } from './profile.js'
import ProfilePage from './ProfilePage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../../session/useLogout.js', () => ({
  useLogout: () => ({ loggingOut: false, logoutFailed: false, handleLogout: vi.fn() }),
}))
vi.mock('./api.js', () => ({ fetchProfile: vi.fn() }))

const ACCOUNT = { id: 5, email: 'lectora@example.com', name: 'Ana Pérez', profileComplete: true }

const PROFILE = {
  name: 'Ana Pérez',
  email: 'lectora@example.com',
  institution: { id: 12, name: 'UNIVERSIDAD DE ANTIOQUIA', other: false },
  userType: 'TEACHER',
  createdAt: '2026-10-02T15:30:00Z',
  dataProcessingAuthorizedAt: '2026-11-01T22:40:00Z',
  teamMember: false,
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="iniciar-sesion" element={<p>Inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// El valor de un dato del perfil, por su etiqueta.
function valueOf(label) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling
}

// Historia HU506: el perfil reúne los datos de la cuenta, solo para su dueño.
describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: ACCOUNT }
    fetchProfile.mockResolvedValue(PROFILE)
  })

  afterEach(() => {
    cleanup()
  })

  it('muestra todos los datos de la cuenta, con las fechas de creación y de autorización', async () => {
    renderProfile()

    await screen.findByText('UNIVERSIDAD DE ANTIOQUIA')
    expect(valueOf('Nombre')).toHaveTextContent('Ana Pérez')
    expect(valueOf('Correo')).toHaveTextContent('lectora@example.com')
    expect(valueOf('Institución')).toHaveTextContent('UNIVERSIDAD DE ANTIOQUIA')
    expect(valueOf('Tipo de usuario')).toHaveTextContent('Docente')
    expect(within(valueOf('Cuenta creada')).getByText(formatProfileDate(PROFILE.createdAt))).toHaveAttribute(
      'datetime',
      PROFILE.createdAt,
    )
    expect(valueOf('Autorizaste la política de datos')).toHaveTextContent(
      formatProfileDate(PROFILE.dataProcessingAuthorizedAt),
    )
    expect(screen.getByRole('link', { name: 'Ver la política de tratamiento de datos' })).toHaveAttribute(
      'href',
      '/politica-de-datos',
    )
    expect(screen.queryByText('Rol', { selector: 'dt' })).not.toBeInTheDocument()
  })

  it('un dato que la cuenta no tiene dice «No disponible»', async () => {
    fetchProfile.mockResolvedValue({
      ...PROFILE,
      name: null,
      institution: null,
      userType: null,
      dataProcessingAuthorizedAt: null,
    })
    renderProfile()

    await screen.findByText('lectora@example.com')
    for (const label of ['Nombre', 'Institución', 'Tipo de usuario', 'Autorizaste la política de datos']) {
      expect(valueOf(label)).toHaveTextContent(/^No disponible/)
    }
    expect(valueOf('Cuenta creada')).not.toHaveTextContent('No disponible')
  })

  it('una cuenta del equipo lo ve en su perfil', async () => {
    fetchProfile.mockResolvedValue({ ...PROFILE, teamMember: true })
    renderProfile()

    expect(await screen.findByText(/Cuenta del equipo de NodoAula/)).toBeInTheDocument()
  })

  it('sin sesión lleva a iniciarla y no pide el perfil', () => {
    session = { status: 'ready', account: null }
    renderProfile()

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument()
    expect(fetchProfile).not.toHaveBeenCalled()
  })

  it('si no se pudo cargar, lo dice', async () => {
    fetchProfile.mockRejectedValue({ status: 500 })
    renderProfile()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar tu perfil')
  })

  it('desde el perfil se puede cerrar la sesión', async () => {
    renderProfile()

    expect(await screen.findByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })
})
