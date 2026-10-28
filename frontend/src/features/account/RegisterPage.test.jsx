import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SessionProvider from '../../session/SessionProvider.jsx'
import { fetchCurrentAccount, login } from '../../session/api.js'
import { registerAccount } from './api.js'
import RegisterPage from './RegisterPage.jsx'

// Con la sesión real: así se prueba que la cuenta iniciada al registrarse es
// la que ve el resto de la aplicación, no una simulada.
vi.mock('../../session/api.js', () => ({ fetchCurrentAccount: vi.fn(), login: vi.fn(), logout: vi.fn() }))
vi.mock('./api.js', () => ({ registerAccount: vi.fn() }))

const ACCOUNT = { id: 5, email: 'lectora@example.com' }

function renderRegister(state) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[{ pathname: '/registro', state }]}>
        <Routes>
          <Route path="registro" element={<RegisterPage />} />
          <Route path="iniciar-sesion" element={<p>Inicio de sesión</p>} />
          <Route path="catalogo" element={<p>Catálogo</p>} />
          <Route path="recursos/:resourceId" element={<p>Ficha del apunte</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  )
}

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('pantalla de registro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentAccount.mockResolvedValue(null)
    registerAccount.mockResolvedValue(ACCOUNT)
    login.mockResolvedValue(ACCOUNT)
  })

  afterEach(() => {
    cleanup()
  })

  it('al crear la cuenta entra con la sesión iniciada y vuelve a la página de origen', async () => {
    renderRegister({ from: '/recursos/24' })

    fillAndSubmit(' lectora@example.com ', 'contrasena-larga')

    expect(await screen.findByText('Ficha del apunte')).toBeInTheDocument()
    expect(login).toHaveBeenCalledWith({ email: 'lectora@example.com', password: 'contrasena-larga' })
  })

  it('sin página de origen, al crear la cuenta lleva al catálogo', async () => {
    renderRegister()

    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })

  it('si no se crea la cuenta no intenta iniciar sesión y lo explica', async () => {
    registerAccount.mockRejectedValue({ status: null, timedOut: true })
    renderRegister()

    fillAndSubmit('lectora@example.com', 'contrasena-larga')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se completó el registro')
    expect(alert).toHaveTextContent('no sabemos si la cuenta se creó')
    expect(login).not.toHaveBeenCalled()
  })

  it('al reenviar, el aviso de correo en uso de la respuesta anterior desaparece', async () => {
    registerAccount.mockRejectedValueOnce({ code: 'EMAIL_ALREADY_IN_USE', status: 409 })
    renderRegister()

    fillAndSubmit('lectora@example.com', 'contrasena-larga')
    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'otra-contrasena' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.queryByText('Ya existe una cuenta con este correo.')).not.toBeInTheDocument()
    expect(await screen.findByText('Catálogo')).toBeInTheDocument()
  })

  it('un envío con errores lleva el foco al primer campo con error', () => {
    renderRegister()

    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByLabelText('Correo')).toHaveFocus()

    fillAndSubmit('lectora@example.com', 'corta')
    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
    expect(registerAccount).not.toHaveBeenCalled()
  })

  it('«Mostrar» enseña la contraseña y «Ocultar» la vuelve a tapar', () => {
    renderRegister()
    const field = screen.getByLabelText('Contraseña')

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(field).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(field).toHaveAttribute('type', 'password')
  })
})
