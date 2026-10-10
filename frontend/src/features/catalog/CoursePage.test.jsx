import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listResources } from './api.js'
import CoursePage from './CoursePage.jsx'

vi.mock('./api.js', () => ({
  listResources: vi.fn(),
}))

const DEBOUNCE_MS = 400

const RESOURCES = [
  { id: 10, title: 'Series y sucesiones', course: 'Cálculo Integral', resourceType: 'VIDEO', durationSeconds: 4749, topics: ['Series', 'Sucesiones'] },
  { id: 11, title: 'Métodos de integración', course: 'Cálculo Integral', resourceType: 'VIDEO', durationSeconds: 6670, topics: ['Métodos de integración'] },
  { id: 12, title: 'Apunte de series', course: 'Cálculo Integral', resourceType: 'DOCUMENT', durationSeconds: null, topics: ['Series'] },
]

function renderCourse(courseId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/cursos/${courseId}`]}>
      <Routes>
        <Route path="/catalogo/cursos/:courseId" element={<CoursePage />} />
      </Routes>
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

function listedTitles() {
  const list = screen.getByRole('list', { name: 'Recursos del curso' })
  return within(list)
    .getAllByRole('link')
    .map((link) => RESOURCES.find((resource) => link.textContent.includes(resource.title)).title)
}

describe('CoursePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listResources.mockResolvedValue(RESOURCES)
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('muestra el curso con su resumen, la ruta de vuelta y todos sus recursos', async () => {
    renderCourse()
    await advanceTime(0)

    expect(listResources).toHaveBeenCalledWith({ courseIds: ['1'] })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cálculo Integral')
    expect(screen.getByText('2 videos · 1 apunte · 3 h de video · 3 temas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/catalogo')
    expect(screen.getByText('3 recursos')).toBeInTheDocument()
    expect(listedTitles()).toHaveLength(3)
  })

  it('ordena los temas de más a menos recursos, con su número', async () => {
    renderCourse()
    await advanceTime(0)

    const topics = within(screen.getByRole('group', { name: 'Temas' })).getAllByRole('button')
    expect(topics.map((button) => button.textContent)).toEqual(['Todos', 'Series2', 'Métodos de integración1', 'Sucesiones1'])
  })

  it('filtra por tipo', async () => {
    renderCourse()
    await advanceTime(0)

    fireEvent.click(screen.getByRole('button', { name: 'Apuntes' }))

    expect(screen.getByRole('button', { name: 'Apuntes' })).toHaveAttribute('aria-pressed', 'true')
    expect(listedTitles()).toEqual(['Apunte de series'])
    expect(screen.getByText('1 recurso coincide')).toBeInTheDocument()
  })

  it('combina varios temas con O, y «Todos» quita la selección', async () => {
    renderCourse()
    await advanceTime(0)

    fireEvent.click(screen.getByRole('button', { name: /^Sucesiones/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Métodos de integración/ }))
    expect(listedTitles()).toEqual(['Series y sucesiones', 'Métodos de integración'])

    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(listedTitles()).toHaveLength(3)
  })

  it('busca solo en el curso al dejar de teclear, y combina la búsqueda con el tipo', async () => {
    renderCourse()
    await advanceTime(0)

    listResources.mockResolvedValue([RESOURCES[0], RESOURCES[2]])
    fireEvent.change(screen.getByLabelText('Buscar en Cálculo Integral'), { target: { value: 'series' } })
    await advanceTime(DEBOUNCE_MS - 100)
    expect(listResources).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Buscando…')).toBeInTheDocument()

    await advanceTime(100)
    expect(listResources).toHaveBeenLastCalledWith({ q: 'series', courseIds: ['1'] })
    expect(listedTitles()).toEqual(['Series y sucesiones', 'Apunte de series'])

    fireEvent.click(screen.getByRole('button', { name: 'Videos' }))
    expect(listedTitles()).toEqual(['Series y sucesiones'])
  })

  it('si nada coincide, avisa y «Quitar filtros» vuelve a mostrar todo', async () => {
    renderCourse()
    await advanceTime(0)

    fireEvent.click(screen.getByRole('button', { name: 'Apuntes' }))
    fireEvent.click(screen.getByRole('button', { name: /^Métodos de integración/ }))
    expect(screen.getByText('Ningún recurso de Cálculo Integral coincide')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(listedTitles()).toHaveLength(3)
  })

  it('dice que el curso no se encontró si no tiene recursos', async () => {
    listResources.mockResolvedValue([])
    renderCourse('999')
    await advanceTime(0)

    expect(screen.getByText('Curso no encontrado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute('href', '/catalogo')
  })

  it('no consulta el servidor si la dirección no trae un número', async () => {
    renderCourse('abc')
    await advanceTime(0)

    expect(listResources).not.toHaveBeenCalled()
    expect(screen.getByText('Curso no encontrado')).toBeInTheDocument()
  })

  it('avisa si el curso no se pudo cargar', async () => {
    listResources.mockRejectedValue(new Error('caído'))
    renderCourse()
    await advanceTime(0)

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el curso')
  })
})
