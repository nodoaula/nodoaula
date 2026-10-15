import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { getResource, republishResource, retireResource } from './api.js'
import ResourceDetailPage from './ResourceDetailPage.jsx'

vi.mock('./api.js', () => ({ getResource: vi.fn(), retireResource: vi.fn(), republishResource: vi.fn() }))

// El reproductor carga el script de YouTube; aquí basta con que nunca termine.
vi.mock('./youtubeIframeApi.js', () => ({ loadYouTubeIframeApi: () => new Promise(() => {}) }))

const VIDEO = {
  id: 24,
  title: 'Integral definida e indefinida. Fórmulas y métodos de integración',
  description: 'Grabación de un taller de repaso.',
  publishedAt: '2021-02-26',
  durationSeconds: 6011,
  channel: 'Fundación Antivirus para la Deserción',
  url: 'https://www.youtube.com/watch?v=b2sxnAp9Dcg',
  resourceType: 'VIDEO',
  courseId: 7,
  course: 'Cálculo Integral',
  topics: ['Integral Indefinida', 'Métodos de integración'],
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/recursos/24']}>
      <Routes>
        <Route path="recursos/:resourceId" element={<ResourceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResourceDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('enlaza el curso de la ruta al catálogo filtrado por ese curso', async () => {
    getResource.mockResolvedValue(VIDEO)
    renderDetail()

    const courseLink = await screen.findByRole('link', { name: 'Cálculo Integral' })
    expect(courseLink).toHaveAttribute('href', '/catalogo/cursos/7')
    // Curso → tema → recurso, como en el prototipo: el tema es el primero por nombre.
    expect(screen.getByRole('link', { name: 'Integral Indefinida' })).toHaveAttribute(
      'href',
      '/catalogo/cursos/7?topic=Integral+Indefinida',
    )
    expect(screen.queryByRole('link', { name: 'Catálogo' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(VIDEO.title)
    expect(screen.getByText('Video · 1 h 40 min · YouTube')).toBeInTheDocument()
  })

  it('muestra los datos en la pestaña Detalles, sin el identificador del recurso', async () => {
    getResource.mockResolvedValue(VIDEO)
    renderDetail()

    fireEvent.click(await screen.findByRole('tab', { name: 'Detalles' }))

    expect(screen.getByRole('tab', { name: 'Detalles' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Fundación Antivirus para la Deserción', { selector: 'dd' })).toBeVisible()
    expect(screen.queryByText('Identificador')).not.toBeInTheDocument()
  })

  it('cambia de pestaña con las flechas del teclado', async () => {
    getResource.mockResolvedValue(VIDEO)
    renderDetail()

    const videoTab = await screen.findByRole('tab', { name: 'Video' })
    fireEvent.keyDown(videoTab, { key: 'ArrowRight' })

    const detailsTab = screen.getByRole('tab', { name: 'Detalles' })
    expect(detailsTab).toHaveAttribute('aria-selected', 'true')
    expect(detailsTab).toHaveFocus()
  })

  it('avisa cuando el recurso no existe', async () => {
    getResource.mockRejectedValue({ status: 404, code: 'RESOURCE_NOT_FOUND' })
    renderDetail()

    expect(await screen.findByText('Recurso no encontrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/catalogo')
  })

  it('un apunte no muestra el aviso del reproductor, que remite a un botón que no tiene', async () => {
    getResource.mockResolvedValue({ ...VIDEO, url: null, resourceType: 'DOCUMENT', channel: null, durationSeconds: null })
    renderDetail()

    expect(await screen.findByText('Este apunte es un PDF.')).toBeInTheDocument()
    expect(screen.getByText('Pronto podrás leerlo y descargarlo aquí mismo.')).toBeInTheDocument()
    expect(screen.queryByText(/No se puede ver dentro de NodoAula/)).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Apunte' })).toBeInTheDocument()
  })

  // Historia HU311: la ficha ofrece corregir solo a quien puede hacerlo.
  it('ofrece corregir los datos a quien puede hacerlo', async () => {
    getResource.mockResolvedValue({ ...VIDEO, canEdit: true })
    renderDetail()

    expect(await screen.findByRole('link', { name: 'Corregir datos' })).toHaveAttribute('href', '/recursos/24/corregir')
  })

  it('no ofrece corregir los datos a quien no puede', async () => {
    getResource.mockResolvedValue({ ...VIDEO, canEdit: false })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: 'Corregir datos' })).not.toBeInTheDocument()
  })

  it('al volver de corregirlo confirma que se guardaron los cambios', async () => {
    getResource.mockResolvedValue({ ...VIDEO, canEdit: true })
    render(
      <MemoryRouter initialEntries={[{ pathname: '/recursos/24', state: { resourceCorrected: true } }]}>
        <Routes>
          <Route path="recursos/:resourceId" element={<ResourceDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Guardaste los cambios' })).toBeInTheDocument()
  })

  it('sin venir de corregirlo no muestra la confirmación', async () => {
    getResource.mockResolvedValue({ ...VIDEO, canEdit: true })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Guardaste los cambios')).not.toBeInTheDocument()
  })
})

// Historia HU307: retirar y volver a publicar desde la ficha. Se interactúa
// como una persona, nunca a través del estado del componente (ADR-009).
describe('ResourceDetailPage: retirar y volver a publicar', () => {
  const PUBLISHED = { ...VIDEO, canEdit: true, retired: false, canRetire: true, canRepublish: false }
  // Lo que devuelve la API de un recurso retirado: sin contenido, y con el
  // título solo para quien lo retiró.
  const RETIRED_FOR_RETIRER = {
    id: 24, title: VIDEO.title, topics: [], retired: true, canEdit: false, canRetire: false, canRepublish: true,
  }
  const RETIRED_FOR_ANYONE = { ...RETIRED_FOR_RETIRER, title: null, canRepublish: false }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('ofrece retirar, junto a corregir, a quien puede hacerlo', async () => {
    getResource.mockResolvedValue(PUBLISHED)
    renderDetail()

    expect(await screen.findByRole('button', { name: 'Retirar' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Corregir datos' })).toBeInTheDocument()
  })

  it('no ofrece retirar a quien no puede', async () => {
    getResource.mockResolvedValue({ ...PUBLISHED, canEdit: false, canRetire: false })
    renderDetail()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument()
  })

  it('pide confirmación y, si se cancela, no retira nada', async () => {
    getResource.mockResolvedValue(PUBLISHED)
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirar' }))
    expect(screen.getByRole('dialog', { name: '¿Retirar este recurso?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(retireResource).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(VIDEO.title)
  })

  it('al confirmar lo retira y la ficha pasa al aviso, con la opción de volver a publicarlo', async () => {
    getResource.mockResolvedValue(PUBLISHED)
    retireResource.mockResolvedValue(RETIRED_FOR_RETIRER)
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByRole('heading', { name: 'Retiraste este recurso' })).toBeInTheDocument()
    expect(retireResource).toHaveBeenCalledWith(24)
    expect(screen.getByText(/ya no aparece en el catálogo/)).toHaveTextContent(`«${VIDEO.title}»`)
    expect(screen.getByRole('button', { name: 'Volver a publicar' })).toBeEnabled()
    expect(screen.queryByRole('tab', { name: 'Video' })).not.toBeInTheDocument()
  })

  it('abierta por enlace directo, dice a cualquiera que ya no está disponible y no muestra su contenido', async () => {
    getResource.mockResolvedValue(RETIRED_FOR_ANYONE)
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Este recurso ya no está disponible' })).toBeInTheDocument()
    expect(screen.getByText('Se retiró del catálogo y ya no se puede consultar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/catalogo')
    expect(screen.queryByRole('button', { name: 'Volver a publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Corregir datos' })).not.toBeInTheDocument()
  })

  it('quien lo retiró lo vuelve a publicar y la ficha confirma que reaparece en el catálogo', async () => {
    getResource.mockResolvedValue(RETIRED_FOR_RETIRER)
    republishResource.mockResolvedValue(PUBLISHED)
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Este recurso ya no está disponible' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a publicar' }))

    expect(await screen.findByRole('heading', { name: 'Volviste a publicar el recurso' })).toBeInTheDocument()
    expect(republishResource).toHaveBeenCalledWith(24)
    expect(screen.getByText(/Ya aparece de nuevo en el catálogo/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(VIDEO.title)
    expect(screen.getByRole('button', { name: 'Retirar' })).toBeInTheDocument()
  })

  it('si la API rechaza el retiro por autoría, lo dice y recarga la ficha', async () => {
    getResource.mockResolvedValue(PUBLISHED)
    retireResource.mockRejectedValue(new ApiError('403', { status: 403, body: { code: 'RESOURCE_CHANGE_FORBIDDEN' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se retiró el recurso')
    expect(alert).toHaveTextContent('Solo quien aportó este recurso o una cuenta del equipo puede retirarlo.')
    expect(getResource).toHaveBeenCalledTimes(2)
  })

  it('si falla el token CSRF, pide recargar la página sin tratarlo como falta de permiso', async () => {
    getResource.mockResolvedValue(PUBLISHED)
    retireResource.mockRejectedValue(new ApiError('403', { status: 403, body: { code: 'CSRF_TOKEN_INVALID' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Recarga la página e inténtalo de nuevo.')
    expect(getResource).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Retirar' })).toBeEnabled()
  })

  it('si otra cuenta ya no le deja volver a publicarlo, lo dice', async () => {
    getResource.mockResolvedValue(RETIRED_FOR_RETIRER)
    republishResource.mockRejectedValue(
      new ApiError('403', { status: 403, body: { code: 'RESOURCE_REPUBLISH_FORBIDDEN' } }),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderDetail()

    fireEvent.click(await screen.findByRole('button', { name: 'Volver a publicar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se volvió a publicar el recurso')
    expect(alert).toHaveTextContent('Solo quien retiró este recurso puede volver a publicarlo.')
  })
})
