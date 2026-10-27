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

  describe('con progreso de subida', () => {
    // Lo mínimo de XMLHttpRequest que usa el cliente, con métodos para que la
    // prueba haga de red: informar del envío, responder o fallar.
    class FakeXhr {
      static sent = []
      upload = {}
      headers = {}
      constructor() {
        FakeXhr.sent.push(this)
      }
      open(method, url) {
        this.method = method
        this.url = url
      }
      setRequestHeader(name, value) {
        this.headers[name] = value
      }
      send(body) {
        this.body = body
      }
      abort() {
        this.aborted = true
        this.onabort()
      }
      getAllResponseHeaders() {
        return 'content-type: application/problem+json\r\ncache-control: no-store\r\n'
      }
      progress(loaded, total) {
        this.upload.onprogress({ loaded, total })
      }
      respond(status, body) {
        this.status = status
        this.statusText = ''
        this.responseText = body === undefined ? '' : JSON.stringify(body)
        this.onload()
      }
    }

    beforeEach(() => {
      FakeXhr.sent = []
      vi.stubGlobal('XMLHttpRequest', FakeXhr)
    })

    async function upload(options) {
      const result = post('/resources/documents', new FormData(), options).catch((failure) => failure)
      await vi.waitFor(() => expect(FakeXhr.sent).toHaveLength(1))
      return { result, xhr: FakeXhr.sent[0] }
    }

    it('envía por XMLHttpRequest con el token CSRF e informa del porcentaje enviado', async () => {
      const onUploadProgress = vi.fn()
      const { result, xhr } = await upload({ onUploadProgress })

      // 0,29 × 100 da 28,999… en coma flotante: el porcentaje se calcula sin pasar por la fracción.
      xhr.progress(29, 100)
      xhr.progress(1024, 1024)
      xhr.respond(201, { id: 40 })

      await expect(result).resolves.toEqual({ id: 40 })
      expect(onUploadProgress.mock.calls).toEqual([[29], [100]])
      expect(xhr.method).toBe('POST')
      expect(xhr.url).toBe('/api/resources/documents')
      expect(xhr.body).toBeInstanceOf(FormData)
      expect(xhr.headers).toEqual({ Accept: 'application/json', 'X-XSRF-TOKEN': CSRF_TOKEN })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('una respuesta sin cuerpo se resuelve en null', async () => {
      const { result, xhr } = await upload({ onUploadProgress: vi.fn() })

      xhr.respond(204)

      await expect(result).resolves.toBeNull()
    })

    it('una respuesta que no puede leerse falla en el acto, sin esperar al plazo', async () => {
      const { result, xhr } = await upload({ onUploadProgress: vi.fn() })

      // Un 205 no admite cuerpo: Response lo rechaza.
      xhr.respond(205, { id: 40 })

      const error = await result
      expect(error).toBeInstanceOf(ApiError)
      expect(error.timedOut).toBe(false)
    })

    it('un error del servidor llega con su código, como en el resto de peticiones', async () => {
      const { result, xhr } = await upload({ onUploadProgress: vi.fn() })

      xhr.respond(409, { code: 'DOCUMENT_ALREADY_UPLOADED' })

      const error = await result
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBe(409)
      expect(error.code).toBe('DOCUMENT_ALREADY_UPLOADED')
      expect(FakeXhr.sent).toHaveLength(1)
    })

    it('un fallo de red se informa sin código y sin reintentar', async () => {
      const { result, xhr } = await upload({ onUploadProgress: vi.fn() })

      xhr.onerror()

      const error = await result
      expect(error).toBeInstanceOf(ApiError)
      expect(error.status).toBeNull()
      expect(error.timedOut).toBe(false)
      expect(FakeXhr.sent).toHaveLength(1)
    })

    it('corta el envío al agotarse el plazo y lo informa como tiempo agotado', async () => {
      vi.useFakeTimers()
      const { result, xhr } = await upload({ onUploadProgress: vi.fn(), attemptTimeoutMs: 1_000, totalTimeoutMs: 1_000 })

      await vi.advanceTimersByTimeAsync(1_000)

      const error = await result
      expect(xhr.aborted).toBe(true)
      expect(error.timedOut).toBe(true)
    })
  })
})
