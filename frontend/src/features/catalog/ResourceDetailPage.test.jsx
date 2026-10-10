import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getResource } from './api.js'
import ResourceDetailPage from './ResourceDetailPage.jsx'

vi.mock('./api.js', () => ({ getResource: vi.fn() }))

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
})
