import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SiteHeader from './SiteHeader.jsx'

let session = { status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }
vi.mock('../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../session/useLogout.js', () => ({
  useLogout: () => ({ loggingOut: false, logoutFailed: false, handleLogout: vi.fn() }),
}))

function renderHeader() {
  return render(
    <MemoryRouter>
      <SiteHeader />
      <p>Fuera del menú</p>
    </MemoryRouter>,
  )
}

// Las pantallas de la cuenta muestran a dónde volverán después.
function AccountPage() {
  const { state } = useLocation()
  return <p>Volverá a {state?.from}</p>
}

function renderSignedOutHeaderAt(entry) {
  session = { status: 'ready', account: null }
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SiteHeader />
      <Routes>
        <Route path="iniciar-sesion" element={<AccountPage />} />
        <Route path="registro" element={<AccountPage />} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SiteHeader', () => {
  afterEach(() => {
    cleanup()
    session = { status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }
  })

  // Historia HU412: quien se convence leyendo la vista previa no pierde el apunte.
  it('sin sesión, iniciar sesión y crear cuenta vuelven a la página donde se estaba', async () => {
    const user = userEvent.setup()
    renderSignedOutHeaderAt('/catalogo/cursos/7?topic=Integral')

    await user.click(screen.getByRole('link', { name: 'Crear cuenta' }))

    expect(screen.getByText('Volverá a /catalogo/cursos/7?topic=Integral')).toBeInTheDocument()
  })

  it('desde una pantalla de la cuenta conserva a dónde se volvía', async () => {
    const user = userEvent.setup()
    renderSignedOutHeaderAt({ pathname: '/registro', state: { from: '/recursos/6' } })

    await user.click(screen.getByRole('link', { name: 'Iniciar sesión' }))

    expect(screen.getByText('Volverá a /recursos/6')).toBeInTheDocument()
  })

  it('en una pantalla de la cuenta no ofrece ir a ella misma', () => {
    renderSignedOutHeaderAt('/registro')
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument()
    cleanup()

    renderSignedOutHeaderAt('/iniciar-sesion')
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument()
  })

  it('«Aportar» abre las dos formas de aportar', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'Aportar' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Agregar un video/ })).toHaveAttribute('href', '/registrar-recurso')
    expect(screen.getByRole('link', { name: /Subir un apunte/ })).toHaveAttribute('href', '/subir-apunte')
  })

  it('Escape lo cierra y devuelve el foco al botón', async () => {
    const user = userEvent.setup()
    renderHeader()
    const button = screen.getByRole('button', { name: 'Aportar' })

    await user.click(button)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('link', { name: /Subir un apunte/ })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('un clic fuera lo cierra', async () => {
    const user = userEvent.setup()
    renderHeader()

    await user.click(screen.getByRole('button', { name: 'Aportar' }))
    await user.click(screen.getByText('Fuera del menú'))

    expect(screen.getByRole('button', { name: 'Aportar' })).toHaveAttribute('aria-expanded', 'false')
  })
})
