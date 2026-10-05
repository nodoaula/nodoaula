import { describe, expect, it } from 'vitest'

import { getYouTubeVideoId, isYouTubeLink, parseYouTubeInput } from './sourcePlatform.js'

const ID = 'dQw4w9WgXcQ'

// Historia HU202: el campo «Enlace» acepta las mismas formas que el backend
// (YouTubeVideoIds): si una cambia, la otra debe cambiar con ella.
describe('parseYouTubeInput', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&t=42`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=10`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    ID,
    `  ${ID}  `,
  ])('reconoce el video en %s', (input) => {
    expect(parseYouTubeInput(input)).toBe(ID)
  })

  it.each([
    '',
    null,
    undefined,
    'https://vimeo.com/76979871',
    `https://ejemplo.com/watch?v=${ID}`,
    'dQw4w9WgXc',
    'dQw4w9WgXcQQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXc',
    'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
    'javascript:alert(1)',
    `youtube.com/watch?v=${ID}`,
  ])('no reconoce un video en %s', (input) => {
    expect(parseYouTubeInput(input)).toBeNull()
  })

  it('no cambia getYouTubeVideoId: el reproductor sigue sin aceptar el identificador suelto', () => {
    expect(getYouTubeVideoId(ID)).toBeNull()
    expect(getYouTubeVideoId(`https://youtu.be/${ID}`)).toBe(ID)
  })
})

describe('isYouTubeLink', () => {
  it('distingue un enlace de YouTube sin video de uno de otra plataforma', () => {
    expect(isYouTubeLink('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw')).toBe(true)
    expect(isYouTubeLink('https://youtu.be/')).toBe(true)
    expect(isYouTubeLink('https://vimeo.com/76979871')).toBe(false)
    expect(isYouTubeLink(ID)).toBe(false)
    expect(isYouTubeLink('javascript:alert(1)')).toBe(false)
  })
})
