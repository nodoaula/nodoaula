import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { requestDocumentLink } from './api.js'
import DocumentViewer from './DocumentViewer.jsx'

// jsdom no tiene workers ni puede ejecutar PDF.js: se sustituyen el worker y
// react-pdf. El falso Document entrega un PDF de tres páginas A4.
vi.hoisted(() => {
  globalThis.Worker = class {}
})

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: function Document({ file, suspense, onLoadSuccess, children }) {
    // Con Suspense, react-pdf ignoraría onLoadError y escondería el visor.
    if (suspense !== false) throw new Error('El visor debe usar react-pdf sin Suspense')
    const pdf = {
      numPages: 3,
      getPage: () => Promise.resolve({ getViewport: () => ({ width: 595, height: 842 }) }),
    }
    if (file && !Document.loaded) {
      Document.loaded = true
      queueMicrotask(() => onLoadSuccess(pdf))
    }
    return <div data-testid="documento">{children}</div>
  },
  Page: ({ pageNumber }) => <p>Página dibujada {pageNumber}</p>,
}))

vi.mock('./api.js', () => ({ requestDocumentLink: vi.fn() }))

const PDF = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
const SIGNED_URL = 'https://proyecto.supabase.co/storage/v1/object/sign/notes/apunte.pdf?token=firma'

function renderViewer() {
  return render(
    <MemoryRouter initialEntries={['/recursos/36']}>
      <DocumentViewer resourceId={36} title="Integración por partes" />
    </MemoryRouter>,
  )
}

describe('DocumentViewer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { Document } = await import('react-pdf')
    Document.loaded = false
    // Todas las páginas están a la vista. Como el navegador, entrega juntas las
    // entradas de lo que se empezó a observar a la vez.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          this.callback = callback
          this.pending = []
        }
        observe(target) {
          this.pending.push({ target, isIntersecting: true })
          if (this.pending.length === 1) {
            queueMicrotask(() => {
              const entries = this.pending
              this.pending = []
              this.callback(entries)
            })
          }
        }
        disconnect() {}
      },
    )
    // El visor mide el ancho disponible antes de pintar las páginas.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback) {
          this.callback = callback
        }
        observe() {
          this.callback([{ contentRect: { width: 640 } }])
        }
        disconnect() {}
      },
    )
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(PDF, { status: 200 }))))
    URL.createObjectURL = vi.fn(() => 'blob:apunte')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('pide el enlace, descarga el archivo una sola vez y muestra sus páginas', async () => {
    requestDocumentLink.mockResolvedValue({ url: SIGNED_URL })
    renderViewer()

    expect(await screen.findByText('Página dibujada 3')).toBeInTheDocument()
    expect(requestDocumentLink).toHaveBeenCalledWith(36)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe(SIGNED_URL)
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  })

  it('no dibuja las páginas lejanas de la pantalla', async () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          this.callback = callback
        }
        observe(target) {
          this.callback([{ target, isIntersecting: target.dataset.page === '1' }])
        }
        disconnect() {}
      },
    )
    requestDocumentLink.mockResolvedValue({ url: SIGNED_URL })
    renderViewer()

    expect(await screen.findByText('Página dibujada 1')).toBeInTheDocument()
    expect(screen.queryByText('Página dibujada 2')).not.toBeInTheDocument()
    expect(screen.queryByText('Página dibujada 3')).not.toBeInTheDocument()
  })

  it('descarga la misma copia con el título como nombre', async () => {
    requestDocumentLink.mockResolvedValue({ url: SIGNED_URL })
    renderViewer()

    const download = await screen.findByRole('link', { name: 'Descargar' })
    expect(download).toHaveAttribute('href', 'blob:apunte')
    expect(download).toHaveAttribute('download', 'Integración por partes.pdf')
  })

  it('amplía de 100 a 150 % y no más', async () => {
    requestDocumentLink.mockResolvedValue({ url: SIGNED_URL })
    renderViewer()

    const zoomIn = await screen.findByRole('button', { name: 'Ampliar' })
    expect(screen.getByRole('button', { name: 'Reducir' })).toBeDisabled()
    fireEvent.click(zoomIn)
    expect(screen.getByText('125 %')).toBeInTheDocument()
    fireEvent.click(zoomIn)
    expect(screen.getByText('150 %')).toBeInTheDocument()
    expect(zoomIn).toBeDisabled()
  })

  it('con la transferencia agotada avisa que los apuntes no están disponibles por ahora', async () => {
    requestDocumentLink.mockRejectedValue(
      new ApiError('Servicio no disponible', { status: 503, body: { code: 'DOCUMENT_TRANSFER_EXHAUSTED' } }),
    )
    renderViewer()

    expect(await screen.findByText('Los apuntes no están disponibles por ahora')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('si la sesión venció invita a iniciarla y a volver a esta ficha', async () => {
    requestDocumentLink.mockRejectedValue(new ApiError('Sin sesión', { status: 401, body: { code: 'AUTHENTICATION_REQUIRED' } }))
    renderViewer()

    expect(await screen.findByText('Inicia sesión para leer este apunte')).toBeInTheDocument()
  })

  it('si falla la descarga del archivo lo dice', async () => {
    requestDocumentLink.mockResolvedValue({ url: SIGNED_URL })
    fetch.mockResolvedValue(new Response('', { status: 400 }))
    renderViewer()

    expect(await screen.findByText('No se pudo cargar el apunte')).toBeInTheDocument()
  })
})
