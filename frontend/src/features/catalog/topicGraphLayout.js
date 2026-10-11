export const COURSE_X = 24
export const COURSE_Y = 55
const MIN_RADIUS = 4
const MAX_RADIUS = 9
// Espacio mínimo entre los bordes de dos temas, en unidades del dibujo.
export const MIN_GAP = 3

/**
 * Posición y tamaño de cada tema en un abanico de 120° a la derecha del
 * curso. Con muchos temas se alternan dos distancias. El tamaño es relativo al
 * tema con más recursos del curso, para que uno muy grande no tape la tarjeta.
 */
export function layoutTopics(topics) {
  const maxCount = Math.max(...topics.map((topic) => topic.count))
  const lastIndex = Math.max(topics.length - 1, 1)

  const nodes = topics.map((topic, index) => {
    const angle = topics.length === 1 ? 0 : ((-60 + (120 * index) / lastIndex) * Math.PI) / 180
    let distance = 72
    if (topics.length > 7) distance = index % 2 === 0 ? 90 : 52
    const scale = maxCount > 1 ? (topic.count - 1) / (maxCount - 1) : 0

    return {
      name: topic.name,
      x: COURSE_X + distance * Math.cos(angle),
      y: COURSE_Y + distance * Math.sin(angle) * 0.6,
      radius: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * scale,
      shared: topic.count > 1,
    }
  })

  return fitRadii(nodes)
}

// Si dos temas quedarían a menos de MIN_GAP, todos los radios se reducen en
// la misma proporción: así ninguno pisa a otro y los tamaños siguen diciendo
// qué tema tiene más recursos.
function fitRadii(nodes) {
  let factor = 1
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      const room = Math.hypot(a.x - b.x, a.y - b.y) - MIN_GAP
      factor = Math.min(factor, room / (a.radius + b.radius))
    }
  }
  return nodes.map((node) => ({ ...node, radius: node.radius * factor }))
}
