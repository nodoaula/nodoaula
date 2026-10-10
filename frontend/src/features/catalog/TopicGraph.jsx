const COURSE_X = 24
const COURSE_Y = 55
const MIN_RADIUS = 4
const MAX_RADIUS = 9

/**
 * Posición de cada tema en un abanico de 120° a la derecha del curso. Con
 * muchos temas se alternan dos distancias para que los nodos no se pisen. El
 * tamaño es relativo al tema con más recursos del curso, para que uno muy
 * grande no tape la tarjeta.
 */
function layoutTopics(topics) {
  const maxCount = Math.max(...topics.map((topic) => topic.count))
  const lastIndex = Math.max(topics.length - 1, 1)

  return topics.map((topic, index) => {
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
}

/** Mapa de los temas de un curso en la tarjeta del índice. Decorativo: los temas también van escritos. */
export default function TopicGraph({ topics }) {
  const nodes = layoutTopics(topics)

  return (
    <svg viewBox="0 0 132 110" aria-hidden="true" className="-mt-1.5 -mr-1.5 h-27.5 w-33 shrink-0 overflow-visible">
      {nodes.map((node) => (
        <line
          key={node.name}
          x1={COURSE_X}
          y1={COURSE_Y}
          x2={node.x}
          y2={node.y}
          className="stroke-border-strong stroke-[1.2] transition-colors duration-200 group-hover:stroke-accent/45"
        />
      ))}
      {nodes.map((node) => (
        <circle
          key={node.name}
          cx={node.x}
          cy={node.y}
          r={node.radius}
          className={node.shared ? 'fill-content' : 'fill-content-muted'}
        />
      ))}
      <circle cx={COURSE_X} cy={COURSE_Y} r="8" className="fill-accent" />
    </svg>
  )
}
