import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import NotFoundPage from './NotFoundPage.jsx'

function Location() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/catalogo" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  afterEach(cleanup)

  it('dice qué dirección no existe y ofrece el catálogo y la entrada', () => {
    renderAt('/catalogo/cursos/calculo-integral')

    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeInTheDocument()
    expect(screen.getByText(/\/catalogo\/cursos\/calculo-integral$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalogo')
    expect(screen.getByRole('link', { name: 'Volver a la entrada' })).toHaveAttribute('href', '/')
  })

  it('buscar abre el catálogo con lo escrito, como el buscador de la entrada', () => {
    renderAt('/no-existe')

    fireEvent.change(screen.getByLabelText('Busca lo que necesitabas'), { target: { value: ' integral definida ' } })
    fireEvent.submit(screen.getByLabelText('Busca lo que necesitabas').form)

    expect(screen.getByTestId('location')).toHaveTextContent('/catalogo?q=integral+definida')
  })

  it('buscar sin escribir nada abre el catálogo entero', () => {
    renderAt('/no-existe')

    fireEvent.submit(screen.getByLabelText('Busca lo que necesitabas').form)

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/catalogo$/)
  })
})
