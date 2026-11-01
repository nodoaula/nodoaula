import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { listCoursesWithResources, listResources } from '../catalog/api.js'
import LandingPage from './LandingPage.jsx'

vi.mock('../catalog/api.js', () => ({
  listCoursesWithResources: vi.fn(),
  listResources: vi.fn(),
}))

let session = { status: 'ready', account: null }
vi.mock('../../session/useSession.js', () => ({ useSession: () => session }))
vi.mock('../../session/useLogout.js', () => ({
  useLogout: () => ({ loggingOut: false, logoutFailed: false, handleLogout: vi.fn() }),
}))

const DEBOUNCE_MS = 400

const COURSES = [
  { id: 1, name: 'Física de Campos' },
  { id: 2, name: 'Cálculo Integral' },
  { id: 3, name: 'Gestión de proyectos' },
]

const video = (id, title, course, topics) => ({ id, title, course, resourceType: 'VIDEO', durationSeconds: 600, pageCount: null, topics })
const note = (id, title, course, topics) => ({ id, title, course, resourceType: 'DOCUMENT', durationSeconds: null, pageCount: 7, topics })

const RESOURCES = [
  video(1, 'Campo eléctrico', 'Física de Campos', ['Electroestática']),
  note(2, 'Ejercicio circuito RC', 'Física de Campos', ['Circuitos RC']),
  video(3, 'Capacitores', 'Física de Campos', ['Capacitancia']),
  video(5, 'Integral definida e indefinida', 'Cálculo Integral', ['Integral definida']),
  video(6, 'Series y sucesiones', 'Cálculo Integral', ['Series']),
  video(7, 'Métodos de integración', 'Cálculo Integral', ['Integral definida', 'Métodos de integración']),
  video(8, '¿Qué es Scrum?', 'Gestión de proyectos', ['Scrum']),
]

function Location() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function renderLoaded() {
  renderLanding()
  await screen.findByRole('button', { name: /Todos los cursos/ })
}

async function advanceTime(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

// jsdom junta los fragmentos del nombre sin espacios; Chrome lee «Cálculo Integral, 3 recursos».
const counted = (name, count) => new RegExp(`^${name},\\s*${count}\\s*recursos?$`)
const coursesGroup = () => within(screen.getByRole('list', { name: 'O escoge tu curso' }))
const graph = () => within(screen.getByRole('figure'))
const results = (title) => screen.getByRole('heading', { level: 2, name: title }).closest('section')

beforeAll(() => {
  // jsdom no trae estas APIs del navegador; la página funciona sin ellas.
  window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })
  window.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= () => {}
})

beforeEach(() => {
  listResources.mockImplementation(({ q } = {}) =>
    Promise.resolve(q ? RESOURCES.filter((resource) => resource.title.toLowerCase().includes(q.toLowerCase())) : RESOURCES),
  )
  listCoursesWithResources.mockResolvedValue(COURSES)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  session = { status: 'ready', account: null }
})

