import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../lib/apiClient.js'
import { listResources } from '../catalog/api.js'
import {
  clearUsefulAnswer,
  createAnswer,
  getQuestion,
  listAnswers,
  listQuestions,
  markUsefulAnswer,
  retireAnswer,
  retireQuestion,
} from './api.js'
import ForumPage from './ForumPage.jsx'
import QuestionPage from './QuestionPage.jsx'

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../catalog/api.js', () => ({ listResources: vi.fn() }))
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

const RESOURCES = [
  { id: 10, title: 'Tiempo de descarga a 10 V', course: 'Física de Campos', resourceType: 'DOCUMENT' },
  { id: 11, title: 'Capacitores', course: 'Física de Campos', resourceType: 'VIDEO' },
]
const QUESTION = {
  id: 7,
  courseId: 3,
  resourceId: 10,
  title: '¿Por qué en la descarga el voltaje nunca llega a cero?',
  body: '¿En qué momento se considera descargado?',
  createdAt: '2026-10-24T15:00:00Z',
  usefulAnswerId: null,
  retired: false,
  canRetire: false,
  canMarkUseful: false,
}
const FIRST = { id: 1, body: 'Después de 5τ queda menos del 1 %.', createdAt: '2026-10-24T18:00:00Z', mine: false, canRetire: false }
const SECOND = { id: 2, body: 'Despeja t = −RC·ln(V/V₀).', createdAt: '2026-10-25T18:00:00Z', mine: false, canRetire: false }

// Muestra a dónde llevó la navegación y con qué estado, para comprobar la
// vuelta a la pregunta al iniciar sesión.
function Destination({ name }) {
  const { state } = useLocation()
  return <p>{`${name} desde ${state?.from ?? 'ninguna'}`}</p>
}

