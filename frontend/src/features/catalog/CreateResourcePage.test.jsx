import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { createResource, getYouTubeMetadata, listCoursesWithResources, listTopicsWithResources } from './api.js'
import CreateResourcePage from './CreateResourcePage.jsx'

// Historia HU202: un enlace de YouTube en «Enlace» consulta el video y ofrece
// insertar sus datos en un modal. Se interactúa como una persona (escribir,
// pegar, pulsar) y nunca a través del estado del componente (ADR-009).
vi.mock('./api.js', () => ({
  createResource: vi.fn(),
  getYouTubeMetadata: vi.fn(),
  listCoursesWithResources: vi.fn(),
  listTopicsWithResources: vi.fn(),
}))

vi.mock('../../session/useSession.js', () => ({
  useSession: () => ({ status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }),
}))

const MISSING_NOTICE = 'No fue posible obtener este dato de YouTube; complétalo.'

const FIRST_VIDEO = {
  videoId: 'yhUh4ZmM45w',
  url: 'https://www.youtube.com/watch?v=yhUh4ZmM45w',
  title: 'Azure DevOps desde la creación del proyecto',
  description: null,
  publishedAt: '2026-09-06',
  durationSeconds: 2371,
  channel: 'Fábrica Escuela - Canal de Formación',
  missingFields: ['description'],
}

