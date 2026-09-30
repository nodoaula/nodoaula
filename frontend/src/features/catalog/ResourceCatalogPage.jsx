import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { listCoursesWithResources, listResources, listTopicsWithResources } from './api.js'
import { formatDuration, formatResourceType } from './format.js'

/**
 * Pantalla de listado y filtro del catálogo (historias HU105, HU206).
 * Accesible sin sesión iniciada. Los tres filtros —curso, tema y tipo— se
 * combinan entre sí con AND, y sus valores activos se muestran como chips
 * removibles debajo de los selectores.
 */
export default function ResourceCatalogPage() {
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const [topics, setTopics] = useState([])
  const [selectedTopicId, setSelectedTopicId] = useState('')

  const [videoSelected, setVideoSelected] = useState(false)
  const [documentSelected, setDocumentSelected] = useState(false)

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

  // Los temas disponibles dependen del curso elegido. Si el tema activo ya
  // no pertenece a la lista que llega (porque el curso cambió), se limpia
  // solo, sin que el usuario tenga que quitarlo a mano.
  useEffect(() => {
    let active = true

    listTopicsWithResources(selectedCourseId || undefined)
      .then((data) => {
        if (!active) return
        setTopics(data)
        setSelectedTopicId((current) =>
          current !== '' && !data.some((topic) => String(topic.id) === current) ? '' : current,
        )
      })
      .catch((err) => console.error('No se pudo cargar la lista de temas', err))

    return () => {
      active = false
    }
  }, [selectedCourseId])

  // El filtro cambió: reiniciamos loading/error durante el render (patrón oficial de
  // React para "ajustar estado cuando cambia una prop"), en vez de hacerlo de forma
  // síncrona dentro del efecto. Ver https://react.dev/learn/you-might-not-need-an-effect
  const filterKey = `${selectedCourseId}|${selectedTopicId}|${videoSelected}|${documentSelected}`
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
      courseId: selectedCourseId || undefined,
      topicId: selectedTopicId || undefined,
      resourceTypes,
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
  }, [selectedCourseId, selectedTopicId, videoSelected, documentSelected])

  // Un chip por filtro activo, cada uno con su propia forma de quitarse.
  const activeFilters = []
  const selectedCourse = courses.find((course) => String(course.id) === selectedCourseId)
  if (selectedCourse) {
    activeFilters.push({
      key: 'course',
      label: `Curso: ${selectedCourse.name}`,
      onRemove: () => setSelectedCourseId(''),
    })
  }
  const selectedTopic = topics.find((topic) => String(topic.id) === selectedTopicId)
  if (selectedTopic) {
    activeFilters.push({
      key: 'topic',
      label: `Tema: ${selectedTopic.name}`,
      onRemove: () => setSelectedTopicId(''),
    })
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
        <h1 className="text-2xl font-semibold text-slate-900">Catálogo de recursos</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="course-filter" className="block text-sm font-medium text-slate-700">
              Curso
            </label>
            <select
              id="course-filter"
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedCourseId}
              onChange={(event) => setSelectedCourseId(event.target.value)}
            >
              <option value="">Todos los cursos</option>
              {courses.map((course) => (
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
              value={selectedTopicId}
              onChange={(event) => setSelectedTopicId(event.target.value)}
            >
              <option value="">Todos los temas</option>
              {topics.map((topic) => (
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
