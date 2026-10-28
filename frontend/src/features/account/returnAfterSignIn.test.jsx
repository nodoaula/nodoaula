import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerAccount } from './api.js'
import LoginPage from './LoginPage.jsx'
import RegisterPage from './RegisterPage.jsx'

// Historia HU411: quien llega desde la invitación de un apunte vuelve a su
// ficha al iniciar sesión, también si antes crea la cuenta. La entrada
// directa al crear la cuenta se prueba en RegisterPage.test.jsx, con la sesión
// real; aquí, el camino de respaldo cuando esa entrada falla.

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('./api.js', () => ({ registerAccount: vi.fn() }))

const ACCOUNT = { id: 5, email: 'lectora@example.com' }

function renderAt(pathname, state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname, state }]}>
      <Routes>
        <Route path="iniciar-sesion" element={<LoginPage />} />
        <Route path="registro" element={<RegisterPage />} />
        <Route path="catalogo" element={<p>Catálogo</p>} />
        <Route path="recursos/:resourceId" element={<p>Ficha del apunte</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// La sesión se inicia fuera de estas pantallas; al volver a pintarse, la
// pantalla ve la cuenta y se va.
function signInAndRerender(field) {
  session = { status: 'ready', account: ACCOUNT }
  fireEvent.change(field, { target: { value: 'otro@example.com' } })
}

describe('volver a la página de origen tras iniciar sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: null }
  })

  afterEach(() => {
    cleanup()
  })

  it('al iniciar sesión vuelve a la ficha de la que venía', () => {
    session = { status: 'ready', account: ACCOUNT }
    renderAt('/iniciar-sesion', { from: '/recursos/24' })

    expect(screen.getByText('Ficha del apunte')).toBeInTheDocument()
  })

  it('sin página de origen lleva al catálogo, como antes', () => {
    session = { status: 'ready', account: ACCOUNT }
    renderAt('/iniciar-sesion')

    expect(screen.getByText('Catálogo')).toBeInTheDocument()
  })

  it('pasar del inicio de sesión a crear una cuenta conserva la ficha de origen', () => {
    renderAt('/iniciar-sesion', { from: '/recursos/24' })

    fireEvent.click(screen.getByRole('link', { name: 'Crea una' }))
    signInAndRerender(screen.getByLabelText('Correo'))

    expect(screen.getByText('Ficha del apunte')).toBeInTheDocument()
  })

  it('si la entrada falla tras crear la cuenta, el inicio de sesión sigue llevando a la ficha', async () => {
    registerAccount.mockResolvedValue({ id: 5, email: 'lectora@example.com' })
    session = { status: 'ready', account: null, login: vi.fn().mockRejectedValue(new Error('Sin conexión')) }
    renderAt('/registro', { from: '/recursos/24' })

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'lectora@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contrasena-larga' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await screen.findByText('Tu cuenta se creó. Inicia sesión con tu correo y tu contraseña.')
    signInAndRerender(screen.getByLabelText('Correo'))

    expect(screen.getByText('Ficha del apunte')).toBeInTheDocument()
  })
})