const SECOND_VIDEO = {
  videoId: 'S0TC_HDfKvA',
  url: 'https://www.youtube.com/watch?v=S0TC_HDfKvA',
  title: 'Harness Engineering',
  description: 'Introducción a Harness.',
  publishedAt: '2026-09-10',
  durationSeconds: 7230,
  channel: 'Otro canal',
  missingFields: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/registrar-recurso']}>
      <Routes>
        <Route path="/registrar-recurso" element={<CreateResourcePage />} />
        <Route path="/catalogo" element={<p>Catálogo</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const field = {
  url: () => screen.getByLabelText('Enlace'),
  title: () => screen.getByLabelText('Título'),
  description: () => screen.getByLabelText('Descripción'),
  publishedAt: () => screen.getByLabelText('Fecha de publicación'),
  duration: () => screen.getByLabelText('Duración'),
  channel: () => screen.getByLabelText('Canal'),
  course: () => screen.getByLabelText('Curso'),
  topics: () => screen.getByLabelText('Temas'),
}

// Pegar dispara la consulta de inmediato, como en el navegador: el evento
// paste llega antes que el cambio de valor.
function paste(input, value) {
  fireEvent.paste(input)
  fireEvent.change(input, { target: { value } })
}

function type(input, value) {
  fireEvent.change(input, { target: { value } })
}

function queryDialog() {
  return screen.queryByRole('dialog', { hidden: true })
}

async function openModalWith(link) {
  paste(field.url(), link)
  await waitFor(() => expect(queryDialog()?.open).toBe(true))
  return queryDialog()
}

function clickInDialog(name) {
  fireEvent.click(within(queryDialog()).getByRole('button', { name }))
}

function fillManualFields() {
  type(field.course(), 'Gestión de proyectos')
  type(field.topics(), 'Azure DevOps')
}

describe('CreateResourcePage - indexación desde YouTube (HU202)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listCoursesWithResources.mockResolvedValue([])
    listTopicsWithResources.mockResolvedValue([])
    createResource.mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('un enlace válido abre el modal solo con los campos obtenidos y sus dos botones', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()

    const dialog = await openModalWith('https://youtu.be/yhUh4ZmM45w')

    expect(getYouTubeMetadata).toHaveBeenCalledWith('https://youtu.be/yhUh4ZmM45w')
    expect(within(dialog).getByText(FIRST_VIDEO.title)).toBeInTheDocument()
    expect(within(dialog).getByText('Fecha de publicación')).toBeInTheDocument()
    expect(within(dialog).getByText('39:31')).toBeInTheDocument()
    expect(within(dialog).getByText(FIRST_VIDEO.channel)).toBeInTheDocument()
    // La descripción no llegó, así que no aparece en el modal.
    expect(within(dialog).queryByText('Descripción')).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Cancelar',
      'Insertar',
    ])
  })

  it('«Insertar» llena lo obtenido, marca lo ausente y canoniza el enlace sin tocar curso ni temas', async () => {
    getYouTubeMetadata.mockResolvedValue({ ...FIRST_VIDEO, publishedAt: null, missingFields: ['description', 'publishedAt'] })
    renderPage()
    fillManualFields()

    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')

    expect(queryDialog().open).toBe(false)
    expect(field.url()).toHaveValue(FIRST_VIDEO.url)
    expect(field.title()).toHaveValue(FIRST_VIDEO.title)
    expect(field.duration()).toHaveValue(2371)
    expect(field.channel()).toHaveValue(FIRST_VIDEO.channel)
    expect(field.course()).toHaveValue('Gestión de proyectos')
    expect(field.topics()).toHaveValue('Azure DevOps')

    // Los ausentes quedan vacíos con el aviso dentro del campo; nunca se inventan.
    expect(field.description()).toHaveValue('')
    expect(field.description()).toHaveAttribute('placeholder', MISSING_NOTICE)
    expect(field.publishedAt()).toHaveValue('')
    expect(screen.getByText(MISSING_NOTICE, { selector: '#resource-published-at-notice' })).toBeInTheDocument()
  })

  it('el aviso de un campo ausente desaparece al escribir en él', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')

    type(field.description(), 'Escrita a mano')

    expect(field.description()).not.toHaveAttribute('placeholder')
  })

  it('«Cancelar» en la primera consulta no cambia nada', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    type(field.title(), 'Título a mano')

    await openModalWith('https://youtu.be/yhUh4ZmM45w')
    clickInDialog('Cancelar')

    expect(queryDialog().open).toBe(false)
    expect(field.title()).toHaveValue('Título a mano')
    expect(field.url()).toHaveValue('https://youtu.be/yhUh4ZmM45w')
    expect(field.channel()).toHaveValue('')
  })

  it('ni Escape ni un clic fuera del recuadro cierran el modal', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    const dialog = await openModalWith('yhUh4ZmM45w')

    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    fireEvent.click(dialog)

    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(true)
    expect(field.title()).toHaveValue('')
  })

  it('tras una inserción, «Insertar» con un nuevo enlace vacía todo y vuelve a llenar', async () => {
    getYouTubeMetadata.mockResolvedValueOnce(FIRST_VIDEO).mockResolvedValueOnce(SECOND_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')
    fillManualFields()

    const dialog = await openModalWith('https://youtu.be/S0TC_HDfKvA')
    expect(within(dialog).getByText(/se borrará todo lo que hayas ingresado/)).toBeInTheDocument()
    clickInDialog('Insertar')

    expect(field.url()).toHaveValue(SECOND_VIDEO.url)
    expect(field.title()).toHaveValue(SECOND_VIDEO.title)
    expect(field.description()).toHaveValue(SECOND_VIDEO.description)
    expect(field.channel()).toHaveValue(SECOND_VIDEO.channel)
    expect(field.course()).toHaveValue('')
    expect(field.topics()).toHaveValue('')
  })

  it('tras una inserción, «Cancelar» con un nuevo enlace restaura el enlace anterior y deja el resto intacto', async () => {
    getYouTubeMetadata.mockResolvedValueOnce(FIRST_VIDEO).mockResolvedValueOnce(SECOND_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')
    fillManualFields()

    await openModalWith('https://youtu.be/S0TC_HDfKvA')
    clickInDialog('Cancelar')

    expect(field.url()).toHaveValue(FIRST_VIDEO.url)
    expect(field.title()).toHaveValue(FIRST_VIDEO.title)
    expect(field.course()).toHaveValue('Gestión de proyectos')
    expect(field.topics()).toHaveValue('Azure DevOps')
  })

  it('si el primer modal se canceló, el siguiente se comporta como primera inserción', async () => {
    getYouTubeMetadata.mockResolvedValueOnce(FIRST_VIDEO).mockResolvedValueOnce(SECOND_VIDEO)
    renderPage()
    fillManualFields()

    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Cancelar')
    const dialog = await openModalWith('S0TC_HDfKvA')

    expect(within(dialog).queryByText(/se borrará todo/)).not.toBeInTheDocument()
    clickInDialog('Insertar')
    expect(field.title()).toHaveValue(SECOND_VIDEO.title)
    expect(field.course()).toHaveValue('Gestión de proyectos')
  })

  it('los campos insertados se pueden editar', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')

    type(field.title(), 'Título corregido')
    type(field.duration(), '100')

    expect(field.title()).toHaveValue('Título corregido')
    expect(field.duration()).toHaveValue(100)
  })

  it('una descripción de YouTube más larga que el límite se inserta completa y se señala', async () => {
    getYouTubeMetadata.mockResolvedValue({ ...SECOND_VIDEO, description: 'a'.repeat(2500) })
    renderPage()
    await openModalWith('S0TC_HDfKvA')
    clickInDialog('Insertar')

    expect(field.description()).toHaveValue('a'.repeat(2500))
    expect(screen.getByText('La descripción no puede tener más de 2000 caracteres.')).toBeInTheDocument()
  })

  it.each([
    [400, 'INVALID_VIDEO_LINK', 'El enlace no corresponde a un video de YouTube.'],
    [404, 'VIDEO_NOT_FOUND', 'No encontramos ese video en YouTube.'],
    [503, 'VIDEO_METADATA_UNAVAILABLE', 'No fue posible consultar YouTube en este momento.'],
  ])('un %i (%s) muestra el mensaje, no abre el modal y conserva lo insertado', async (status, code, detail) => {
    getYouTubeMetadata
      .mockResolvedValueOnce(FIRST_VIDEO)
      .mockRejectedValueOnce(new ApiError(`El servidor respondió ${status}`, { status, body: { code, detail } }))
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')

    paste(field.url(), 'https://youtu.be/S0TC_HDfKvA')

    expect(await screen.findByText(detail)).toBeInTheDocument()
    expect(queryDialog().open).toBe(false)
    expect(field.title()).toHaveValue(FIRST_VIDEO.title)
    expect(field.channel()).toHaveValue(FIRST_VIDEO.channel)
  })

  it('un enlace de YouTube sin video se rechaza sin consultar', async () => {
    renderPage()

    paste(field.url(), 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw')

    expect(await screen.findByText(/no corresponde a un video/)).toBeInTheDocument()
    expect(getYouTubeMetadata).not.toHaveBeenCalled()
  })

  it('con un video rechazado no se publica ningún recurso', async () => {
    getYouTubeMetadata.mockRejectedValue(
      new ApiError('El servidor respondió 404', {
        status: 404,
        body: { code: 'VIDEO_NOT_FOUND', detail: 'No encontramos ese video en YouTube.' },
      }),
    )
    renderPage()
    paste(field.url(), 'https://youtu.be/S0TC_HDfKvA')
    await screen.findByText('No encontramos ese video en YouTube.')
    type(field.title(), 'Título')
    type(field.publishedAt(), '2026-09-10')
    fillManualFields()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar recurso' }))

    expect(await screen.findByText('No encontramos ese video en YouTube.')).toBeInTheDocument()
    expect(createResource).not.toHaveBeenCalled()
  })

  it('un enlace de otra plataforma no consulta, no abre el modal ni muestra rechazo', async () => {
    vi.useFakeTimers()
    renderPage()

    type(field.url(), 'https://vimeo.com/76979871')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(getYouTubeMetadata).not.toHaveBeenCalled()
    expect(queryDialog().open).toBe(false)
    expect(field.url()).not.toHaveAttribute('aria-invalid')
  })

  it('al escribir consulta tras una pausa, una sola vez por video, y avisa mientras consulta', async () => {
    vi.useFakeTimers()
    let resolveLookup
    getYouTubeMetadata.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve
      }),
    )
    renderPage()

    type(field.url(), 'https://youtu.be/yhUh4ZmM45')
    type(field.url(), 'https://youtu.be/yhUh4ZmM45w')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(getYouTubeMetadata).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(getYouTubeMetadata).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Consultando YouTube…')

    // El mismo video con otra forma de enlace no repite la consulta.
    type(field.url(), 'https://youtu.be/yhUh4ZmM45w?t=10')
    await act(async () => {
      resolveLookup(FIRST_VIDEO)
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(getYouTubeMetadata).toHaveBeenCalledTimes(1)
  })

  it('no se publica sin curso o sin tema', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')

    fireEvent.click(screen.getByRole('button', { name: 'Registrar recurso' }))

    expect(await screen.findByText('Escribe el curso.')).toBeInTheDocument()
    expect(screen.getByText('Escribe al menos un tema.')).toBeInTheDocument()
    expect(createResource).not.toHaveBeenCalled()
  })

  it('publica como automático si conserva algún valor insertado', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')
    fillManualFields()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar recurso' }))

    await waitFor(() => expect(createResource).toHaveBeenCalledTimes(1))
    expect(createResource).toHaveBeenCalledWith(
      expect.objectContaining({
        url: FIRST_VIDEO.url,
        title: FIRST_VIDEO.title,
        description: null,
        durationSeconds: 2371,
        resourceType: 'VIDEO',
        entryMethod: 'AUTOMATIC',
      }),
    )
  })

  it('no ofrece elegir el tipo: el registro por enlace es solo de videos', () => {
    renderPage()

    expect(screen.queryByLabelText('Tipo de recurso')).not.toBeInTheDocument()
    expect(screen.queryByText('Documento')).not.toBeInTheDocument()
  })

  it('publica como manual si se editaron todos los valores insertados', async () => {
    getYouTubeMetadata.mockResolvedValue(FIRST_VIDEO)
    renderPage()
    await openModalWith('yhUh4ZmM45w')
    clickInDialog('Insertar')
    fillManualFields()
    type(field.title(), 'Otro título')
    type(field.publishedAt(), '2026-01-01')
    type(field.duration(), '')
    type(field.channel(), 'Otro canal')

    fireEvent.click(screen.getByRole('button', { name: 'Registrar recurso' }))

    await waitFor(() => expect(createResource).toHaveBeenCalledTimes(1))
    expect(createResource).toHaveBeenCalledWith(expect.objectContaining({ entryMethod: 'MANUAL' }))
  })

  it('sin indexación el formulario sigue siendo el manual', async () => {
    renderPage()
    type(field.url(), 'https://ejemplo.com/apunte.pdf')
    type(field.title(), 'Apunte')
    type(field.publishedAt(), '2026-09-10')
    fillManualFields()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar recurso' }))

    await waitFor(() => expect(createResource).toHaveBeenCalledTimes(1))
    expect(createResource).toHaveBeenCalledWith(expect.objectContaining({ entryMethod: 'MANUAL' }))
    expect(getYouTubeMetadata).not.toHaveBeenCalled()
  })
})
