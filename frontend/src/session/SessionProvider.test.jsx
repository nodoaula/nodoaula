import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchCurrentAccount, login, logout } from './api.js'
import { SESSION_STATUS } from './SessionContext.js'
import SessionProvider from './SessionProvider.jsx'
import { useSession } from './useSession.js'

vi.mock('./api.js', () => ({ fetchCurrentAccount: vi.fn(), login: vi.fn(), logout: vi.fn() }))

const ACCOUNT = { id: 5, email: 'lectora@example.com' }

function Probe() {
  const { status, account, login: signIn, logout: signOut } = useSession()
  return (
    <>
      <p>{account ? `Con sesión: ${account.email}` : 'Sin sesión'}</p>
      <p>Estado: {status}</p>
      <button type="button" onClick={() => signOut()}>
        Salir
      </button>
      <button type="button" onClick={() => signIn({ email: ACCOUNT.email, password: 'x' })}>
        Entrar
      </button>
    </>
  )
}

describe('SessionProvider', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('una consulta inicial que responde después de iniciar sesión no la borra', async () => {
    let answerInitialCheck
    fetchCurrentAccount.mockReturnValue(new Promise((resolve) => (answerInitialCheck = resolve)))
    login.mockResolvedValue(ACCOUNT)
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )

    await act(async () => screen.getByRole('button', { name: 'Entrar' }).click())
    expect(screen.getByText(`Estado: ${SESSION_STATUS.READY}`)).toBeInTheDocument()
    await act(async () => answerInitialCheck(null))

    expect(screen.getByText('Con sesión: lectora@example.com')).toBeInTheDocument()
  })

  it('una consulta inicial que responde después de cerrar sesión no la recupera', async () => {
    let answerInitialCheck
    fetchCurrentAccount.mockReturnValue(new Promise((resolve) => (answerInitialCheck = resolve)))
    logout.mockResolvedValue(undefined)
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    )

    await act(async () => screen.getByRole('button', { name: 'Salir' }).click())
    expect(screen.getByText(`Estado: ${SESSION_STATUS.READY}`)).toBeInTheDocument()
    await act(async () => answerInitialCheck(ACCOUNT))

    expect(screen.getByText('Sin sesión')).toBeInTheDocument()
  })
})
