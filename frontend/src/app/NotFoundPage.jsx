import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'

import { buttonClasses } from '../components/ui/button.js'

/**
 * Página de una dirección que no existe: la nombra, deja buscar en el catálogo
 * y ofrece volver. La ruta de nodos que se corta solo se dibuja con dos
 * columnas; en una sola no aporta nada que el texto no diga.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [text, setText] = useState('')

  function search(event) {
    event.preventDefault()
    const query = text.trim()
    navigate(query === '' ? '/catalogo' : `/catalogo?${new URLSearchParams({ q: query })}`)
  }

  return (
    <main className="mx-auto grid max-w-page items-center gap-16 px-4 pt-9 pb-18 sm:px-6 min-[1000px]:grid-cols-[minmax(0,1fr)_440px]">
      <div>
        <h1 className="mt-6 text-[1.875rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
          No encontramos esta página
        </h1>
        <p className="mt-4 max-w-[56ch] text-base leading-relaxed text-pretty text-content-muted">
          La dirección{' '}
          <span className="font-mono text-sm wrap-anywhere text-content">
            {window.location.host}
            {pathname}
          </span>{' '}
          no lleva a ninguna página de NodoAula. Puede que el enlace esté mal copiado o que la página ya no exista.
        </p>

        <form onSubmit={search} className="mt-8 flex max-w-130 flex-col gap-2">
          <label htmlFor="not-found-search" className="text-sm font-medium text-content">
            Busca lo que necesitabas
          </label>
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-content-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            {/* type="text" y no "search": este último trae una × del navegador
                distinta del botón de borrar del buscador de la entrada. */}
            <input
              id="not-found-search"
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              value={text}
              placeholder="Un curso, un tema o un recurso"
              onChange={(event) => setText(event.target.value)}
              className="h-14 w-full rounded-full border border-border-control bg-surface-raised pr-6 pl-13 text-base text-content caret-accent transition-[border-color,box-shadow] duration-200 placeholder:text-content-muted hover:border-content-faint focus:border-accent focus:shadow-[0_0_0_4px_rgb(79_209_197/0.12)] focus:outline-none"
            />
          </div>
        </form>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/catalogo" className={buttonClasses('primary')}>
            Ir al catálogo
          </Link>
          <Link to="/" className={buttonClasses('secondary')}>
            Volver a la entrada
          </Link>
        </div>
      </div>

      {/* La ruta de nodos que no llega: el sitio, el catálogo y un nodo hueco. */}
      <svg viewBox="0 0 440 300" fill="none" aria-hidden="true" className="hidden w-full max-w-110 min-[1000px]:block">
        <path d="M40 150H170" className="stroke-border-strong" strokeWidth="1.5" />
        <path d="M184 150H262" className="stroke-border-strong" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
        <path d="M300 150H372" className="stroke-border-strong" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" opacity="0.5" />
        <circle cx="40" cy="150" r="10" className="fill-content" />
        <circle cx="177" cy="150" r="10" className="fill-content" />
        <circle cx="400" cy="150" r="17" className="stroke-content-faint" strokeWidth="1.5" strokeDasharray="3 5" />
        <text x="40" y="190" textAnchor="middle" className="fill-content-muted text-sm font-medium">
          NodoAula
        </text>
        <text x="177" y="190" textAnchor="middle" className="fill-content-muted text-sm font-medium">
          Catálogo
        </text>
        <text x="400" y="197" textAnchor="middle" className="fill-content-muted font-mono text-label">
          404
        </text>
      </svg>
    </main>
  )
}
