import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { getResource, listCoursesWithResources, listTopicsWithResources, updateResource } from './api.js'
import EditResourcePage from './EditResourcePage.jsx'

// Historia HU311: se interactúa como una persona (cambiar un campo, pulsar
// Guardar) y nunca a través del estado del componente (ADR-009).
vi.mock('./api.js', () => ({
  getResource: vi.fn(),
  listCoursesWithResources: vi.fn(),
  listTopicsWithResources: vi.fn(),
  updateResource: vi.fn(),
}))

let session
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))

const VIDEO = {
  id: 24,
  title: 'Integral definida e indefinda',
  description: 'Grabación de un taller de repaso.',
  publishedAt: '2021-02-26',
  durationSeconds: 6011,
  channel: 'Fundación Antivirus para la Deserción',
  url: 'https://www.youtube.com/watch?v=b2sxnAp9Dcg',
  resourceType: 'VIDEO',
  courseId: 1,
  course: 'Cálculo Integral',
  topics: ['Integral Indefinida'],
  canEdit: true,
}

const DOCUMENT = {
  ...VIDEO,
  id: 31,
  title: 'Resumen de series',
  publishedAt: '2026-10-10',
  durationSeconds: null,
  channel: null,
  url: null,
  resourceType: 'DOCUMENT',
}

