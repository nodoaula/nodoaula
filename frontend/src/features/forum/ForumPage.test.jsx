import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { listResources } from '../catalog/api.js'
import { createQuestion, listQuestions } from './api.js'
import ForumPage from './ForumPage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../catalog/api.js', () => ({ listResources: vi.fn() }))
vi.mock('./api.js', () => ({ listQuestions: vi.fn(), createQuestion: vi.fn() }))

const RESOURCES = [{ id: 10, title: 'Spring Boot 2026-2', course: 'Arquitectura de Software' }]
const QUESTION = {
  id: 1,
  courseId: 1,
  resourceId: 10,
  title: '¿Cuándo usar un monolito modular?',
  body: 'No me queda claro.',
  createdAt: '2026-10-20T15:00:00Z',
  answerCount: 0,
  canRetire: false,
}

function Destination({ name }) {
  const { state } = useLocation()
  return <p>{`${name} desde ${state?.from ?? 'ninguna'}`}</p>
}

function CurrentLocation() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

function renderForum(courseId = '1', search = '') {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/cursos/${courseId}/foro${search}`]}>
      <CurrentLocation />
      <Routes>
        <Route path="/catalogo/cursos/:courseId/foro" element={<ForumPage />} />
        <Route path="/iniciar-sesion" element={<Destination name="Inicio de sesión" />} />
        <Route path="/registro" element={<Destination name="Registro" />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function openForm() {
  renderForum()
  fireEvent.click(await screen.findByRole('button', { name: 'Hacer una pregunta' }))
  return screen.findByRole('form', { name: 'Publicar una pregunta' })
}

describe('ForumPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: null }
    listResources.mockResolvedValue(RESOURCES)
    listQuestions.mockResolvedValue([QUESTION])
  })

  afterEach(cleanup)

  it('sin sesión muestra las preguntas y «Hacer una pregunta» lleva a iniciar sesión, sin formulario', async () => {
    renderForum()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Foro de Arquitectura de Software')
    expect(listQuestions).toHaveBeenCalledWith('1')
    expect(screen.getByText('¿Cuándo usar un monolito modular?')).toBeInTheDocument()
    expect(screen.getByText(/Sobre «Spring Boot 2026-2»/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hacer una pregunta' })).toHaveAttribute('href', '/iniciar-sesion')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument()
  })

  // Historia HU403: quien intenta preguntar sin sesión vuelve al foro al
  // entrar, y con el formulario ya abierto.
  it('sin sesión, «Hacer una pregunta» recuerda el foro para volver a él con el formulario abierto', async () => {
    renderForum()
    fireEvent.click(await screen.findByRole('link', { name: 'Hacer una pregunta' }))
    expect(await screen.findByText('Inicio de sesión desde /catalogo/cursos/1/foro?preguntar')).toBeInTheDocument()
  })

  it('sin sesión, llegar con ?preguntar no abre el formulario', async () => {
    renderForum('1', '?preguntar')

    expect(await screen.findByRole('link', { name: 'Hacer una pregunta' })).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('mientras se sabe si hay sesión no ofrece «Hacer una pregunta»', async () => {
    session = { status: 'loading', account: null }
    renderForum()

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByText('Hacer una pregunta')).not.toBeInTheDocument()
  })

  it('con sesión, al llegar con ?preguntar el formulario ya está abierto y la marca sale de la dirección', async () => {
    session = { status: 'ready', account: { id: 5 } }
    renderForum('1', '?preguntar')

    expect(await screen.findByRole('form', { name: 'Publicar una pregunta' })).toBeInTheDocument()
    // El formulario aparece al llegar los datos, y el foco se mueve después de pintarlo.
    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveFocus())
    // Así, volver atrás o recargar no lo abre otra vez.
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/catalogo\/cursos\/1\/foro$/)
  })

  it('un curso sin recursos se trata como no encontrado', async () => {
    listResources.mockResolvedValue([])
    renderForum()

    expect(await screen.findByText('Curso no encontrado')).toBeInTheDocument()
  })

  it('si falla la carga avisa con una alerta', async () => {
    listQuestions.mockRejectedValue(new ApiError('x', { status: 500 }))
    renderForum()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el foro')
  })

  it('con sesión publica una pregunta y aparece primero en la lista', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockResolvedValue({ ...QUESTION, id: 2, title: 'Otra duda', resourceId: null, canRetire: true })
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '  Otra duda ' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'Detalle de la duda' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    await waitFor(() =>
      expect(createQuestion).toHaveBeenCalledWith({
        courseId: 1,
        resourceId: null,
        title: 'Otra duda',
        body: 'Detalle de la duda',
      }),
    )
    const list = await screen.findByRole('list', { name: 'Preguntas del curso' })
    const rows = within(list).getAllByRole('link')
    expect(rows[0]).toHaveTextContent('Otra duda')
    expect(rows[0]).toHaveAttribute('href', '/foro/preguntas/2')
    // Al publicar se cierra y, como al responder, el foco va a lo publicado.
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(rows[0]).toHaveFocus()
    expect(await screen.findByText('Publicaste tu pregunta.')).toBeInTheDocument()
  })

  it('el botón abre el formulario con el foco en el título y «Cancelar» lo cierra conservando lo escrito', async () => {
    session = { status: 'ready', account: { id: 5 } }
    await openForm()
    expect(screen.getByLabelText('Título')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Hacer una pregunta' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Borrador' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    const ask = screen.getByRole('button', { name: 'Hacer una pregunta' })
    expect(ask).toHaveFocus()
    fireEvent.click(ask)
    expect(await screen.findByLabelText('Título')).toHaveValue('Borrador')
    expect(screen.getByLabelText('Título')).toHaveFocus()
  })

  it('tras publicar, el formulario vuelve a abrirse vacío', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockResolvedValue({ ...QUESTION, id: 2, title: 'Otra duda' })
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Otra duda' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Hacer una pregunta' }))

    expect(await screen.findByLabelText('Título')).toHaveValue('')
    expect(screen.getByLabelText('Detalle')).toHaveValue('')
  })

  it('si el envío agota el tiempo pide comprobar el foro sin perder lo escrito', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockRejectedValue(new ApiError('x', { timedOut: true }))
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('mira el foro en otra pestaña')
  })

  it('mientras publica no deja enviar dos veces', async () => {
    session = { status: 'ready', account: { id: 5 } }
    let resolve
    createQuestion.mockReturnValue(new Promise((r) => (resolve = r)))
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))
    const busy = await screen.findByRole('button', { name: 'Publicando…' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(busy)
    expect(createQuestion).toHaveBeenCalledTimes(1)
    // Tampoco se cancela a medias: el envío ya salió.
    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    expect(cancel).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(cancel)
    expect(screen.getByRole('form', { name: 'Publicar una pregunta' })).toBeInTheDocument()

    await act(async () => resolve({ ...QUESTION, id: 2 }))
  })

  it('si el servidor falla lo avisa con una alerta y conserva lo escrito', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockRejectedValue(new ApiError('x', { status: 500 }))
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi duda' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('heading', { level: 3 })).toHaveTextContent('No se pudo publicar la pregunta')
    expect(screen.getByLabelText('Título')).toHaveValue('Mi duda')

    // Al cancelar y volver a abrir, lo escrito sigue pero el error ya no.
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hacer una pregunta' }))
    expect(screen.getByLabelText('Título')).toHaveValue('Mi duda')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('puede asociar la pregunta a un recurso del curso', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockResolvedValue({ ...QUESTION, id: 2 })
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.change(screen.getByLabelText(/Recurso relacionado/), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    await waitFor(() => expect(createQuestion).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 10 })))
  })

  it('con campos vacíos muestra los errores y no llama al backend', async () => {
    session = { status: 'ready', account: { id: 5 } }
    await openForm()

    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    expect(await screen.findByText('Escribe el título de tu pregunta.')).toBeInTheDocument()
    expect(screen.getByText('Cuenta tu duda con más detalle.')).toBeInTheDocument()
    expect(createQuestion).not.toHaveBeenCalled()
  })

  it('tras un envío con errores lleva el foco al primer campo con error', async () => {
    session = { status: 'ready', account: { id: 5 } }
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Con título' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    expect(await screen.findByText('Cuenta tu duda con más detalle.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Detalle')).toHaveFocus())
  })

  it('muestra junto al campo el error de validación del backend', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockRejectedValue(
      new ApiError('x', {
        status: 400,
        body: { code: 'VALIDATION_FAILED', errors: [{ field: 'resourceId', message: 'El recurso no está publicado en ese curso.' }] },
      }),
    )
    await openForm()

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.change(screen.getByLabelText(/Recurso relacionado/), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    expect(await screen.findByText('El recurso no está publicado en ese curso.')).toBeInTheDocument()
  })

  it('cada pregunta enlaza a su página y dice cuántas respuestas tiene, sin acciones en la fila', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listQuestions.mockResolvedValue([
      { ...QUESTION, id: 2, title: 'Con respuestas', resourceId: null, answerCount: 3, canRetire: true },
      { ...QUESTION, answerCount: 1 },
      { ...QUESTION, id: 3, title: 'Sin nada', resourceId: null, answerCount: 0 },
    ])
    renderForum()

    const rows = within(await screen.findByRole('list', { name: 'Preguntas del curso' })).getAllByRole('link')
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/foro/preguntas/2', '/foro/preguntas/1', '/foro/preguntas/3'])
    expect(rows[0]).toHaveTextContent('3 respuestas')
    expect(rows[1]).toHaveTextContent('1 respuesta')
    expect(rows[1]).toHaveTextContent('Sobre «Spring Boot 2026-2»')
    expect(rows[2]).toHaveTextContent('Sin respuestas')
    // Se retira desde la página de la pregunta, no desde el listado.
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument()
  })

  it('al volver de retirar una pregunta lo confirma una vez: el aviso toma el foco y la marca sale del historial', async () => {
    function HistoryState() {
      return <p>{`estado: ${JSON.stringify(useLocation().state)}`}</p>
    }
    render(
      <MemoryRouter initialEntries={[{ pathname: '/catalogo/cursos/1/foro', state: { questionRetired: true } }]}>
        <Routes>
          <Route path="/catalogo/cursos/:courseId/foro" element={<ForumPage />} />
        </Routes>
        <HistoryState />
      </MemoryRouter>,
    )

    const notice = await screen.findByText('Retiraste la pregunta')
    expect(notice.closest('[tabindex="-1"]')).toHaveFocus()
    expect(screen.getByText('estado: null')).toBeInTheDocument()
    expect(screen.getByText('Retiraste la pregunta')).toBeInTheDocument()
  })
})
