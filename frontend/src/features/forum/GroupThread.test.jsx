import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { listResources } from '../catalog/api.js'
import { joinGroupOfThread } from '../studygroup/api.js'
import { getQuestion, listAnswers, listQuestions } from './api.js'
import ForumPage from './ForumPage.jsx'
import QuestionPage from './QuestionPage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../catalog/api.js', () => ({ listResources: vi.fn() }))
vi.mock('../studygroup/api.js', () => ({ joinGroupOfThread: vi.fn() }))
vi.mock('./api.js', () => ({
  getQuestion: vi.fn(),
  listQuestions: vi.fn(),
  createQuestion: vi.fn(),
  retireQuestion: vi.fn(),
  listAnswers: vi.fn(),
  createAnswer: vi.fn(),
  retireAnswer: vi.fn(),
  markUsefulAnswer: vi.fn(),
  clearUsefulAnswer: vi.fn(),
}))

const RESOURCES = [{ id: 10, title: 'Spring Boot 2026-2', course: 'Arquitectura de Software', resourceType: 'VIDEO' }]
// El hilo de un grupo (HU404): su título es el nombre del grupo y su cuerpo,
// la descripción. No se retira desde el foro, así que canRetire es falso.
const THREAD = {
  id: 70,
  courseId: 1,
  resourceId: null,
  title: 'Parcial de patrones',
  body: 'Repasamos los patrones GoF antes del parcial.',
  createdAt: '2026-10-31T15:00:00Z',
  usefulAnswerId: null,
  answerCount: 0,
  retired: false,
  canRetire: false,
  canMarkUseful: true,
  group: true,
  canAnswer: true,
}

function renderPath(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/foro/preguntas/:questionId" element={<QuestionPage />} />
        <Route path="/catalogo/cursos/:courseId/foro" element={<ForumPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function loadedThread() {
  await screen.findByRole('heading', { level: 1 })
  return screen.getByRole('complementary', { name: 'Sobre esta pregunta' })
}

describe('El hilo de un grupo de estudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: null }
    getQuestion.mockResolvedValue(THREAD)
    listAnswers.mockResolvedValue([])
    listResources.mockResolvedValue(RESOURCES)
    listQuestions.mockResolvedValue([THREAD, { ...THREAD, id: 71, title: 'Duda de Spring', group: false }])
  })

  afterEach(cleanup)

  it('en el listado del foro se marca con «Grupo», y una pregunta corriente no', async () => {
    renderPath('/catalogo/cursos/1/foro')

    const rows = within(await screen.findByRole('list', { name: 'Preguntas del curso' })).getAllByRole('link')
    expect(rows[0]).toHaveTextContent('Parcial de patrones')
    expect(within(rows[0]).getByText('Grupo')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('Grupo')).not.toBeInTheDocument()
  })

  it('en su página se marca con «Grupo», enlaza a los grupos del curso y no se ofrece retirarlo', async () => {
    session = { status: 'ready', account: { id: 5 } }
    renderPath('/foro/preguntas/70')
    const aside = await loadedThread()

    expect(within(aside).getByText('Grupo')).toBeInTheDocument()
    expect(within(aside).getByRole('link', { name: 'Grupos de Arquitectura de Software' })).toHaveAttribute(
      'href',
      '/catalogo/cursos/1/grupos',
    )
    expect(screen.getByRole('navigation', { name: 'Ubicación' })).toHaveTextContent('Hilo del grupo')
    expect(screen.getByText(THREAD.body)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirar pregunta' })).not.toBeInTheDocument()
  })

  it('un miembro responde en él como en cualquier pregunta', async () => {
    session = { status: 'ready', account: { id: 5 } }
    renderPath('/foro/preguntas/70')
    const aside = await loadedThread()

    expect(within(aside).getByRole('button', { name: 'Responder' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Responder la pregunta' })).toBeInTheDocument()
    expect(screen.queryByText('Únete al grupo para responder')).not.toBeInTheDocument()
  })

  it('a quien no es miembro lo invita a unirse en lugar del formulario', async () => {
    session = { status: 'ready', account: { id: 6 } }
    getQuestion.mockResolvedValue({ ...THREAD, canAnswer: false, canMarkUseful: false })
    renderPath('/foro/preguntas/70')
    const aside = await loadedThread()

    expect(screen.getByText('Únete al grupo para responder')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver los grupos del curso' })).toHaveAttribute(
      'href',
      '/catalogo/cursos/1/grupos',
    )
    expect(screen.queryByRole('form', { name: 'Responder la pregunta' })).not.toBeInTheDocument()
    expect(within(aside).queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
    // Sin el formulario, el hilo vacío no invita a escribir abajo.
    expect(screen.getByText('Todavía nadie responde.')).toBeInTheDocument()
  })

  it('quien no es miembro se une desde el hilo: aparece el formulario con el foco y se anuncia (HU405)', async () => {
    session = { status: 'ready', account: { id: 6 } }
    getQuestion.mockResolvedValue({ ...THREAD, canAnswer: false, canMarkUseful: false })
    joinGroupOfThread.mockResolvedValue(undefined)
    renderPath('/foro/preguntas/70')
    await loadedThread()

    fireEvent.click(screen.getByRole('button', { name: 'Unirse al grupo' }))

    await waitFor(() => expect(joinGroupOfThread).toHaveBeenCalledWith(1, 70))
    expect(await screen.findByRole('form', { name: 'Responder la pregunta' })).toBeInTheDocument()
    expect(screen.queryByText('Únete al grupo para responder')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Tu respuesta/)).toHaveFocus()
    expect(await screen.findByText('Te uniste al grupo. Ya puedes responder.')).toBeInTheDocument()
  })

  it('si unirse desde el hilo falla, lo dice y la invitación sigue ahí', async () => {
    session = { status: 'ready', account: { id: 6 } }
    getQuestion.mockResolvedValue({ ...THREAD, canAnswer: false, canMarkUseful: false })
    joinGroupOfThread.mockRejectedValue(new ApiError('x', { status: 404, body: { code: 'STUDY_GROUP_NOT_FOUND' } }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderPath('/foro/preguntas/70')
    await loadedThread()

    fireEvent.click(screen.getByRole('button', { name: 'Unirse al grupo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este grupo ya no está disponible. Recarga la página.')
    expect(screen.getByRole('button', { name: 'Unirse al grupo' })).toBeEnabled()
    expect(screen.queryByRole('form', { name: 'Responder la pregunta' })).not.toBeInTheDocument()
  })

  it('sin sesión se lee, y la invitación dice que en él responden solo los miembros', async () => {
    getQuestion.mockResolvedValue({ ...THREAD, canAnswer: false, canMarkUseful: false })
    renderPath('/foro/preguntas/70')
    await loadedThread()

    expect(screen.getByText('Inicia sesión y únete al grupo para responder')).toBeInTheDocument()
    expect(screen.getByText(/en él responden solo los miembros del grupo/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Responder la pregunta' })).not.toBeInTheDocument()
  })

  it('un grupo sin descripción no deja un párrafo vacío bajo el título', async () => {
    getQuestion.mockResolvedValue({ ...THREAD, body: '' })
    renderPath('/foro/preguntas/70')
    await loadedThread()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Parcial de patrones')
    const paragraphs = [...screen.getByRole('main').querySelectorAll('p')]
    expect(paragraphs.filter((paragraph) => paragraph.textContent.trim() === '')).toHaveLength(0)
  })
})
