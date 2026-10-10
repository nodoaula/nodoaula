import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listCoursesWithResources, listResources } from './api.js'
import CourseIndexPage from './CourseIndexPage.jsx'

vi.mock('./api.js', () => ({
  listCoursesWithResources: vi.fn(),
  listResources: vi.fn(),
}))

const DEBOUNCE_MS = 400

const COURSES = [
  { id: 1, name: 'Cálculo Integral' },
  { id: 2, name: 'Física Mecánica' },
]

const RESOURCES = [
  { id: 10, title: 'Series y sucesiones', course: 'Cálculo Integral', resourceType: 'VIDEO', durationSeconds: 4749, topics: ['Series', 'Sucesiones'] },
  { id: 11, title: 'Métodos de integración', course: 'Cálculo Integral', resourceType: 'VIDEO', durationSeconds: 6670, topics: ['Métodos de integración'] },
  { id: 12, title: 'Convergencia', course: 'Cálculo Integral', resourceType: 'DOCUMENT', durationSeconds: null, topics: ['Convergencia'] },
  { id: 20, title: 'Cinemática de partículas', course: 'Física Mecánica', resourceType: 'VIDEO', durationSeconds: 6575, topics: ['Cinemática'] },
]

function renderIndex(path = '/catalogo') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CourseIndexPage />
    </MemoryRouter>,
  )
}

// El callback de setTimeout actualiza estado fuera de un evento de Testing
// Library; sin act() la actualización no se aplica a tiempo.
async function advanceTime(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('CourseIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listCoursesWithResources.mockResolvedValue(COURSES)
    listResources.mockResolvedValue(RESOURCES)
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('muestra una tarjeta por curso, de más a menos recursos, que lleva a la página del curso', async () => {
    renderIndex()
    await advanceTime(0)

    const cards = screen.getAllByRole('link')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveAttribute('href', '/catalogo/cursos/1')
    expect(cards[1]).toHaveAttribute('href', '/catalogo/cursos/2')
    expect(within(cards[0]).getByText('Cálculo Integral')).toBeInTheDocument()
    expect(within(cards[0]).getByText('2 videos · 1 apunte · 3 h de video')).toBeInTheDocument()
    expect(screen.getByText('2 cursos · 4 videos y apuntes organizados por tema')).toBeInTheDocument()
  })

  it('muestra tres temas en la tarjeta y cuenta los demás', async () => {
    renderIndex()
    await advanceTime(0)

    const card = screen.getAllByRole('link')[0]
    expect(within(card).getByText('Convergencia')).toBeInTheDocument()
    expect(within(card).getByText('Métodos de integración')).toBeInTheDocument()
    expect(within(card).getByText('Series')).toBeInTheDocument()
    expect(within(card).queryByText('Sucesiones')).not.toBeInTheDocument()
    expect(within(card).getByText('+1')).toBeInTheDocument()
  })

  it('no busca mientras se sigue escribiendo, y busca en todos los cursos al dejar de teclear', async () => {
    renderIndex()
    await advanceTime(0)
    expect(listResources).toHaveBeenCalledTimes(1)

    const input = screen.getByLabelText('Buscar en todos los cursos')
    fireEvent.change(input, { target: { value: 'ser' } })
    await advanceTime(DEBOUNCE_MS - 100)
    fireEvent.change(input, { target: { value: 'series' } })
    await advanceTime(DEBOUNCE_MS - 100)
    expect(listResources).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Buscando…')).toBeInTheDocument()

    listResources.mockResolvedValue([RESOURCES[0]])
    await advanceTime(100)

    expect(listResources).toHaveBeenLastCalledWith({ q: 'series' })
    expect(screen.getByText('1 resultado para «series» en todos los cursos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Series y sucesiones/ })).toHaveAttribute('href', '/recursos/10')
  })

  it('sin resultados, avisa y permite volver a los cursos', async () => {
    renderIndex()
    await advanceTime(0)

    listResources.mockResolvedValue([])
    fireEvent.change(screen.getByLabelText('Buscar en todos los cursos'), { target: { value: 'nada' } })
    await advanceTime(DEBOUNCE_MS)

    expect(screen.getByText('No hay recursos que coincidan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos los cursos' }))

    expect(screen.getByLabelText('Buscar en todos los cursos')).toHaveValue('')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('llega con la búsqueda escrita desde ?q= y la hace sin esperar', async () => {
    renderIndex('/catalogo?q=series')
    await advanceTime(0)

    expect(screen.getByLabelText('Buscar en todos los cursos')).toHaveValue('series')
    expect(listResources).toHaveBeenCalledWith({ q: 'series' })
  })

  it('lleva una dirección antigua con ?courseId= a la página del curso, sin cargar el índice', async () => {
    function CourseStub() {
      return <p>Página del curso {useParams().courseId}</p>
    }
    render(
      <MemoryRouter initialEntries={['/catalogo?courseId=8']}>
        <Routes>
          <Route path="/catalogo" element={<CourseIndexPage />} />
          <Route path="/catalogo/cursos/:courseId" element={<CourseStub />} />
        </Routes>
      </MemoryRouter>,
    )
    await advanceTime(0)

    expect(screen.getByText('Página del curso 8')).toBeInTheDocument()
    expect(listResources).not.toHaveBeenCalled()
  })

  it('avisa si el catálogo no se pudo cargar', async () => {
    listResources.mockRejectedValue(new Error('caído'))
    renderIndex()
    await advanceTime(0)

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo')
  })
})