describe('LandingPage', () => {
  it('ofrece todos los cursos y los que tienen más recursos, con lo que tiene cada uno', async () => {
    await renderLoaded()

    expect(coursesGroup().getByRole('button', { name: counted('Todos los cursos', 7) })).toHaveAttribute('aria-pressed', 'true')
    expect(coursesGroup().getByRole('button', { name: counted('Física de Campos', 3) })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('link', { name: 'Ver los demás cursos →' })).toHaveAttribute('href', '/catalogo')
  })

  it('la gráfica parte de todos los cursos y cada curso lleva a sus temas', async () => {
    await renderLoaded()

    expect(graph().getByRole('link', { name: /Todos los cursos/ })).toHaveAttribute('href', '/catalogo')
    fireEvent.click(graph().getByRole('button', { name: counted('Cálculo Integral', 3) }))

    expect(coursesGroup().getByRole('button', { name: counted('Cálculo Integral', 3) })).toHaveAttribute('aria-pressed', 'true')
    expect(graph().getByRole('link', { name: /Cálculo Integral/ })).toHaveAttribute('href', '/catalogo/cursos/2')
    expect(graph().getByRole('button', { name: counted('Integral definida', 2) })).toBeInTheDocument()
  })

  it('muestra una muestra de cursos distintos que incluye un apunte', async () => {
    await renderLoaded()

    expect(screen.getByRole('heading', { level: 2, name: 'Una muestra del catálogo' })).toBeInTheDocument()
    const links = within(results('Una muestra del catálogo')).getAllByRole('link').filter((link) => link.getAttribute('href').startsWith('/recursos/'))
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/recursos/2', '/recursos/5', '/recursos/8'])
    expect(within(results('Una muestra del catálogo')).getByRole('link', { name: 'Ver todo el catálogo →' })).toHaveAttribute('href', '/catalogo')
  })

  it('al escoger un curso, abajo salen sus recursos y se puede bajar a ellos', async () => {
    await renderLoaded()

    fireEvent.click(coursesGroup().getByRole('button', { name: counted('Física de Campos', 3) }))

    expect(screen.getByRole('heading', { level: 2, name: 'Física de Campos' })).toBeInTheDocument()
    expect(within(results('Física de Campos')).getByText('3 recursos en este curso')).toBeInTheDocument()
    expect(within(results('Física de Campos')).getByRole('link', { name: 'Abrir el curso →' })).toHaveAttribute('href', '/catalogo/cursos/1')

    const goDown = screen.getByRole('button', { name: /Ver los 3 recursos de Física de Campos/ })
    fireEvent.click(goDown)
    expect(screen.getByRole('heading', { level: 2, name: 'Física de Campos' })).toHaveFocus()
  })

  it('el nodo de la gráfica resume videos y apuntes, sin las horas de video', async () => {
    await renderLoaded()
    expect(graph().getByText('6 videos · 1 apunte')).toBeInTheDocument()

    fireEvent.click(coursesGroup().getByRole('button', { name: counted('Física de Campos', 3) }))
    expect(graph().getByText('2 videos · 1 apunte')).toBeInTheDocument()
  })

  it('enseña cuatro recursos del curso y lleva a ver todos', async () => {
    const series = [1, 2, 3, 4, 5].map((id) => video(id, `Clase ${id}`, 'Cálculo Integral', ['Series']))
    listResources.mockResolvedValue(series)
    await renderLoaded()

    fireEvent.click(coursesGroup().getByRole('button', { name: counted('Cálculo Integral', 5) }))

    const section = results('Cálculo Integral')
    expect(within(section).getAllByRole('listitem')).toHaveLength(4)
    expect(within(section).getByRole('link', { name: 'Ver los 5 del curso →' })).toHaveAttribute('href', '/catalogo/cursos/2')
  })

  it('si los temas no caben en la gráfica, cuenta los demás y lleva al curso', async () => {
    const topics = Array.from({ length: 8 }, (_, index) => `Tema ${index + 1}`)
    listResources.mockResolvedValue(topics.map((topic, index) => video(index + 1, `Clase ${index + 1}`, 'Cálculo Integral', [topic])))
    await renderLoaded()

    fireEvent.click(coursesGroup().getByRole('button', { name: counted('Cálculo Integral', 8) }))

    expect(graph().getByRole('link', { name: '+ 2 temas más' })).toHaveAttribute('href', '/catalogo/cursos/2')
  })

  it('un tema filtra los recursos del curso, y pulsarlo otra vez lo quita', async () => {
    await renderLoaded()
    fireEvent.click(coursesGroup().getByRole('button', { name: counted('Cálculo Integral', 3) }))

    fireEvent.click(graph().getByRole('button', { name: counted('Integral definida', 2) }))

    // La gráfica se monta de nuevo en cada cambio: hay que volver a buscar el botón.
    expect(graph().getByRole('button', { name: counted('Integral definida', 2) })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 2, name: 'Cálculo Integral\u00a0· Integral definida' })).toBeInTheDocument()
    const hrefs = within(results('Cálculo Integral\u00a0· Integral definida')).getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/catalogo/cursos/2?topic=Integral+definida', '/recursos/5', '/recursos/7'])

    fireEvent.click(graph().getByRole('button', { name: counted('Integral definida', 2) }))
    expect(screen.getByRole('heading', { level: 2, name: 'Cálculo Integral' })).toBeInTheDocument()
  })

  it('el buscador sugiere cursos y temas, y escoger uno cambia la gráfica', async () => {
    await renderLoaded()

    const search = screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' })
    fireEvent.change(search, { target: { value: 'integral calculo' } })

    const option = screen.getByRole('option', { name: /^Cálculo Integral/ })
    fireEvent.mouseDown(option)

    expect(coursesGroup().getByRole('button', { name: counted('Cálculo Integral', 3) })).toHaveAttribute('aria-pressed', 'true')
    expect(search).toHaveValue('')
  })

  it('el buscador sugiere videos y apuntes del catálogo, y lleva a su ficha o a todos los resultados', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()

    const search = screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' })
    fireEvent.change(search, { target: { value: 'series' } })
    await advanceTime(DEBOUNCE_MS)

    expect(listResources).toHaveBeenCalledWith({ courseId: undefined, q: 'series' })
    expect(await screen.findByRole('option', { name: /Series y sucesiones/ })).toHaveTextContent('Video · Cálculo Integral')
    expect(screen.getByRole('option', { name: 'Ver el resultado en el catálogo' })).toBeInTheDocument()

    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByTestId('location')).toHaveTextContent('/catalogo?q=series')
  })

  it('con las flechas se escoge un recurso sugerido y Enter abre su ficha', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()

    const search = screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' })
    fireEvent.change(search, { target: { value: 'scrum' } })
    await advanceTime(DEBOUNCE_MS)
    await screen.findByRole('option', { name: /¿Qué es Scrum\?/ })

    // Primero el tema «Scrum», luego el video.
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(search).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /¿Qué es Scrum\?/ }).id)

    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByTestId('location')).toHaveTextContent('/recursos/8')
  })

  it('mientras se sigue escribiendo no sugiere los recursos de lo escrito antes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()

    const search = screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' })
    fireEvent.change(search, { target: { value: 'series' } })
    await advanceTime(DEBOUNCE_MS)
    await screen.findByRole('option', { name: /Series y sucesiones/ })

    fireEvent.change(search, { target: { value: 'seriesz' } })
    expect(screen.queryByRole('option', { name: /Series y sucesiones/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/No encontramos nada/)).not.toBeInTheDocument()

    await advanceTime(DEBOUNCE_MS)
    expect(await screen.findByText(/No encontramos nada con «seriesz»/)).toBeInTheDocument()
  })

  it('el grupo de recursos se titula por los que enseña, no por todos los resultados', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    listResources.mockResolvedValue([
      video(11, 'Repaso uno', 'Física de Campos', []),
      video(12, 'Repaso dos', 'Cálculo Integral', []),
      video(13, 'Repaso tres', 'Gestión de proyectos', []),
      note(14, 'Repaso cuatro', 'Física de Campos', []),
    ])
    await renderLoaded()

    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' }), { target: { value: 'repaso' } })
    await advanceTime(DEBOUNCE_MS)
    await screen.findByRole('option', { name: /Repaso uno/ })

    expect(screen.getByText('Videos', { selector: '[role=presentation]' })).toBeInTheDocument()
    expect(screen.queryByText('Videos y apuntes')).not.toBeInTheDocument()
  })

  it('si no encuentra nada lo dice y ofrece ver todos los cursos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderLoaded()

    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' }), { target: { value: 'zzz' } })
    await advanceTime(DEBOUNCE_MS)

    expect(await screen.findByText(/No encontramos nada con «zzz»/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver todos los cursos →' })).toHaveAttribute('href', '/catalogo')
  })

  it('sin sesión dice qué se hace sin cuenta y con ella, y ofrece crearla', async () => {
    await renderLoaded()

    expect(screen.getByRole('heading', { level: 2, name: '¿Necesito una cuenta?' })).toBeInTheDocument()
    const close = within(screen.getByRole('region', { name: /¿Tienes apuntes/ }))
    expect(close.getByRole('link', { name: 'Crear cuenta gratis' })).toHaveAttribute('href', '/registro')
    expect(close.getByRole('link', { name: 'Ya tengo cuenta' })).toHaveAttribute('href', '/iniciar-sesion')
  })

  it('con sesión no habla de la cuenta y ofrece aportar', async () => {
    session = { status: 'ready', account: { id: 7, email: 'aporte@ejemplo.com' } }
    await renderLoaded()

    expect(screen.queryByRole('heading', { name: '¿Necesito una cuenta?' })).not.toBeInTheDocument()
    const close = within(screen.getByRole('region', { name: /¿Tienes apuntes/ }))
    expect(close.getByRole('link', { name: 'Subir un apunte' })).toHaveAttribute('href', '/subir-apunte')
    expect(close.getByRole('link', { name: 'Compartir un video' })).toHaveAttribute('href', '/registrar-recurso')
  })

  it('si el catálogo no carga lo dice, y el buscador sigue llevando al catálogo', async () => {
    listResources.mockRejectedValue(new Error('caído'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderLanding()

    expect(await screen.findByText(/No se pudieron cargar los cursos/)).toBeInTheDocument()
    const search = screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' })
    fireEvent.change(search, { target: { value: 'series' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(screen.getByTestId('location')).toHaveTextContent('/catalogo?q=series')
    consoleError.mockRestore()
  })

  // Lo de abajo no se pinta hasta que responde el catálogo: así no salta cuando llega.
  it('mientras carga el catálogo solo enseña el titular y el buscador', () => {
    listResources.mockReturnValue(new Promise(() => {}))
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Buscar cursos, temas, videos y apuntes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '¿De dónde sale el contenido?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })

  it('los encabezados siguen su orden: uno de nivel 1 y los demás de nivel 2 y 3', async () => {
    await renderLoaded()

    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName[1]))
    expect(levels[0]).toBe(1)
    expect(levels.filter((level) => level === 1)).toHaveLength(1)
    levels.forEach((level, index) => {
      if (index > 0) expect(level - levels[index - 1]).toBeLessThanOrEqual(1)
    })
  })
})
