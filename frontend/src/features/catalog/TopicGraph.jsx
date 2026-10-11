import { COURSE_X, COURSE_Y, layoutTopics } from './topicGraphLayout.js'

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
