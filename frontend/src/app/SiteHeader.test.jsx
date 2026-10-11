import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SiteHeader from './SiteHeader.jsx'

vi.mock('../session/useSession.js', () => ({
  useSession: () => ({ status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }),
}))
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

describe('SiteHeader', () => {
  afterEach(cleanup)

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
