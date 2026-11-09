import { useEffect, useState } from 'react'

import { buttonClasses } from '../components/ui/button.js'
import Logo from '../components/ui/Logo.jsx'
import { SERVER_STATUS } from './serverStatus.js'

// El mapa que se dibuja mientras despierta el servidor: NodoAula, tres cursos
// y dos temas por curso, en las coordenadas del dibujo (324 × 200).
const ROOT = [24, 100]
const COURSES = [
  [150, 40],
  [150, 100],
  [150, 160],
]
const TOPICS = [
  [300, 16],
  [300, 52],
  [300, 82],
  [300, 118],
  [300, 148],
  [300, 184],
]
const courseOf = (topic) => COURSES[Math.floor(topic / 2)]
const curveTo = ([x1, y1], [x2, y2]) => `C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`
const edge = (from, to) => `M${from[0]} ${from[1]} ${curveTo(from, to)}`
const route = (topic) => `${edge(ROOT, courseOf(topic))} ${curveTo(courseOf(topic), TOPICS[topic])}`

// La primera señal sale cuando el mapa ya terminó de dibujarse.
const FIRST_SIGNAL_MS = 1300
// Las que pueden estar en camino o con su tema encendido a la vez: la más
// vieja sale de la lista cuando ya terminó su animación.
const MAX_SIGNALS = 6

/**
 * Pantalla mientras el servidor despierta del arranque en frío, o si no llega
 * a contestar. Se pinta antes que el resto de la aplicación, sin sesión ni
 * rutas, por eso la cabecera solo lleva el logotipo.
 */
export default function ServerWakeScreen({ status, onRetry }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-content">
      <div className="border-b border-border">
        <header className="mx-auto flex h-18 max-w-page items-center px-4 sm:px-6">
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <Logo />
            NodoAula
          </span>
        </header>
      </div>
      <main className="grid flex-1 place-items-center px-4 pt-12 pb-30 sm:px-6">
        {status === SERVER_STATUS.UNREACHABLE ? <Unreachable onRetry={onRetry} /> : <Waking />}
      </main>
    </div>
  )
}

const TITLE = 'mt-7 text-[1.875rem] leading-[1.15] font-semibold tracking-tight text-balance'
const TEXT = 'mt-3 text-base leading-[1.55] text-pretty text-content-muted'

function Waking() {
  const seconds = useElapsedSeconds()
  return (
    <div className="flex max-w-130 flex-col items-center text-center">
      <WakeGraph />
      <h1 className={TITLE}>Despertando NodoAula</h1>
      <p className={TEXT}>
        El servidor es gratuito y se duerme cuando nadie lo usa. Tarda unos tres minutos en despertar, y esta página se
        abre sola en cuanto conteste.
      </p>
      {/* Sin región viva: un lector de pantalla leería cada segundo. */}
      <p className="mt-4 font-mono text-label text-content-muted tabular-nums">
        Lleva {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </p>
    </div>
  )
}

function Unreachable({ onRetry }) {
  return (
    <div role="alert" className="flex max-w-130 flex-col items-center text-center">
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-surface-hover text-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
          <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.01M3 3l18 18" />
        </svg>
      </span>
      <h1 className={TITLE}>No pudimos despertar el servidor</h1>
      <p className={TEXT}>El servidor no contestó. Puede estar caído o puede fallar tu conexión.</p>
      <button type="button" onClick={onRetry} className={`${buttonClasses('primary')} mt-6`}>
        Volver a intentarlo
      </button>
    </div>
  )
}

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSeconds((count) => count + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return seconds
}

// Cada señal va a un tema al azar, distinto del anterior, y la siguiente sale
// tras una espera también al azar: así el mapa nunca repite un patrón. Con
// menos movimiento no sale ninguna.
function useRandomSignals() {
  const [signals, setSignals] = useState([])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    let last = -1
    let id = 0
    let timer

    function launch() {
      if (!document.hidden) {
        let topic
        do {
          topic = Math.floor(Math.random() * TOPICS.length)
        } while (topic === last)
        last = topic
        id += 1
        const signal = { id, topic }
        setSignals((current) => [...current.slice(1 - MAX_SIGNALS), signal])
      }
      timer = setTimeout(launch, 500 + Math.random() * 1300)
    }

    timer = setTimeout(launch, FIRST_SIGNAL_MS)
    return () => clearTimeout(timer)
  }, [])

  return signals
}

const NODE = '[transform-box:fill-box] origin-center motion-safe:animate-pop'
const EDGE = 'stroke-border-strong [stroke-dasharray:1] [stroke-width:1.5] motion-safe:animate-draw'

function WakeGraph() {
  const signals = useRandomSignals()
  return (
    <div aria-hidden="true" className="relative h-50 w-81">
      <svg viewBox="0 0 324 200" fill="none" className="block size-full">
        {COURSES.map((course, i) => (
          <path key={`c${i}`} d={edge(ROOT, course)} pathLength="1" className={EDGE} style={{ animationDelay: `${0.15 + i * 0.1}s` }} />
        ))}
        {TOPICS.map((topic, j) => (
          <path key={`t${j}`} d={edge(courseOf(j), topic)} pathLength="1" className={EDGE} style={{ animationDelay: `${0.55 + j * 0.07}s` }} />
        ))}
        <circle cx={ROOT[0]} cy={ROOT[1]} r="15" className="stroke-accent/45 [stroke-width:1.5]" />
        <circle
          cx={ROOT[0]}
          cy={ROOT[1]}
          r="10"
          className="stroke-accent opacity-0 [stroke-width:1.5] [transform-box:fill-box] origin-center motion-safe:animate-pulse-ring"
        />
        <circle cx={ROOT[0]} cy={ROOT[1]} r="10" className="fill-accent" />
        {COURSES.map(([cx, cy], i) => (
          <circle key={`c${i}`} cx={cx} cy={cy} r="6" className={`fill-content ${NODE}`} style={{ animationDelay: `${0.4 + i * 0.1}s` }} />
        ))}
        {TOPICS.map(([cx, cy], j) => (
          <circle key={`t${j}`} cx={cx} cy={cy} r="4.5" className={`fill-content-muted ${NODE}`} style={{ animationDelay: `${0.75 + j * 0.07}s` }} />
        ))}
        {signals.map(({ id, topic }) => (
          <circle
            key={id}
            data-testid="senal"
            cx={TOPICS[topic][0]}
            cy={TOPICS[topic][1]}
            r="6.5"
            className="fill-accent opacity-0 [transform-box:fill-box] origin-center animate-glow"
          />
        ))}
      </svg>
      {signals.map(({ id, topic }) => (
        <span
          key={id}
          className="pointer-events-none absolute top-0 left-0 size-1.75 rounded-full bg-accent opacity-0 shadow-[0_0_10px_rgb(79_209_197/0.75)] [offset-rotate:0deg] animate-signal-once"
          style={{ offsetPath: `path('${route(topic)}')` }}
        />
      ))}
    </div>
  )
}
