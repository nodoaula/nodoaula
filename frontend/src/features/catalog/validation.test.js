import { describe, expect, it } from 'vitest'

import { validateCorrection } from './validation.js'

// Historia HU311: la corrección aplica las mismas reglas que el registro.
describe('validateCorrection', () => {
  const video = {
    resourceType: 'VIDEO',
    title: 'Integral definida',
    description: '',
    publishedAt: '2021-02-26',
    durationSeconds: '',
    channel: '',
  }

  it('un video válido no tiene errores', () => {
    expect(validateCorrection(video)).toEqual({})
  })

  it('un video exige título y fecha, y una duración mayor que cero si la tiene', () => {
    expect(validateCorrection({ ...video, title: '', publishedAt: '', durationSeconds: '1.5' })).toEqual({
      title: 'Escribe el título.',
      publishedAt: 'Elige la fecha de publicación.',
      durationSeconds: 'La duración debe ser un número de segundos mayor que cero.',
    })
  })

  it('aplica los mismos límites de longitud que el registro', () => {
    expect(validateCorrection({ ...video, title: 'x'.repeat(301), description: 'x'.repeat(2001), channel: 'x'.repeat(201) })).toEqual({
      title: 'El título no puede tener más de 300 caracteres.',
      description: 'La descripción no puede tener más de 2000 caracteres.',
      channel: 'El canal no puede tener más de 200 caracteres.',
    })
  })

  it('en un apunte no exige ni comprueba fecha, duración ni canal', () => {
    expect(validateCorrection({ ...video, resourceType: 'DOCUMENT', publishedAt: '', durationSeconds: '0', channel: 'x'.repeat(201) })).toEqual({})
    expect(validateCorrection({ ...video, resourceType: 'DOCUMENT', title: '' })).toEqual({ title: 'Escribe el título.' })
  })
})
