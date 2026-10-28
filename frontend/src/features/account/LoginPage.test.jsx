import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SessionProvider from '../../session/SessionProvider.jsx'
import { fetchCurrentAccount, login } from '../../session/api.js'
import LoginPage from './LoginPage.jsx'

vi.mock('../../session/api.js', () => ({ fetchCurrentAccount: vi.fn(), login: vi.fn(), logout: vi.fn() }))

function renderLogin(state) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[{ pathname: '/iniciar-sesion', state }]}>
        <Routes>
          <Route path="iniciar-sesion" element={<LoginPage />} />
          <Route path="catalogo" element={<p>Catálogo</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe('pantalla de inicio de sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentAccount.mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup()
  })

  it('con credenciales incorrectas lo avisa sin decir cuál falló y borra la contraseña', async () => {
    login.mockRejectedValue({ code: 'INVALID_CREDENTIALS', status: 401 })
    renderLogin()

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'lectora@example.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'equivocada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se inició la sesión')
    expect(alert).toHaveTextContent('El correo o la contraseña no son correctos.')
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByLabelText('Correo')).toHaveValue('lectora@example.com')
  })

  it('un envío con campos vacíos lleva el foco al primero y no llama al servidor', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(screen.getByLabelText('Correo')).toHaveFocus()
    expect(login).not.toHaveBeenCalled()
  })

  it('tras un registro cuya entrada falló, avisa de que la cuenta existe y trae el correo', () => {
    renderLogin({ email: 'lectora@example.com', justRegistered: true })

    expect(screen.getByText('Tu cuenta se creó')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveValue('lectora@example.com')
  })
})
