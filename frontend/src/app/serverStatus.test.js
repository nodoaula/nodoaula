import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { get, loadCsrfToken } from '../lib/apiClient.js'
import { SERVER_STATUS, useServerStatus } from './serverStatus.js'

vi.mock('../lib/apiClient.js', () => ({ get: vi.fn(), loadCsrfToken: vi.fn() }))

describe('useServerStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadCsrfToken.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // El arranque en frío medido en producción pasa de tres minutos (3:07 el
  // 8 de noviembre de 2026): rendirse a los tres daba un error falso.
  it('espera al servidor hasta cinco minutos y, al responder, pide el token CSRF', async () => {
    get.mockResolvedValue({ status: 'UP' })
    const { result } = renderHook(() => useServerStatus())

    expect(result.current[0]).toBe(SERVER_STATUS.STARTING)
    await waitFor(() => expect(result.current[0]).toBe(SERVER_STATUS.READY))
    expect(get).toHaveBeenCalledWith('/health', { totalTimeoutMs: 300_000 })
    expect(loadCsrfToken).toHaveBeenCalledTimes(1)
  })

  it('si no responde queda inalcanzable, y volver a intentarlo pregunta otra vez', async () => {
    get.mockRejectedValueOnce(new Error('sin respuesta')).mockResolvedValueOnce({ status: 'UP' })
    const { result } = renderHook(() => useServerStatus())
    await waitFor(() => expect(result.current[0]).toBe(SERVER_STATUS.UNREACHABLE))

    act(() => result.current[1]())

    expect(result.current[0]).toBe(SERVER_STATUS.STARTING)
    await waitFor(() => expect(result.current[0]).toBe(SERVER_STATUS.READY))
    expect(get).toHaveBeenCalledTimes(2)
  })
})
