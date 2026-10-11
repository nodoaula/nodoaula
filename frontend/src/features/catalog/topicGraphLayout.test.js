import { describe, expect, it } from 'vitest'

import { layoutTopics, MIN_GAP } from './topicGraphLayout.js'

function topics(...counts) {
  return counts.map((count, index) => ({ name: `Tema ${index}`, count }))
}

function smallestGap(nodes) {
  let gap = Infinity
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      gap = Math.min(gap, Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius)
    }
  }
  return gap
}

describe('layoutTopics', () => {
  it.each([
    ['Física de Campos, el caso que se veía amontonado', [3, 3, 2, 2, 2, 1, 1]],
    ['siete temas con el máximo', [5, 5, 5, 5, 5, 5, 5]],
    ['doce temas, con dos distancias', [4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1]],
  ])('%s: ningún tema queda a menos del espacio mínimo de otro', (_, counts) => {
    expect(smallestGap(layoutTopics(topics(...counts)))).toBeGreaterThanOrEqual(MIN_GAP - 1e-9)
  })

  it('los tamaños siguen ordenados por número de recursos', () => {
    const radii = layoutTopics(topics(3, 3, 2, 2, 2, 1, 1)).map((node) => node.radius)

    expect(radii[0]).toBe(radii[1])
    expect(radii[1]).toBeGreaterThan(radii[2])
    expect(radii[4]).toBeGreaterThan(radii[5])
  })

  it('un curso con espacio de sobra no cambia: un tema grande y varios pequeños', () => {
    const radii = layoutTopics(topics(2, 1, 1, 1, 1, 1, 1, 1, 1)).map((node) => node.radius)

    expect(radii[0]).toBe(9)
    expect(radii.slice(1).every((radius) => radius === 4)).toBe(true)
  })
})
