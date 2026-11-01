import { describe, expect, it } from 'vitest'

import { formatMemberCount } from './format.js'

describe('formatMemberCount', () => {
  it('dice que un grupo no tiene miembros en lugar de «0 miembros»', () => {
    expect(formatMemberCount(0)).toBe('Sin miembros')
  })

  it('usa el singular con un miembro y el plural con varios', () => {
    expect(formatMemberCount(1)).toBe('1 miembro')
    expect(formatMemberCount(2)).toBe('2 miembros')
    expect(formatMemberCount(31)).toBe('31 miembros')
  })
})
