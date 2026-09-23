import { useEffect, useState } from 'react'

import { listCoursesWithResources, listResources } from './api.js'

const RESOURCE_TYPE_LABELS = {
  VIDEO: 'Video',
  DOCUMENT: 'Documento',
}

function formatDuration(totalSeconds) {
  if (totalSeconds == null) return '—'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(seconds).padStart(2, '0')

  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`
}

/** Pantalla de listado y filtro del catálogo. Accesible sin sesión iniciada. */
export default function ResourceCatalogPage() {
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  // El filtro cambió: reiniciamos loading/error durante el render (patrón oficial de
  // React para "ajustar estado cuando cambia una prop"), en vez de hacerlo de forma
  // síncrona dentro del efecto. Ver https://react.dev/learn/you-might-not-need-an-effect
  const [lastRequestedCourseId, setLastRequestedCourseId] = useState(selectedCourseId)
  if (lastRequestedCourseId !== selectedCourseId) {
    setLastRequestedCourseId(selectedCourseId)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let active = true

    listResources(selectedCourseId || undefined)
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
  }, [selectedCourseId])

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Catálogo de recursos</h1>

        <div className="mt-6">
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
              No hay recursos para este curso.
            </p>
          )}

          {!error && !loading && resources.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-200">
              {resources.map((resource, index) => (
                <li key={index} className="py-4">
                  <p className="font-medium text-slate-900">{resource.title}</p>
                  <p className="text-sm text-slate-600">
                    {resource.course} · {RESOURCE_TYPE_LABELS[resource.resourceType] ?? resource.resourceType} ·{' '}
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
