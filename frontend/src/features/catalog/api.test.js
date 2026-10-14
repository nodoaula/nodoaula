import { describe, expect, it, vi } from 'vitest'

import { post, put } from '../../lib/apiClient.js'
import { createDocument, updateResource } from './api.js'

vi.mock('../../lib/apiClient.js', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

describe('updateResource', () => {
  const fields = {
    title: 'Integral definida',
    description: '',
    publishedAt: '2021-02-26',
    durationSeconds: '6011',
    channel: '',
    course: 'Cálculo Integral',
    topics: ['Integrales'],
  }

  it('corrige un video con PUT, la duración como número y los opcionales vacíos como null', () => {
    updateResource(24, { resourceType: 'VIDEO', ...fields })

    expect(put).toHaveBeenCalledWith('/resources/24', {
      title: 'Integral definida',
      description: null,
      publishedAt: '2021-02-26',
      durationSeconds: 6011,
      channel: null,
      course: 'Cálculo Integral',
      topics: ['Integrales'],
    })
  })

  it('un video sin duración la envía como null', () => {
    updateResource(24, { resourceType: 'VIDEO', ...fields, durationSeconds: '' })

    expect(put.mock.calls.at(-1)[1].durationSeconds).toBeNull()
  })

  it('un apunte no envía fecha, duración ni canal, que el backend rechaza', () => {
    updateResource(31, { resourceType: 'DOCUMENT', ...fields, description: 'Resumen' })

    expect(put).toHaveBeenLastCalledWith('/resources/31', {
      title: 'Integral definida',
      description: 'Resumen',
      course: 'Cálculo Integral',
      topics: ['Integrales'],
    })
  })
})

describe('createDocument', () => {
  it('envía el archivo y los campos como multipart, con los nombres que espera el backend', () => {
    const file = new File(['%PDF-1.7'], 'notas.pdf', { type: 'application/pdf' })

    createDocument({
      file,
      title: 'Series',
      description: '',
      course: 'Cálculo Integral',
      topics: ['Series', 'Convergencia'],
      rightsDeclared: true,
    })

    const [path, form, options] = post.mock.calls[0]
    expect(path).toBe('/resources/documents')
    expect(form.get('file')).toBeInstanceOf(File)
    expect(form.get('file').name).toBe('notas.pdf')
    expect(form.get('title')).toBe('Series')
    expect(form.has('description')).toBe(false)
    expect(form.get('course')).toBe('Cálculo Integral')
    expect(form.getAll('topics')).toEqual(['Series', 'Convergencia'])
    expect(form.get('rightsDeclared')).toBe('true')
    expect(options.attemptTimeoutMs).toBe(options.totalTimeoutMs)
    expect(options.attemptTimeoutMs).toBeGreaterThanOrEqual(5 * 60_000)
  })
})
