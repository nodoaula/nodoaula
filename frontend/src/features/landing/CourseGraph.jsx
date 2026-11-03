import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { useMediaQuery } from './useMediaQuery.js'
import { graphGeometry } from './landingCatalog.js'

/**
 * Un nombre con su número de recursos. Se ve solo la cifra; un lector de
 * pantalla oye «Física de Campos, 10 recursos», y el nombre accesible lleva
 * el texto que se ve.
 */
export function NameAndCount({ name, count, nameClassName, countClassName }) {
  return (
    <>
      <span className={nameClassName}>
        {name}
        <span className="sr-only">,</span>
      </span>
      <small className={countClassName}>
        {count}
        <span className="sr-only"> {count === 1 ? 'recurso' : 'recursos'}</span>
      </small>
    </>
  )
}

/**
 * La gráfica de la entrada: el nodo de «Todos los cursos» o del curso
 * escogido, y una fila por curso o por tema. Cada fila se escoge ahí mismo;
 * el nombre del nodo lleva a su página del catálogo. `tree` la dibuja en
 * vertical, para una sola columna. Se monta de nuevo en cada cambio (la
 * página le da otra `key`) para que sus filas vuelvan a salir del nodo.
 */
export default function CourseGraph({ label, detail, to, items, more, moreTo, selected, onPick, goText, onGoDown, tree }) {
  const graphRef = useRef(null)
  const [hot, setHot] = useState(-1)
  const [onScreen, setOnScreen] = useState(true)
  const canHover = useMediaQuery('(hover: hover)')

  // Las señales que recorren las aristas se paran cuando la gráfica no se ve.
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting))
    observer.observe(graphRef.current)
    return () => observer.disconnect()
  }, [])

  const rows = items.length + (more > 0 ? 1 : 0)
  const { node, rowX, ys, paths, height } = graphGeometry(rows, tree)
  const moreKind = selected.course ? 'tema' : 'curso'
  const moreText = `+ ${more} ${moreKind}${more === 1 ? '' : 's'} más`
  const fromNode = (y) => ({ '--dy': `${node.y - y}px`, ...(tree ? { '--dx': `${node.x - rowX}px` } : {}) })

  return (
    <figure aria-label={selected.course ? `Gráfica de ${label} y sus temas` : 'Gráfica de los cursos'} className="relative m-0 flex flex-col justify-center">
      <div ref={graphRef} className={`relative ${tree ? '' : 'h-145'}`} style={tree ? { height } : undefined}>
        <svg
          viewBox={`0 0 ${tree ? 48 : 540} ${height}`}
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 h-full overflow-visible ${tree ? 'w-12' : 'w-full'}`}
        >
          {items.map((item, index) => (
            <path
              key={`arista-${item.name}`}
              d={paths[index]}
              pathLength="1"
              className="fill-none stroke-border-strong [stroke-dasharray:1] [stroke-width:1.2] motion-safe:animate-draw"
              style={{ animationDelay: `${index * 60}ms` }}
            />
          ))}
          {items.map((item, index) => (
            <path
              key={`activa-${item.name}`}
              d={paths[index]}
              className={`fill-none stroke-accent [stroke-dasharray:5_6] [stroke-width:1.6] transition-opacity duration-200 motion-safe:animate-dash-flow ${hot === index || item.name === selected.topic ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
        </svg>

        {items.map((item, index) => (
          <span
            key={`senal-${item.name}`}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 size-1.5 rounded-full bg-accent opacity-0 shadow-[0_0_8px_rgb(79_209_197/0.7)] [offset-rotate:0deg] motion-safe:animate-signal motion-reduce:hidden"
            style={{ offsetPath: `path('${paths[index]}')`, animationDelay: `${1400 + index * 180}ms`, animationPlayState: onScreen ? 'running' : 'paused' }}
          />
        ))}

        <span
          aria-hidden="true"
          className={`absolute -translate-1/2 rounded-full bg-accent shadow-[0_0_0_5px_var(--color-surface),0_0_0_6px_rgb(79_209_197/0.5)] after:pointer-events-none after:absolute after:-inset-1.5 after:rounded-full after:border after:border-accent/70 after:opacity-0 motion-safe:after:animate-ring ${tree ? 'size-5.5' : 'size-6.5'}`}
          style={{ left: node.x, top: node.y }}
        />
        <Link
          to={to}
          className={`group absolute rounded-lg p-1 text-left text-content ${tree ? 'top-0 left-12.25 max-w-[calc(100%-3.0625rem)] pl-2' : 'top-79 left-1 w-42.5'}`}
        >
          <b className="block text-base leading-[1.3] font-semibold group-hover:underline group-hover:underline-offset-3">{label}</b>
          <small className="mt-0.75 block font-mono text-label whitespace-nowrap text-content-muted">{detail}</small>
        </Link>

        {items.map((item, index) => {
          const on = item.name === selected.topic
          return (
            <button
              key={item.name}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(item)}
              onMouseEnter={() => canHover && setHot(index)}
              onMouseLeave={() => setHot(-1)}
              onFocus={() => setHot(index)}
              onBlur={() => setHot(-1)}
              className={`group absolute -ml-1.25 flex min-h-11 origin-[0_50%] items-center gap-2.5 pr-2 text-left text-base leading-[normal] [transform:translateY(-50%)] hover:text-content focus-visible:text-content motion-safe:animate-node-in ${tree ? 'left-10 max-w-[calc(100%-2.5rem)]' : 'left-[46%] max-w-[54%]'} ${on ? 'font-medium text-content' : 'text-content-muted'}`}
              style={{ top: ys[index], animationDelay: `${index * 60}ms`, ...fromNode(ys[index]) }}
            >
              <i
                aria-hidden="true"
                className={`size-3 flex-none rounded-full transition-[background-color,box-shadow] duration-200 ${on ? 'bg-accent shadow-[0_0_0_3px_var(--color-surface),0_0_0_4px_rgb(79_209_197/0.6)]' : 'bg-content-muted group-hover:bg-content group-focus-visible:bg-content'}`}
              />
              <NameAndCount name={item.name} count={item.count} nameClassName="min-w-0 truncate" countClassName="flex-none font-mono text-label text-content-faint" />
            </button>
          )
        })}
        {more > 0 && (
          <Link
            to={moreTo}
            className={`absolute ml-[15px] flex min-h-11 origin-[0_50%] items-center text-sm leading-[normal] text-content-muted [transform:translateY(-50%)] hover:underline hover:underline-offset-3 motion-safe:animate-node-in ${tree ? 'left-10' : 'left-[46%]'}`}
            style={{ top: ys[items.length], animationDelay: `${items.length * 60}ms`, ...fromNode(ys[items.length]) }}
          >
            {moreText}
          </Link>
        )}
      </div>

      <div className={tree ? 'pt-1 pl-14.25' : 'absolute top-[calc(50%+290px)] left-[46%] h-7 pl-[17px]'}>
        {goText && (
          <button
            type="button"
            onClick={onGoDown}
            className={`py-1 text-body font-medium text-content hover:underline hover:underline-offset-3 ${tree ? 'text-left leading-[1.4]' : 'whitespace-nowrap'}`}
          >
            {goText.slice(0, goText.lastIndexOf(' '))}{' '}
            <span className="whitespace-nowrap">
              {goText.slice(goText.lastIndexOf(' ') + 1)}&nbsp;
              <span aria-hidden="true" className="inline-block motion-safe:animate-nudge">
                ↓
              </span>
            </span>
          </button>
        )}
      </div>
    </figure>
  )
}
