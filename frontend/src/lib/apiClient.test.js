import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, get, post, postForm } from './apiClient.js'

const CSRF_TOKEN = 'token-de-prueba'

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('apiClient', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = `XSRF-TOKEN=${CSRF_TOKEN}`
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function sentRequest(call = 0) {
    const [url, init] = fetchMock.mock.calls[call]
    return { url, init }
  }

  it('envía un FormData tal cual, sin Content-Type, para que el navegador ponga el límite del multipart', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }))
    const form = new FormData()
    form.append('title', 'Apunte')

    await expect(post('/resources/documents', form)).resolves.toEqual({ id: 1 })

    const { url, init } = sentRequest()
    expect(url).toBe('/api/resources/documents')
    expect(init.body).toBe(form)
    expect(init.headers).not.toHaveProperty('Content-Type')
    expect(init.headers['X-XSRF-TOKEN']).toBe(CSRF_TOKEN)
  })

  it('envía un objeto como JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }))

    await post('/resources', { title: 'Video' })

    const { init } = sentRequest()
    expect(init.body).toBe('{"title":"Video"}')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('envía los campos de postForm como formulario, sin Content-Type propio', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await postForm('/session', { email: 'a@b.co', password: 'secreta' })

    const { init } = sentRequest()
    expect(init.body).toBeInstanceOf(URLSearchParams)
    expect(init.headers).not.toHaveProperty('Content-Type')
  })

  it('reintenta un GET mientras el servidor responde 503', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(200, ['recurso']))

    const result = get('/resources')
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(result).resolves.toEqual(['recurso'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('no reintenta un POST: un error del servidor llega con su código', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { code: 'STORAGE_UNAVAILABLE' }))

    const error = await post('/resources/documents', new FormData()).catch((failure) => failure)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(503)
    expect(error.code).toBe('STORAGE_UNAVAILABLE')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('un fallo de red en un POST se informa sin reintentar', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await post('/resources', { title: 'Video' }).catch((failure) => failure)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBeNull()
    expect(error.timedOut).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
