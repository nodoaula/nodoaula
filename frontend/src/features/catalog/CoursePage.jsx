import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import { listResources } from './api.js'
import { formatCourseSummary, summarizeCourses } from './courseSummary.js'
import ResourceRow from './ResourceRow.jsx'
import SearchBox from './SearchBox.jsx'
import { useResourceSearch } from './useResourceSearch.js'

const ALL_TYPES = 'ALL'
const TYPE_OPTIONS = [
  { value: ALL_TYPES, label: 'Todo' },
  { value: 'VIDEO', label: 'Videos' },
  { value: 'DOCUMENT', label: 'Apuntes' },
]

/**
 * Página de un curso: sus recursos en una lista plana, con buscador y filtros
 * por tipo y por tema. Accesible sin sesión iniciada.
 *
 * La key reinicia la carga y los filtros cuando cambia el curso de la
 * dirección, sin arrastrar los del curso anterior.
 */
export default function CoursePage() {
  const { courseId } = useParams()
  return <Course key={courseId} courseId={courseId} />
}

function Course({ courseId }) {
  // Una dirección que no es un número no puede ser un curso: no se pregunta.
  const validId = /^\d+$/.test(courseId)
  const [resources, setResources] = useState(validId ? null : [])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!validId) return undefined
    let active = true

    listResources({ courseId })
      .then((data) => {
        if (active) setResources(data)
      })
      .catch((err) => {
        if (active) setError(err)
      })

    return () => {
      active = false
    }
  }, [courseId, validId])

  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      {error && (
        <Notice title="No se pudo cargar el curso" role="alert">
          Recarga la página para reintentar.
        </Notice>
      )}

      {!error && resources === null && (
        <p className="text-body text-content-muted" role="status">
          Cargando curso…
        </p>
      )}

      {/* El listado solo incluye cursos con recursos: vacío es lo mismo que no encontrado. */}
      {!error && resources?.length === 0 && (
        <Notice
          title="Curso no encontrado"
          action={
            <Link to="/catalogo" className={buttonClasses('secondary')}>
              Volver al catálogo
            </Link>
          }
        >
          Este curso no existe o ya no tiene recursos en el catálogo.
        </Notice>
      )}

      {!error && resources?.length > 0 && <CourseResources courseId={courseId} resources={resources} />}
    </main>
  )
}

function CourseResources({ courseId, resources }) {
  const name = resources[0].course
  const [summary] = summarizeCourses(resources, [{ id: courseId, name }])
  const search = useResourceSearch('', courseId)
  const [type, setType] = useState(ALL_TYPES)
  const [selectedTopics, setSelectedTopics] = useState([])

  const toggleTopic = (topic) =>
    setSelectedTopics((current) => (current.includes(topic) ? current.filter((t) => t !== topic) : [...current, topic]))

  const clearFilters = () => {
    search.setText('')
    setType(ALL_TYPES)
    setSelectedTopics([])
  }

  // Tema y tipo se aplican aquí, sobre el curso o sobre lo que devolvió la
  // búsqueda. Entre filtros se combinan con Y; entre temas, con O.
  const filtered = (search.searching ? search.resources : resources).filter(
    (resource) =>
      (type === ALL_TYPES || resource.resourceType === type) &&
      (selectedTopics.length === 0 || resource.topics.some((topic) => selectedTopics.includes(topic))),
  )
  const filtering = search.searching || type !== ALL_TYPES || selectedTopics.length > 0
  const topicText = summary.topics.length === 1 ? '1\u00a0tema' : `${summary.topics.length}\u00a0temas`

  return (
    <>
      <NodePath label="Ubicación" items={[{ label: 'Catálogo', to: '/catalogo' }]} current={name} />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[1.875rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
            {name}
          </h1>
          <p className="mt-2.5 font-mono text-label text-content-muted tabular-nums">
            {formatCourseSummary(summary)} · {topicText}
          </p>
        </div>
        <SearchBox id="course-search" label={`Buscar en ${name}`} value={search.text} onChange={search.setText} />
      </div>

      <div className="mt-7 flex flex-col gap-3.5 border-b border-border pb-5">
        <FilterGroup label="Tipo">
          <div className="inline-flex rounded-full border border-border-strong p-0.75">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={type === option.value}
                onClick={() => setType(option.value)}
                className={`rounded-full px-3.5 py-2.5 text-label font-medium sm:py-1.5 ${
                  type === option.value ? 'bg-content text-surface' : 'text-content-muted hover:text-content'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Temas">
          <TopicButton pressed={selectedTopics.length === 0} onClick={() => setSelectedTopics([])}>
            Todos
          </TopicButton>
          {summary.topics.map((topic) => (
            <TopicButton
              key={topic.name}
              pressed={selectedTopics.includes(topic.name)}
              count={topic.count}
              onClick={() => toggleTopic(topic.name)}
            >
              {topic.name}
            </TopicButton>
          ))}
        </FilterGroup>
      </div>

      <CourseResourceList
        name={name}
        total={summary.count}
        resources={filtered}
        filtering={filtering}
        search={search}
        onClear={clearFilters}
      />
    </>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="w-full text-label text-content-muted sm:w-14">
        {label}
      </span>
      {children}
    </div>
  )
}

function TopicButton({ pressed, count, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2.5 text-label transition-colors sm:py-1.5 ${
        pressed
          ? 'border-accent bg-accent/8 text-content'
          : 'border-border-strong text-content-muted hover:border-content-muted hover:text-content'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`font-mono text-xs ${pressed ? 'text-accent' : 'text-content-muted'}`}>{count}</span>
      )}
    </button>
  )
}

function CourseResourceList({ name, total, resources, filtering, search, onClear }) {
  if (search.searching && search.pending) {
    return (
      <p className="mt-5 text-body text-content-muted" role="status">
        Buscando…
      </p>
    )
  }

  if (search.searching && search.error) {
    return (
      <div className="mt-6">
        <Notice title="No se pudo hacer la búsqueda" role="alert">
          Recarga la página para reintentar.
        </Notice>
      </div>
    )
  }

  if (resources.length === 0) {
    return (
      <div className="mt-6">
        <Notice
          title={`Ningún recurso de ${name} coincide`}
          action={
            <button type="button" onClick={onClear} className={buttonClasses('secondary')}>
              Quitar filtros
            </button>
          }
        >
          Quita algún filtro o prueba con otra palabra.
        </Notice>
      </div>
    )
  }

  let countText = total === 1 ? '1 recurso' : `${total} recursos`
  if (filtering) countText = resources.length === 1 ? '1 recurso coincide' : `${resources.length} recursos coinciden`

  return (
    <div className="mt-5">
      <p className="text-sm text-content-muted" role="status">
        {countText}
      </p>
      <ul aria-label="Recursos del curso" className="mt-2 border-t border-border">
        {resources.map((resource) => (
          <li key={resource.id} className="border-b border-border">
            <ResourceRow resource={resource} detail={resource.topics.join(' · ')} />
          </li>
        ))}
      </ul>
    </div>
  )
}
