import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { listCoursesWithResources, listResources, listTopicsWithResources } from './api.js'
import ResourceCatalogPage from './ResourceCatalogPage.jsx'

// Historia HU207: el cuadro de búsqueda del catálogo dispara la consulta
// sola, con un pequeño retraso tras dejar de teclear (debounce), sin Enter ni
// botón. Estas pruebas cubren ese comportamiento, además del mensaje cuando
// la búsqueda no encuentra nada.
vi.mock('./api.js', () => ({
  listCoursesWithResources: vi.fn(),
  listTopicsWithResources: vi.fn(),
  listResources: vi.fn(),
}))

const DEBOUNCE_MS = 400

function renderCatalogPage() {
  return render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <ResourceCatalogPage />
    </MemoryRouter>,
  )
}

// Envuelve el avance del reloj simulado en act(): el callback de setTimeout
// actualiza estado de React fuera de un evento manejado por Testing Library,
// así que sin este envoltorio la actualización no se aplica a tiempo.
async function advanceTime(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('ResourceCatalogPage - búsqueda de texto (HU207)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listCoursesWithResources.mockResolvedValue([])
    listTopicsWithResources.mockResolvedValue([])
    listResources.mockResolvedValue([])
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('no dispara la búsqueda mientras el usuario sigue escribiendo', async () => {
    renderCatalogPage()
    await advanceTime(0)
    expect(listResources).toHaveBeenCalledTimes(1)

    const input = screen.getByLabelText('Buscar recursos')
    fireEvent.change(input, { target: { value: 'b' } })
    await advanceTime(DEBOUNCE_MS - 100)
    fireEvent.change(input, { target: { value: 'bucles' } })
    await advanceTime(DEBOUNCE_MS - 100)

    // Siguen tecleando: todavía no debió dispararse una segunda consulta.
    expect(listResources).toHaveBeenCalledTimes(1)
  })

  it('dispara la búsqueda con el texto final tras dejar de teclear ~400ms', async () => {
    renderCatalogPage()
    await advanceTime(0)

    const input = screen.getByLabelText('Buscar recursos')
    fireEvent.change(input, { target: { value: 'b' } })
    await advanceTime(100)
    fireEvent.change(input, { target: { value: 'bucles' } })
    await advanceTime(DEBOUNCE_MS)

    expect(listResources).toHaveBeenCalledTimes(2)
    expect(listResources).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'bucles' }),
    )
  })

  it('muestra un mensaje claro cuando la búsqueda no tiene resultados', async () => {
    listResources.mockResolvedValue([])
    renderCatalogPage()
    await advanceTime(0)

    const input = screen.getByLabelText('Buscar recursos')
    fireEvent.change(input, { target: { value: 'texto sin coincidencias' } })
    await advanceTime(DEBOUNCE_MS)

    expect(
      screen.getByText('No hay recursos que coincidan con los filtros elegidos.'),
    ).toBeInTheDocument()
  })
})