function renderQuestion(path = '/foro/preguntas/7') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/foro/preguntas/:questionId" element={<QuestionPage />} />
        <Route path="/catalogo/cursos/:courseId/foro" element={<ForumPage />} />
        <Route path="/iniciar-sesion" element={<Destination name="Inicio de sesión" />} />
        <Route path="/registro" element={<Destination name="Registro" />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function loadedThread() {
  await screen.findByRole('heading', { level: 1 })
  return screen.getByRole('region', { name: /^(Respuestas|\d+ respuestas?)$/ })
}

describe('QuestionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session = { status: 'ready', account: null }
    getQuestion.mockResolvedValue(QUESTION)
    listAnswers.mockResolvedValue([FIRST, SECOND])
    listResources.mockResolvedValue(RESOURCES)
  })

  afterEach(cleanup)

  it('sin sesión muestra la pregunta, su apunte y el hilo en orden, e invita a iniciar sesión', async () => {
    renderQuestion()
    const thread = await loadedThread()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(QUESTION.title)
    expect(getQuestion).toHaveBeenCalledWith('7')
    expect(listResources).toHaveBeenCalledWith({ courseId: 3 })
    expect(screen.getByText(QUESTION.body)).toBeInTheDocument()
    const aside = screen.getByRole('complementary', { name: 'Sobre esta pregunta' })
    expect(within(aside).getByText('Sobre el apunte')).toBeInTheDocument()
    expect(within(aside).getByRole('link', { name: /Tiempo de descarga a 10 V/ })).toHaveAttribute('href', '/recursos/10')
    expect(screen.getByRole('link', { name: 'Foro' })).toHaveAttribute('href', '/catalogo/cursos/3/foro')

    expect(within(thread).getByRole('heading', { level: 2 })).toHaveTextContent('2 respuestas')
    const texts = within(thread).getAllByRole('article').map((article) => article.textContent)
    expect(texts[0]).toContain(FIRST.body)
    expect(texts[1]).toContain(SECOND.body)

    expect(screen.queryByRole('form', { name: 'Responder la pregunta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Responder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como útil' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retirar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Inicia sesión para responder')).toBeInTheDocument()
  })

  it('iniciar sesión o crear una cuenta lleva la pregunta para volver a ella', async () => {
    renderQuestion()
    await loadedThread()

    fireEvent.click(screen.getByRole('link', { name: 'Crear cuenta' }))
    expect(await screen.findByText('Registro desde /foro/preguntas/7')).toBeInTheDocument()
  })

  it('sin respuestas lo dice, y con sesión invita a escribir la primera', async () => {
    listAnswers.mockResolvedValue([])
    session = { status: 'ready', account: { id: 5 } }
    renderQuestion()
    const thread = await loadedThread()

    expect(within(thread).getByRole('heading', { level: 2 })).toHaveTextContent('Respuestas')
    expect(within(thread).getByText(/Todavía nadie responde. Si sabes la respuesta/)).toBeInTheDocument()
  })

  it('mientras no se sabe si hay sesión no ofrece ni el formulario ni la invitación', async () => {
    session = { status: 'loading', account: null }
    renderQuestion()
    await loadedThread()

    expect(screen.queryByRole('form', { name: 'Responder la pregunta' })).not.toBeInTheDocument()
    expect(screen.queryByText('Inicia sesión para responder')).not.toBeInTheDocument()
  })

  it('con sesión publica una respuesta al final del hilo, le pasa el foco y lo anuncia', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createAnswer.mockResolvedValue({ id: 3, body: 'Mi respuesta', createdAt: '2026-10-27T18:00:00Z', mine: true, canRetire: true })
    renderQuestion()
    const thread = await loadedThread()

    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    const field = screen.getByLabelText('Tu respuesta')
    expect(field).toHaveFocus()

    fireEvent.change(field, { target: { value: '  Mi respuesta  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))

    await waitFor(() => expect(createAnswer).toHaveBeenCalledWith(7, 'Mi respuesta'))
    const articles = within(thread).getAllByRole('article')
    expect(articles).toHaveLength(3)
    expect(articles[2]).toHaveTextContent('Tu respuesta ·')
    expect(articles[2]).toHaveFocus()
    expect(within(thread).getByRole('heading', { level: 2 })).toHaveTextContent('3 respuestas')
    expect(field).toHaveValue('')
    expect(await screen.findByText('Publicaste tu respuesta.')).toBeInTheDocument()
  })

  it('una respuesta vacía o de más de 5000 caracteres muestra el error junto al campo sin enviarla', async () => {
    session = { status: 'ready', account: { id: 5 } }
    renderQuestion()
    await loadedThread()
    const field = screen.getByLabelText('Tu respuesta')

    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(/Escribe tu respuesta antes de publicarla/)
    expect(field).toHaveFocus()

    fireEvent.change(field, { target: { value: 'a'.repeat(5001) } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))
    expect(field).toHaveAccessibleDescription(/no puede tener más de 5000 caracteres/)
    expect(createAnswer).not.toHaveBeenCalled()
  })

  it('el rechazo del servidor sobre el texto se muestra junto al campo', async () => {
    session = { status: 'ready', account: { id: 5 } }
    createAnswer.mockRejectedValue(
      new ApiError('x', { status: 400, body: { code: 'VALIDATION_FAILED', errors: [{ field: 'body', message: 'Escribe tu respuesta.' }] } }),
    )
    renderQuestion()
    await loadedThread()

    fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'Texto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }))

    await waitFor(() => expect(screen.getByLabelText('Tu respuesta')).toHaveAccessibleDescription(/Escribe tu respuesta\./))
  })

  it('quien preguntó marca una respuesta como útil, la cambia y la quita, con el foco en cada paso', async () => {
    session = { status: 'ready', account: { id: 9 } }
    getQuestion.mockResolvedValue({ ...QUESTION, canMarkUseful: true })
    markUsefulAnswer.mockResolvedValue(null)
    clearUsefulAnswer.mockResolvedValue(null)
    renderQuestion()
    const thread = await loadedThread()
    const [first, second] = within(thread).getAllByRole('article')

    fireEvent.click(within(first).getByRole('button', { name: 'Marcar como útil' }))
    await waitFor(() => expect(within(first).getByRole('button', { name: 'Quitar la marca' })).toHaveFocus())
    expect(markUsefulAnswer).toHaveBeenCalledWith(7, 1)
    expect(within(first).getByText('Útil para quien preguntó')).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Respuesta útil para quien preguntó' })
    expect(summary).toHaveTextContent(FIRST.body)
    expect(within(summary).getByRole('link', { name: 'Verla en el hilo' })).toHaveAttribute('href', '#respuesta-1')
    expect(await screen.findByText('Marcaste la respuesta como útil.')).toBeInTheDocument()

    // Solo hay una: marcar otra quita la marca de la anterior. El hilo no cambia de orden.
    fireEvent.click(within(second).getByRole('button', { name: 'Marcar como útil' }))
    await waitFor(() => expect(within(second).getByRole('button', { name: 'Quitar la marca' })).toHaveFocus())
    expect(within(first).queryByText('Útil para quien preguntó')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Respuesta útil para quien preguntó' })).toHaveTextContent(SECOND.body)
    expect(within(thread).getAllByRole('article')[0]).toBe(first)

    fireEvent.click(within(second).getByRole('button', { name: 'Quitar la marca' }))
    await waitFor(() => expect(within(second).getByRole('button', { name: 'Marcar como útil' })).toHaveFocus())
    expect(clearUsefulAnswer).toHaveBeenCalledWith(7)
    expect(screen.queryByRole('region', { name: 'Respuesta útil para quien preguntó' })).not.toBeInTheDocument()
  })

  it('quien no hizo la pregunta ve la útil pero no puede marcarla', async () => {
    session = { status: 'ready', account: { id: 5 } }
    getQuestion.mockResolvedValue({ ...QUESTION, usefulAnswerId: 2 })
    renderQuestion()
    const thread = await loadedThread()

    expect(screen.getByRole('region', { name: 'Respuesta útil para quien preguntó' })).toHaveTextContent(SECOND.body)
    expect(within(thread).queryByRole('button', { name: 'Marcar como útil' })).not.toBeInTheDocument()
    expect(within(thread).queryByRole('button', { name: 'Quitar la marca' })).not.toBeInTheDocument()
  })

  it('retira una respuesta tras confirmarlo: sale del hilo, el foco va al hilo y, si era la útil, se quita', async () => {
    session = { status: 'ready', account: { id: 5 } }
    getQuestion.mockResolvedValue({ ...QUESTION, usefulAnswerId: 1 })
    listAnswers.mockResolvedValue([{ ...FIRST, mine: true, canRetire: true }, SECOND])
    retireAnswer.mockResolvedValue(null)
    renderQuestion()
    const thread = await loadedThread()

    fireEvent.click(within(thread).getByRole('button', { name: 'Retirar' }))
    expect(screen.getByRole('dialog', { name: '¿Retirar esta respuesta?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    await waitFor(() => expect(within(thread).getAllByRole('article')).toHaveLength(1))
    expect(retireAnswer).toHaveBeenCalledWith(1)
    expect(within(thread).getByRole('heading', { level: 2 })).toHaveFocus()
    expect(within(thread).getByRole('heading', { level: 2 })).toHaveTextContent('1 respuesta')
    expect(screen.queryByRole('region', { name: 'Respuesta útil para quien preguntó' })).not.toBeInTheDocument()
    expect(await screen.findByText('Retiraste tu respuesta.')).toBeInTheDocument()
  })

  it('si una acción falla lo avisa con su causa', async () => {
    session = { status: 'ready', account: { id: 5 } }
    listAnswers.mockResolvedValue([{ ...FIRST, canRetire: true }])
    retireAnswer.mockRejectedValue(new ApiError('x', { status: 403, body: { code: 'ANSWER_CHANGE_FORBIDDEN' } }))
    renderQuestion()
    const thread = await loadedThread()

    fireEvent.click(within(thread).getByRole('button', { name: 'Retirar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    // El error queda junto a la respuesta y el foco vuelve al botón pulsado.
    const [article] = within(thread).getAllByRole('article')
    expect(await within(article).findByRole('alert')).toHaveTextContent('Solo quien publicó esta respuesta o una cuenta del equipo puede retirarla.')
    expect(within(article).getByRole('button', { name: 'Retirar' })).toHaveFocus()
    expect(within(thread).getAllByRole('article')).toHaveLength(1)
  })

  it('si falla retirar la pregunta, el error queda junto al botón y el foco vuelve a él', async () => {
    session = { status: 'ready', account: { id: 9 } }
    getQuestion.mockResolvedValue({ ...QUESTION, canRetire: true })
    retireQuestion.mockRejectedValue(new ApiError('x', { status: 401 }))
    renderQuestion()
    await loadedThread()

    fireEvent.click(screen.getByRole('button', { name: 'Retirar pregunta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión terminó. Inicia sesión de nuevo.')
    expect(screen.getByRole('button', { name: 'Retirar pregunta' })).toHaveFocus()
  })

  it('en el celular el recurso lleva su rótulo, y la respuesta útil se resume recortada', async () => {
    getQuestion.mockResolvedValue({ ...QUESTION, usefulAnswerId: 1 })
    renderQuestion()
    await loadedThread()

    expect(screen.getByText('Sobre el apunte').tagName).toBe('DT')
    expect(screen.getByText('Sobre el apunte')).not.toHaveClass('sr-only')
    const summary = screen.getByRole('region', { name: 'Respuesta útil para quien preguntó' })
    expect(within(summary).getByText(FIRST.body)).toHaveClass('line-clamp-6')
  })

  it('quien preguntó retira la pregunta tras confirmarlo y vuelve al foro del curso con un aviso', async () => {
    session = { status: 'ready', account: { id: 9 } }
    getQuestion.mockResolvedValue({ ...QUESTION, canRetire: true })
    retireQuestion.mockResolvedValue(null)
    listQuestions.mockResolvedValue([])
    renderQuestion()
    await loadedThread()

    fireEvent.click(screen.getByRole('button', { name: 'Retirar pregunta' }))
    expect(screen.getByRole('dialog', { name: '¿Retirar esta pregunta?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sí, retirar' }))

    expect(await screen.findByText('Retiraste la pregunta')).toBeInTheDocument()
    expect(retireQuestion).toHaveBeenCalledWith(7)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Foro de Física de Campos')
    expect(screen.getByText('Retiraste la pregunta').closest('[tabindex="-1"]')).toHaveFocus()
  })

  it('una pregunta retirada dice que ya no está disponible y enlaza al foro de su curso', async () => {
    getQuestion.mockResolvedValue({ id: 7, courseId: 3, retired: true })
    renderQuestion()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Esta pregunta ya no está disponible')
    expect(screen.getByRole('link', { name: 'Volver al foro de Física de Campos' })).toHaveAttribute('href', '/catalogo/cursos/3/foro')
    expect(listAnswers).not.toHaveBeenCalled()
  })

  it('una pregunta que no existe dice que ya no está disponible y enlaza al catálogo', async () => {
    getQuestion.mockRejectedValue(new ApiError('x', { status: 404, body: { code: 'QUESTION_NOT_FOUND' } }))
    renderQuestion()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Esta pregunta ya no está disponible')
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/catalogo')
  })

  it('si falla la carga avisa con una alerta', async () => {
    getQuestion.mockRejectedValue(new ApiError('x', { status: 500 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderQuestion()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la pregunta')
  })
})
