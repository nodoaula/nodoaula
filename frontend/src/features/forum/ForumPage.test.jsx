import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { listResources } from '../catalog/api.js'
import { createQuestion, listQuestions, retireQuestion } from './api.js'
import ForumPage from './ForumPage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../catalog/api.js', () => ({ listResources: vi.fn() }))
vi.mock('./api.js', () => ({ listQuestions: vi.fn(), createQuestion: vi.fn(), retireQuestion: vi.fn() }))

const RESOURCES = [{ id: 10, title: 'Spring Boot 2026-2', course: 'Arquitectura de Software' }]
const QUESTION = {
  id: 1,
  courseId: 1,
  resourceId: 10,
  title: '¿Cuándo usar un monolito modular?',
  body: 'No me queda claro.',
  createdAt: '2026-10-20T15:00:00Z',
  canRetire: false,
}

function renderForum(courseId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/cursos/${courseId}/foro`]}>
      <Routes>
        <Route path="/catalogo/cursos/:courseId/foro" element={<ForumPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ForumPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: null }
    listResources.mockResolvedValue(RESOURCES)
    listQuestions.mockResolvedValue([QUESTION])
  })

  afterEach(cleanup)

  it('sin sesión muestra las preguntas y la invitación a iniciar sesión, sin formulario', async () => {
    renderForum()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Foro de Arquitectura de Software')
    expect(listQuestions).toHaveBeenCalledWith('1')
    expect(screen.getByText('¿Cuándo usar un monolito modular?')).toBeInTheDocument()
    expect(screen.getByText(/Sobre «Spring Boot 2026-2»/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/iniciar-sesion')
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/registro')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument()
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
    renderForum()
    await screen.findByRole('form', { name: 'Publicar una pregunta' })

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
    const titles = within(list).getAllByRole('heading', { level: 3 })
    expect(titles[0]).toHaveTextContent('Otra duda')
    expect(screen.getByLabelText('Título')).toHaveValue('')
  })

  it('puede asociar la pregunta a un recurso del curso', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockResolvedValue({ ...QUESTION, id: 2 })
    renderForum()
    await screen.findByRole('form', { name: 'Publicar una pregunta' })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.change(screen.getByLabelText('Recurso relacionado (opcional)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    await waitFor(() => expect(createQuestion).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 10 })))
  })

  it('con campos vacíos muestra los errores y no llama al backend', async () => {
    session = { status: 'ready', account: { id: 5 } }
    renderForum()
    await screen.findByRole('form', { name: 'Publicar una pregunta' })

    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    expect(await screen.findByText('Escribe el título de tu pregunta.')).toBeInTheDocument()
    expect(screen.getByText('Cuenta tu duda con más detalle.')).toBeInTheDocument()
    expect(createQuestion).not.toHaveBeenCalled()
  })

  it('muestra junto al campo el error de validación del backend', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createQuestion.mockRejectedValue(
      new ApiError('x', {
        status: 400,
        body: { code: 'VALIDATION_FAILED', errors: [{ field: 'resourceId', message: 'El recurso no está publicado en ese curso.' }] },
      }),
    )
    renderForum()
    await screen.findByRole('form', { name: 'Publicar una pregunta' })

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Detalle'), { target: { value: 'D' } })
    fireEvent.change(screen.getByLabelText('Recurso relacionado (opcional)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar pregunta' }))

    expect(await screen.findByText('El recurso no está publicado en ese curso.')).toBeInTheDocument()
  })

  it('retirar pide confirmación y quita la pregunta de la lista', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listQuestions.mockResolvedValue([{ ...QUESTION, canRetire: true }])
    retireQuestion.mockResolvedValue(null)
    renderForum()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirar' }))
    expect(retireQuestion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    await waitFor(() => expect(retireQuestion).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('¿Cuándo usar un monolito modular?')).not.toBeInTheDocument())
    expect(screen.getByText(/Aún no hay preguntas/)).toBeInTheDocument()
  })

  it('si el backend niega el retiro muestra el motivo y conserva la pregunta', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listQuestions.mockResolvedValue([{ ...QUESTION, canRetire: true }])
    retireQuestion.mockRejectedValue(new ApiError('x', { status: 403, body: { code: 'QUESTION_CHANGE_FORBIDDEN' } }))
    renderForum()

    fireEvent.click(await screen.findByRole('button', { name: 'Retirar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByText(/Solo quien publicó esta pregunta/)).toBeInTheDocument()
    expect(screen.getByText('¿Cuándo usar un monolito modular?')).toBeInTheDocument()
  })
})
