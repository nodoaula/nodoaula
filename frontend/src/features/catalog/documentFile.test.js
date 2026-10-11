import { describe, expect, it } from 'vitest'

import { isPdf, MAX_DOCUMENT_BYTES, titleFromFileName } from './documentFile.js'

describe('documentFile', () => {
  it('reconoce un PDF por su tipo o por su extensión', () => {
    expect(isPdf({ name: 'notas', type: 'application/pdf' })).toBe(true)
    expect(isPdf({ name: 'notas.PDF', type: '' })).toBe(true)
    expect(isPdf({ name: 'notas.docx', type: 'application/msword' })).toBe(false)
  })

  it('el límite son 20 MB', () => {
    expect(MAX_DOCUMENT_BYTES).toBe(20971520)
  })

  it.each([
    ['series-y-sucesiones.pdf', 'Series y sucesiones'],
    ['integracion_por_partes.PDF', 'Integracion por partes'],
    ['Circuito RC - Constante de tiempo.pdf', 'Circuito RC - Constante de tiempo'],
    ['  parcial  2 .pdf', 'Parcial 2'],
  ])('propone el título de «%s»', (name, title) => {
    expect(titleFromFileName(name)).toBe(title)
  })
})
