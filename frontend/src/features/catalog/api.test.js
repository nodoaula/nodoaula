import { describe, expect, it, vi } from 'vitest'

import { post } from '../../lib/apiClient.js'
import { createDocument } from './api.js'

vi.mock('../../lib/apiClient.js', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

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
