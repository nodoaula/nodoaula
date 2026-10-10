import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import Tag from '../../components/ui/Tag.jsx'
import { listCoursesWithResources, listResources } from './api.js'
import { formatCourseSummary, summarizeCourses } from './courseSummary.js'
import { formatDurationText, formatResourceType } from './format.js'
import TopicGraph from './TopicGraph.jsx'

// Espera esto sin teclear antes de buscar, para no mandar una petición por
// cada tecla.
const SEARCH_DEBOUNCE_MS = 400
const VISIBLE_TOPICS = 3

/**
 * Índice del catálogo: una tarjeta por curso y un buscador en todos los
 * cursos. Accesible sin sesión iniciada. Mientras hay texto en el buscador,
 * los resultados sustituyen a las tarjetas.
 */
export default function CourseIndexPage() {
  // La página de entrada llega aquí con ?q= ya escrito. Solo se lee al abrir.
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('q') ?? ''

  const [summaries, setSummaries] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [searchText, setSearchText] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch.trim())
  // Los resultados guardan la búsqueda que los produjo: si no coincide con la
  // actual, la respuesta todavía no ha llegado.
  const [search, setSearch] = useState({ query: '', resources: [], error: null })

  useEffect(() => {
    let active = true

    Promise.all([listResources(), listCoursesWithResources()])
      .then(([resources, courses]) => {
        if (active) setSummaries(summarizeCourses(resources, courses))
      })
      .catch((error) => {
        if (active) setLoadError(error)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeoutId)
  }, [searchText])

  useEffect(() => {
    if (debouncedSearch === '') return undefined
    let active = true

    listResources({ q: debouncedSearch })
      .then((resources) => {
        if (active) setSearch({ query: debouncedSearch, resources, error: null })
      })
      .catch((error) => {
        if (active) setSearch({ query: debouncedSearch, resources: [], error })
      })

    return () => {
      active = false
    }
  }, [debouncedSearch])

  const searching = searchText.trim() !== ''

  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[1.875rem] leading-[1.08] font-semibold tracking-tight sm:text-display">Escoge tu curso</h1>
          {summaries !== null && summaries.length > 0 && <CatalogTotals summaries={summaries} />}
        </div>
        <SearchBox value={searchText} onChange={setSearchText} />
      </div>

      {searching ? (
        <SearchResults query={debouncedSearch} search={search} onClear={() => setSearchText('')} />
      ) : (
        <CourseCards summaries={summaries} error={loadError} />
      )}
    </main>
  )
}

function CatalogTotals({ summaries }) {
  const resourceCount = summaries.reduce((total, summary) => total + summary.count, 0)
  const courseText = summaries.length === 1 ? '1 curso' : `${summaries.length} cursos`

  return (
    <p className="mt-2.5 text-body text-pretty text-content-muted">
      {courseText} · {resourceCount} videos y apuntes organizados por tema
    </p>
  )
}

function SearchBox({ value, onChange }) {
  return (
    <div className="relative w-full sm:w-105" role="search">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-content-muted"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor="catalog-search" className="sr-only">
        Buscar en todos los cursos
      </label>
      <input
        id="catalog-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar en todos los cursos…"
        className="block w-full rounded-full border border-border-strong bg-surface-raised py-3 pr-4.5 pl-11 text-body text-content caret-accent placeholder:text-content-muted focus:border-accent focus:outline-none"
      />
    </div>
  )
}

function CourseCards({ summaries, error }) {
  if (error) {
    return (
      <div className="mt-8">
        <Notice title="No se pudo cargar el catálogo" role="alert">
          Recarga la página para reintentar.
        </Notice>
      </div>
    )
  }

  if (summaries === null) {
    return (
      <p className="mt-8 text-body text-content-muted" role="status">
        Cargando cursos…
      </p>
    )
  }

  if (summaries.length === 0) {
    return (
      <div className="mt-8">
        <Notice title="Aún no hay recursos en el catálogo" />
      </div>
    )
  }

  return (
    <ul className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {summaries.map((summary) => (
        <li key={summary.id}>
          <CourseCard summary={summary} />
        </li>
      ))}
    </ul>
  )
}

function CourseCard({ summary }) {
  const visibleTopics = summary.topics.slice(0, VISIBLE_TOPICS)
  const hiddenTopicCount = summary.topics.length - visibleTopics.length

  return (
    <Link
      to={`/catalogo/cursos/${summary.id}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface-raised p-5.5 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-accent hover:bg-surface-hover sm:min-h-46"
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-xl leading-tight font-semibold tracking-tight text-content">{summary.name}</span>
          <span className="mt-2 block font-mono text-label leading-relaxed text-content-muted tabular-nums">
            {formatCourseSummary(summary)}
          </span>
        </span>
        <TopicGraph topics={summary.topics} />
      </span>
      <span className="mt-auto flex flex-wrap gap-1.5 pt-4.5">
        {visibleTopics.map((topic) => (
          <Tag key={topic.name}>{topic.name}</Tag>
        ))}
        {hiddenTopicCount > 0 && (
          <Tag>
            +{hiddenTopicCount}
            <span className="sr-only"> temas más</span>
          </Tag>
        )}
      </span>
    </Link>
  )
}

function SearchResults({ query, search, onClear }) {
  // query vacía: se acaba de empezar a escribir y la espera aún no termina.
  if (query === '' || search.query !== query) {
    return (
      <p className="mt-8 text-body text-content-muted" role="status">
        Buscando…
      </p>
    )
  }

  if (search.error) {
    return (
      <div className="mt-8">
        <Notice title="No se pudo hacer la búsqueda" role="alert">
          Recarga la página para reintentar.
        </Notice>
      </div>
    )
  }

  if (search.resources.length === 0) {
    return (
      <div className="mt-8">
        <Notice
          title="No hay recursos que coincidan"
          action={
            <button type="button" onClick={onClear} className={buttonClasses('secondary')}>
              Ver todos los cursos
            </button>
          }
        >
          Prueba con otra palabra, o entra a un curso y revisa sus temas.
        </Notice>
      </div>
    )
  }

  const count = search.resources.length

  return (
    <div className="mt-8">
      <p className="text-sm text-content-muted" role="status">
        {count === 1 ? '1 resultado' : `${count} resultados`} para «{query}» en todos los cursos
      </p>
      <ul className="mt-2 border-t border-border">
        {search.resources.map((resource) => (
          <li key={resource.id} className="border-b border-border">
            <ResultRow resource={resource} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ResultRow({ resource }) {
  const isVideo = resource.resourceType === 'VIDEO'

  return (
    <Link
      to={`/recursos/${resource.id}`}
      className="grid gap-2 px-1 py-4 hover:bg-surface-raised sm:grid-cols-[5.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
    >
      <span
        className={`justify-self-start rounded-full border px-2.5 py-0.5 font-mono text-xs ${
          isVideo ? 'border-accent/40 text-accent' : 'border-border-strong text-content'
        }`}
      >
        {formatResourceType(resource.resourceType)}
      </span>
      <span>
        <span className="block text-base leading-snug font-medium text-content">{resource.title}</span>
        <span className="mt-1 block text-label text-content-muted">
          {[resource.course, ...resource.topics].join(' · ')}
        </span>
      </span>
      {resource.durationSeconds != null && (
        <span className="font-mono text-label whitespace-nowrap text-content-muted sm:text-right">
          {formatDurationText(resource.durationSeconds)}
        </span>
      )}
    </Link>
  )
}
