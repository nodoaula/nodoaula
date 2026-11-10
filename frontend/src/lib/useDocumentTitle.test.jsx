import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useDocumentTitle } from './useDocumentTitle.js'

function Screen({ title }) {
  useDocumentTitle(title)
  return null
}

describe('useDocumentTitle', () => {
  afterEach(() => {
    document.title = 'NodoAula'
  })

  it('pone el nombre de la pantalla antes del del sitio', () => {
    render(<Screen title="Crear una cuenta" />)
    expect(document.title).toBe('Crear una cuenta · NodoAula')
  })

  it('cambia cuando cambia la pantalla', () => {
    const { rerender } = render(<Screen title="Curso" />)
    rerender(<Screen title="Cálculo Integral" />)
    expect(document.title).toBe('Cálculo Integral · NodoAula')
  })

  it('sin pantalla deja solo el nombre del sitio', () => {
    render(<Screen title={null} />)
    expect(document.title).toBe('NodoAula')
  })

  it('al salir de la pantalla vuelve al nombre del sitio', () => {
    const { unmount } = render(<Screen title="Tu perfil" />)
    unmount()
    expect(document.title).toBe('NodoAula')
  })
})
