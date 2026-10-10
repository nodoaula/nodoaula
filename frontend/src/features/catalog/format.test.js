import { describe, expect, it } from 'vitest'

import { formatDuration, formatDurationText, formatPublishedAt, formatResourceType } from './format.js'

describe('formatResourceType', () => {
  it('traduce los tipos conocidos al español', () => {
    expect(formatResourceType('VIDEO')).toBe('Video')
    expect(formatResourceType('DOCUMENT')).toBe('Apunte')
  })

  it('devuelve el valor tal cual si el tipo no está mapeado', () => {
    expect(formatResourceType('OTRO')).toBe('OTRO')
  })
})

describe('formatDuration', () => {
  it('usa minutos:segundos cuando dura menos de una hora', () => {
    expect(formatDuration(65)).toBe('1:05')
  })

  it('agrega la hora cuando dura una hora o más', () => {
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('muestra un guión largo cuando no hay duración', () => {
    expect(formatDuration(null)).toBe('—')
  })
})

describe('formatPublishedAt', () => {
  it('formatea la fecha en español sin desplazarla por zona horaria', () => {
    expect(formatPublishedAt('2026-09-06')).toBe('6 de septiembre de 2026')
  })
})

describe('formatDurationText', () => {
  it('usa horas y minutos cuando dura una hora o más', () => {
    expect(formatDurationText(6011)).toBe('1 h 40 min')
  })

  it('omite los minutos cuando son cero', () => {
    expect(formatDurationText(7200)).toBe('2 h')
  })

  it('usa solo minutos cuando dura menos de una hora', () => {
    expect(formatDurationText(783)).toBe('13 min')
  })

  it('usa segundos cuando dura menos de un minuto', () => {
    expect(formatDurationText(45)).toBe('45 s')
  })
})
