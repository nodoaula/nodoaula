import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { listCoursesWithResources, listResources, listTopicsWithResources } from './api.js'
import { formatDuration, formatResourceType } from './format.js'

// Historia HU207: espera esto sin teclear antes de disparar la búsqueda, para
// no mandar una petición por cada tecla.
const SEARCH_DEBOUNCE_MS = 400

function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id]
}

/**
 * Pantalla de listado y filtro del catálogo (historias HU105, HU206, HU207).
 * Accesible sin sesión iniciada. La búsqueda de texto y los tres filtros
 * —curso, tema y tipo— se combinan entre sí con AND; dentro de cada filtro
 * se puede elegir uno o varios valores a la vez (por ejemplo, dos cursos),
 * combinados entre sí con OR. Cada valor elegido, de cualquier filtro, se
 * muestra como un chip removible en una única barra debajo de los
 * selectores.
 */
export default function ResourceCatalogPage() {
  // La dirección puede traer una búsqueda y cursos iniciales (?q= y
  // ?courseId=), para llegar al catálogo ya filtrado desde un enlace. Solo se
  // leen al abrir la página: después mandan los controles.
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('q') ?? ''

  const [courses, setCourses] = useState([])
  const [selectedCourseIds, setSelectedCourseIds] = useState(() =>
    searchParams.getAll('courseId').filter((id) => /^\d+$/.test(id)),
  )

  const [topics, setTopics] = useState([])
  const [selectedTopicIds, setSelectedTopicIds] = useState([])

  const [videoSelected, setVideoSelected] = useState(false)
  const [documentSelected, setDocumentSelected] = useState(false)

  const [searchText, setSearchText] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch.trim())

  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Solo para poblar el selector de curso; se carga una única vez.
  useEffect(() => {
    let active = true

    listCoursesWithResources()
      .then((data) => {
        if (active) setCourses(data)
      })
      .catch((err) => {
        if (active) setError(err)
      })

    return () => {
      active = false
    }
  }, [])

  const courseFilterKey = selectedCourseIds.join(',')

  // Los temas disponibles dependen de los cursos elegidos (uno, varios o
  // ninguno). Los temas ya elegidos que dejan de pertenecer a la lista que
  // llega (porque cambió el curso) se quitan solos, sin que el usuario tenga
  // que quitarlos a mano.
  useEffect(() => {
    let active = true

    listTopicsWithResources(selectedCourseIds.length > 0 ? selectedCourseIds : undefined)
      .then((data) => {
        if (!active) return
        setTopics(data)
        setSelectedTopicIds((current) =>
          current.filter((id) => data.some((topic) => String(topic.id) === id)),
        )
      })
      .catch((err) => console.error('No se pudo cargar la lista de temas', err))

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recalcula con courseFilterKey, equivalente a selectedCourseIds pero estable entre renders.
  }, [courseFilterKey])

  // La búsqueda se dispara sola mientras se escribe, sin Enter ni botón: se
  // espera a que el usuario deje de teclear antes de pedir resultados.
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchText.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeoutId)
  }, [searchText])

  const topicFilterKey = selectedTopicIds.join(',')

  // El filtro cambió: reiniciamos loading/error durante el render (patrón oficial de
  // React para "ajustar estado cuando cambia una prop"), en vez de hacerlo de forma
  // síncrona dentro del efecto. Ver https://react.dev/learn/you-might-not-need-an-effect
  const filterKey = `${courseFilterKey}|${topicFilterKey}|${videoSelected}|${documentSelected}|${debouncedSearch}`
  const [lastRequestedFilterKey, setLastRequestedFilterKey] = useState(filterKey)
  if (lastRequestedFilterKey !== filterKey) {
    setLastRequestedFilterKey(filterKey)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let active = true

    const resourceTypes = []
    if (videoSelected) resourceTypes.push('VIDEO')
    if (documentSelected) resourceTypes.push('DOCUMENT')

    listResources({
      courseIds: selectedCourseIds,
      topicIds: selectedTopicIds,
      resourceTypes,
      q: debouncedSearch || undefined,
    })
      .then((data) => {
        if (active) setResources(data)
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- courseFilterKey/topicFilterKey son formas estables de selectedCourseIds/selectedTopicIds.
  }, [courseFilterKey, topicFilterKey, videoSelected, documentSelected, debouncedSearch])

  // Un chip por cada valor elegido, en cualquier filtro, cada uno con su
  // propia forma de quitarse sin afectar a los demás. La búsqueda de texto no
  // suma chip: se quita borrando el cuadro, que siempre está a la vista.
  const activeFilters = []
  for (const course of courses) {
    if (selectedCourseIds.includes(String(course.id))) {
      activeFilters.push({
        key: `course-${course.id}`,
        label: `Curso: ${course.name}`,
        onRemove: () => setSelectedCourseIds((current) => toggleId(current, String(course.id))),
      })
    }
  }
  for (const topic of topics) {
    if (selectedTopicIds.includes(String(topic.id))) {
      activeFilters.push({
        key: `topic-${topic.id}`,
        label: `Tema: ${topic.name}`,
        onRemove: () => setSelectedTopicIds((current) => toggleId(current, String(topic.id))),
      })
    }
  }
  if (videoSelected) {
    activeFilters.push({ key: 'type-video', label: 'Tipo: Video', onRemove: () => setVideoSelected(false) })
  }
  if (documentSelected) {
    activeFilters.push({
      key: 'type-document',
      label: 'Tipo: Documento',
      onRemove: () => setDocumentSelected(false),
    })
  }

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Catálogo de recursos</h1>

          <div className="relative sm:w-72">
            <label htmlFor="resource-search" className="sr-only">
              Buscar recursos
            </label>
            <input
              id="resource-search"
              type="search"
              placeholder="Buscar por título, descripción o tema…"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            {searchText !== '' && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                aria-label="Borrar búsqueda"
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="course-filter" className="block text-sm font-medium text-slate-700">
              Curso
            </label>
            <select
              id="course-filter"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value=""
              onChange={(event) => {
                const { value } = event.target
                if (value) setSelectedCourseIds((current) => toggleId(current, value))
              }}
            >
              <option value="">
                {selectedCourseIds.length === 0 ? 'Todos los cursos' : 'Elegir otro curso…'}
              </option>
              {courses
                .filter((course) => !selectedCourseIds.includes(String(course.id)))
                .map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="topic-filter" className="block text-sm font-medium text-slate-700">
              Tema
            </label>
            <select
              id="topic-filter"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value=""
              onChange={(event) => {
                const { value } = event.target
                if (value) setSelectedTopicIds((current) => toggleId(current, value))
              }}
            >
              <option value="">{selectedTopicIds.length === 0 ? 'Todos los temas' : 'Elegir otro tema…'}</option>
              {topics
                .filter((topic) => !selectedTopicIds.includes(String(topic.id)))
                .map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="block text-sm font-medium text-slate-700">Tipo de recurso</legend>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={videoSelected}
                onChange={(event) => setVideoSelected(event.target.checked)}
              />
              Video
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={documentSelected}
                onChange={(event) => setDocumentSelected(event.target.checked)}
              />
              Documento
            </label>
          </div>
        </fieldset>

        {activeFilters.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={filter.onRemove}
                className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-slate-500 hover:bg-slate-100"
              >
                {filter.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Quitar filtro</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {error && (
            <p className="text-sm text-red-700" role="alert">
              No se pudo cargar el catálogo. Recarga la página para reintentar.
            </p>
          )}

          {!error && loading && (
            <p className="text-sm text-slate-500" role="status">
              Cargando recursos…
            </p>
          )}

          {!error && !loading && resources.length === 0 && (
            <p className="text-sm text-slate-500" role="status">
              No hay recursos que coincidan con los filtros elegidos.
            </p>
          )}

          {!error && !loading && resources.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-200">
              {resources.map((resource) => (
                <li key={resource.id} className="py-4">
                  <Link
                    to={`/recursos/${resource.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {resource.title}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {resource.course} · {formatResourceType(resource.resourceType)} ·{' '}
                    {formatDuration(resource.durationSeconds)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
