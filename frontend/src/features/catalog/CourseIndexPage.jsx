import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import Notice from '../../components/ui/Notice.jsx'
import Tag from '../../components/ui/Tag.jsx'
import { listCoursesWithResources, listResources } from './api.js'
import { formatCourseSummary, summarizeCourses } from './courseSummary.js'
import ResourceRow from './ResourceRow.jsx'
import SearchBox from './SearchBox.jsx'
import TopicGraph from './TopicGraph.jsx'
import { useResourceSearch } from './useResourceSearch.js'

const VISIBLE_TOPICS = 3

/**
 * Índice del catálogo: una tarjeta por curso y un buscador en todos los
 * cursos. Accesible sin sesión iniciada. Mientras hay texto en el buscador,
 * los resultados sustituyen a las tarjetas.
 */
export default function CourseIndexPage() {
  // La página de entrada llega aquí con ?q= ya escrito. Solo se lee al abrir.
  const [searchParams] = useSearchParams()
  const search = useResourceSearch(searchParams.get('q') ?? '')

  const [summaries, setSummaries] = useState(null)
  const [loadError, setLoadError] = useState(null)

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

  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[1.875rem] leading-[1.08] font-semibold tracking-tight sm:text-display">Escoge tu curso</h1>
          {summaries !== null && summaries.length > 0 && <CatalogTotals summaries={summaries} />}
        </div>
        <SearchBox id="catalog-search" label="Buscar en todos los cursos" value={search.text} onChange={search.setText} />
      </div>

      {search.searching ? (
        <SearchResults search={search} />
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
    <ul aria-label="Cursos" className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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

function SearchResults({ search }) {
  if (search.pending) {
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
            <button type="button" onClick={() => search.setText('')} className={buttonClasses('secondary')}>
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
        {count === 1 ? '1 resultado' : `${count} resultados`} para «{search.query}» en todos los cursos
      </p>
      <ul aria-label="Resultados de la búsqueda" className="mt-2 border-t border-border">
        {search.resources.map((resource) => (
          <li key={resource.id} className="border-b border-border">
            <ResourceRow resource={resource} detail={[resource.course, ...resource.topics].join(' · ')} />
          </li>
        ))}
      </ul>
    </div>
  )
}
