import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SERVER_STATUS } from './serverStatus.js'
import ServerWakeScreen from './ServerWakeScreen.jsx'

function prefersReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: reduce && query.includes('reduce'), media: query }))
}

// Los temas de la gráfica se reconocen por su altura en el dibujo.
const glowHeights = () => screen.queryAllByTestId('senal').map((glow) => glow.getAttribute('cy'))

describe('ServerWakeScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    prefersReducedMotion(false)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('mientras despierta explica la espera y cuenta el tiempo que lleva', () => {
    render(<ServerWakeScreen status={SERVER_STATUS.STARTING} onRetry={vi.fn()} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Despertando NodoAula' })).toBeInTheDocument()
    expect(screen.getByText(/se duerme cuando nadie lo usa/)).toBeInTheDocument()
    expect(screen.getByText('Lleva 0:00')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(65_000))
    expect(screen.getByText('Lleva 1:05')).toBeInTheDocument()
    expect(screen.queryByText(/más de lo normal/)).not.toBeInTheDocument()
  })

  it('pasados los tres minutos de siempre avisa de que tarda más de lo normal', () => {
    render(<ServerWakeScreen status={SERVER_STATUS.STARTING} onRetry={vi.fn()} />)

    act(() => vi.advanceTimersByTime(179_000))
    expect(screen.queryByText(/más de lo normal/)).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(/Está tardando más de lo normal/)).toBeInTheDocument()
  })

  it('si no responde lo avisa con una alerta y deja volver a intentarlo', () => {
    const onRetry = vi.fn()
    render(<ServerWakeScreen status={SERVER_STATUS.UNREACHABLE} onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos despertar el servidor')
    fireEvent.click(screen.getByRole('button', { name: 'Volver a intentarlo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('las señales van a temas al azar, sin repetir el mismo dos veces seguidas', () => {
    // Cada salida pide un tema y luego la espera hasta la siguiente.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // primer tema: el de arriba
      .mockReturnValueOnce(0) // espera mínima
      .mockReturnValueOnce(0) // el mismo tema otra vez: se descarta
      .mockReturnValueOnce(0.99) // el de abajo
      .mockReturnValue(0)
    render(<ServerWakeScreen status={SERVER_STATUS.STARTING} onRetry={vi.fn()} />)

    expect(glowHeights()).toEqual([])
    act(() => vi.advanceTimersByTime(1300))
    expect(glowHeights()).toEqual(['16'])
    act(() => vi.advanceTimersByTime(500))
    expect(glowHeights()).toEqual(['16', '184'])
  })

  it('con la pestaña oculta no lanza señales', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    render(<ServerWakeScreen status={SERVER_STATUS.STARTING} onRetry={vi.fn()} />)

    act(() => vi.advanceTimersByTime(10_000))
    expect(glowHeights()).toEqual([])
  })

  it('con menos movimiento no lanza señales', () => {
    prefersReducedMotion(true)
    render(<ServerWakeScreen status={SERVER_STATUS.STARTING} onRetry={vi.fn()} />)

    act(() => vi.advanceTimersByTime(10_000))
    expect(glowHeights()).toEqual([])
  })
})