function renderPage(id = 24) {
  return render(
    <MemoryRouter initialEntries={[`/recursos/${id}/corregir`]}>
      <Routes>
        <Route path="/recursos/:resourceId/corregir" element={<EditResourcePage />} />
        <Route path="/recursos/:resourceId" element={<p>Ficha del recurso</p>} />
        <Route path="/iniciar-sesion" element={<p>Inicio de sesión</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EditResourcePage', () => {
  beforeEach(() => {
    session = { status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }
    getResource.mockResolvedValue(VIDEO)
    listCoursesWithResources.mockResolvedValue([
      { id: 1, name: 'Cálculo Integral' },
      { id: 2, name: 'Física de Campos' },
    ])
    listTopicsWithResources.mockResolvedValue([{ id: 10, name: 'Integral Indefinida' }, { id: 11, name: 'Series' }])
    updateResource.mockResolvedValue(VIDEO)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sin sesión no ofrece el formulario y lleva a iniciar sesión', () => {
    session = { status: 'ready', account: null }
    renderPage()

    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument()
    expect(getResource).not.toHaveBeenCalled()
  })

  it('llena el formulario con los datos actuales del video y muestra el enlace sin dejar cambiarlo', async () => {
    renderPage()

    expect(await screen.findByLabelText('Título')).toHaveValue(VIDEO.title)
    expect(screen.getByLabelText(/Descripción/)).toHaveValue(VIDEO.description)
    expect(screen.getByLabelText('Fecha de publicación')).toHaveValue('2021-02-26')
    expect(screen.getByLabelText(/Duración/)).toHaveValue(6011)
    expect(screen.getByText('En segundos: 1 h 40 min. Déjalo en blanco si no la sabes.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Canal/)).toHaveValue(VIDEO.channel)
    expect(screen.getByText('Cálculo Integral', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Temas elegidos' })).toHaveTextContent('Integral Indefinida')

    // El enlace se lee, pero no hay campo para cambiarlo.
    expect(screen.getByText(VIDEO.url)).toBeInTheDocument()
    expect(screen.queryByLabelText('Enlace')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'registra un recurso nuevo' })).toHaveAttribute('href', '/registrar-recurso')
  })

  it('en un video ordena las secciones y las deja antes de los botones', async () => {
    renderPage()

    await screen.findByLabelText('Título')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Cómo se llama', 'Datos del video', 'Dónde está', 'Datos fijos'])

    const fixedData = screen.getByRole('region', { name: 'Datos fijos' })
    const save = screen.getByRole('button', { name: 'Guardar cambios' })
    expect(fixedData.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('guarda la corrección y vuelve a la ficha', async () => {
    const user = userEvent.setup()
    renderPage()

    const title = await screen.findByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Integral definida e indefinida')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Ficha del recurso')).toBeInTheDocument()
    expect(updateResource).toHaveBeenCalledWith(24, {
      resourceType: 'VIDEO',
      title: 'Integral definida e indefinida',
      description: VIDEO.description,
      publishedAt: '2021-02-26',
      durationSeconds: '6011',
      channel: VIDEO.channel,
      course: 'Cálculo Integral',
      topics: ['Integral Indefinida'],
    })
  })

  it('cambiar de curso vacía los temas, como al registrar', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Cambiar/ }))
    await user.type(screen.getByLabelText('Curso'), 'fisica{Enter}')

    expect(screen.queryByRole('list', { name: 'Temas elegidos' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(screen.getByText('Elige o escribe al menos un tema.')).toBeInTheDocument()
    expect(updateResource).not.toHaveBeenCalled()
  })

  it('aplica en el navegador las reglas del registro y lleva el foco al primer error', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.clear(await screen.findByLabelText('Título'))
    await user.clear(screen.getByLabelText(/Duración/))
    await user.type(screen.getByLabelText(/Duración/), '0')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(screen.getByText('Escribe el título.')).toBeInTheDocument()
    expect(screen.getByText('La duración debe ser un número de segundos mayor que cero.')).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(updateResource).not.toHaveBeenCalled()
  })

  it('en un apunte corrige título, descripción, curso y temas, y deja la fecha y el archivo a la vista', async () => {
    const user = userEvent.setup()
    getResource.mockResolvedValue(DOCUMENT)
    renderPage(31)

    expect(await screen.findByLabelText('Título')).toHaveValue('Resumen de series')
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Cómo se llama', 'Dónde está', 'Datos fijos'])
    expect(screen.queryByLabelText('Fecha de publicación')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Duración/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Canal/)).not.toBeInTheDocument()
    expect(screen.getByText('PDF del apunte')).toBeInTheDocument()
    expect(screen.getByText('10 de octubre de 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'sube un apunte nuevo' })).toHaveAttribute('href', '/subir-apunte?courseId=1')

    await user.type(screen.getByLabelText(/Descripción/), ' Con ejercicios.')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateResource).toHaveBeenCalled())
    const [id, data] = updateResource.mock.calls[0]
    expect(id).toBe(31)
    expect(data).toMatchObject({ resourceType: 'DOCUMENT', description: 'Grabación de un taller de repaso. Con ejercicios.' })
  })

  it('a quien no puede corregirlo le explica por qué en vez de mostrar el formulario', async () => {
    getResource.mockResolvedValue({ ...VIDEO, canEdit: false })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'No puedes corregir este recurso' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a la ficha' })).toHaveAttribute('href', '/recursos/24')
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })

  it('muestra junto al campo el error de validación que devuelve el backend', async () => {
    const user = userEvent.setup()
    updateResource.mockRejectedValue(new ApiError('400', {
      status: 400,
      body: { code: 'VALIDATION_FAILED', errors: [{ field: 'topics[0]', message: 'Un tema no puede tener más de 200 caracteres.' }] },
    }))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Un tema no puede tener más de 200 caracteres.')).toBeInTheDocument()
    expect(screen.queryByText('Ficha del recurso')).not.toBeInTheDocument()
  })

  it('si el backend rechaza la corrección por autoría, lo dice en un aviso', async () => {
    const user = userEvent.setup()
    updateResource.mockRejectedValue(new ApiError('403', { status: 403, body: { code: 'RESOURCE_CHANGE_FORBIDDEN' } }))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se guardaron los cambios')
    expect(alert).toHaveTextContent('Solo quien aportó este recurso o una cuenta del equipo puede corregirlo.')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('avisa cuando el recurso no existe', async () => {
    getResource.mockRejectedValue(new ApiError('404', { status: 404, body: { code: 'RESOURCE_NOT_FOUND' } }))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Recurso no encontrado' })).toBeInTheDocument()
  })
})
