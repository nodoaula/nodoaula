import { describe, expect, it } from 'vitest'

import { resolveEntryMethod } from './entryMethod.js'

// Historia HU202: la vía de ingreso que se envía al publicar.
describe('resolveEntryMethod', () => {
  const snapshot = {
    title: 'Azure DevOps',
    publishedAt: '2026-09-06',
    durationSeconds: '2371',
    channel: 'Fábrica Escuela',
  }

  const insertedForm = {
    title: 'Azure DevOps',
    description: '',
    publishedAt: '2026-09-06',
    durationSeconds: '2371',
    channel: 'Fábrica Escuela',
  }

  it('sin ninguna inserción el registro es manual', () => {
    expect(resolveEntryMethod(null, insertedForm)).toBe('MANUAL')
    expect(resolveEntryMethod(undefined, insertedForm)).toBe('MANUAL')
  })

  it('con los valores insertados intactos es automático', () => {
    expect(resolveEntryMethod(snapshot, insertedForm)).toBe('AUTOMATIC')
  })

  it('basta un campo que conserve su valor insertado para seguir siendo automático', () => {
    const form = { ...insertedForm, title: 'Otro título', publishedAt: '', durationSeconds: '60', channel: '' }
    expect(resolveEntryMethod(snapshot, { ...form, channel: 'Fábrica Escuela' })).toBe('AUTOMATIC')
  })

  it('si se borran o editan todos los campos insertados vuelve a ser manual', () => {
    const form = { title: 'Otro título', description: '', publishedAt: '', durationSeconds: '60', channel: 'Otro' }
    expect(resolveEntryMethod(snapshot, form)).toBe('MANUAL')
  })

  it('solo cuentan los campos insertados con valor: escribir en uno que YouTube no trajo no lo hace automático', () => {
    // La descripción no está en la instantánea porque YouTube no la trajo.
    const form = { title: 'x', description: 'escrita a mano', publishedAt: '', durationSeconds: '', channel: '' }
    expect(resolveEntryMethod(snapshot, form)).toBe('MANUAL')
  })

  it('compara sin los espacios de los extremos', () => {
    const form = { title: '  Azure DevOps  ', publishedAt: '', durationSeconds: '', channel: '' }
    expect(resolveEntryMethod(snapshot, form)).toBe('AUTOMATIC')
  })

  it('una inserción sin ningún campo con valor deja el registro manual', () => {
    expect(resolveEntryMethod({}, insertedForm)).toBe('MANUAL')
  })
})
