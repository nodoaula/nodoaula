import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { getResource } from './api.js'
import { formatDuration, formatPublishedAt, formatResourceType } from './format.js'
import ResourcePlayer from './ResourcePlayer.jsx'
import { isWebUrl, sourceLinkLabel } from './sourcePlatform.js'

const RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND'

// 404 cuando el recurso no existe y 400 cuando la dirección ni siquiera trae
// un número, como /recursos/abc. Para quien visita, las dos son lo mismo.
function isNotFound(error) {
  return error.code === RESOURCE_NOT_FOUND || error.status === 404 || error.status === 400
}

/**
 * Ficha de un recurso (historia HU108). Accesible sin sesión iniciada: el
 * catálogo se consulta sin cuenta (ADR-007).
 *
 * La key reinicia la carga cuando cambia el identificador de la dirección,
 * sin arrastrar los datos ni el error del recurso anterior.
 */
export default function ResourceDetailPage() {
  const { resourceId } = useParams()
  return <ResourceDetail key={resourceId} resourceId={resourceId} />
}

function ResourceDetail({ resourceId }) {
  const [resource, setResource] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    getResource(resourceId)
      .then((data) => {
        if (active) setResource(data)
      })
      .catch((err) => {
        if (!active) return
        if (!isNotFound(err)) console.error('No se pudo cargar el recurso', err)
        setError(err)
      })

    return () => {
      active = false
    }
  }, [resourceId])

  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Volver al catálogo
        </Link>

        {error && <LoadError error={error} />}

        {!error && resource === null && (
          <p className="mt-6 text-sm text-slate-500" role="status">
            Cargando recurso…
          </p>
        )}

        {!error && resource !== null && <ResourceSheet resource={resource} />}
      </div>
    </main>
  )
}

function LoadError({ error }) {
  if (isNotFound(error)) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-semibold text-slate-900">Recurso no encontrado</h1>
        <p className="mt-2 text-sm text-slate-600">Este recurso no existe o ya no está en el catálogo.</p>
      </div>
    )
  }

  return (
    <p className="mt-6 text-sm text-red-700" role="alert">
      No se pudo cargar el recurso. Recarga la página para reintentar.
    </p>
  )
}

function ResourceSheet({ resource }) {
  const canLink = isWebUrl(resource.url)

  return (
    <article className="mt-6">
      <h1 className="text-2xl font-semibold text-slate-900">{resource.title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {resource.course} · {formatResourceType(resource.resourceType)}
        {resource.durationSeconds != null && ` · ${formatDuration(resource.durationSeconds)}`}
      </p>

      <div className="mt-6">
        <ResourcePlayer url={resource.url} title={resource.title} />
      </div>

      {/* Siempre visible, se pueda incrustar o no: el objetivo de la ficha
          es llevar al recurso en su plataforma de origen. */}
      {canLink && (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {sourceLinkLabel(resource.url)}
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      )}

      {/* Los campos opcionales solo aparecen cuando el recurso los tiene. */}
      <dl className="mt-8 divide-y divide-slate-200 border-y border-slate-200 text-sm">
        <Field label="Identificador">{resource.id}</Field>
        <Field label="Título">{resource.title}</Field>
        {resource.description && (
          <Field label="Descripción">
            <span className="whitespace-pre-line">{resource.description}</span>
          </Field>
        )}
        {resource.publishedAt && <Field label="Fecha de publicación">{formatPublishedAt(resource.publishedAt)}</Field>}
        {resource.durationSeconds != null && <Field label="Duración">{formatDuration(resource.durationSeconds)}</Field>}
        {resource.channel && <Field label="Canal">{resource.channel}</Field>}
        <Field label="Enlace">
          {canLink ? (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-slate-900 underline hover:text-slate-700"
            >
              {resource.url}
            </a>
          ) : (
            <span className="break-all">{resource.url}</span>
          )}
        </Field>
        <Field label="Tipo de recurso">{formatResourceType(resource.resourceType)}</Field>
        <Field label="Curso">{resource.course}</Field>
        <Field label="Temas">
          <ul className="flex flex-wrap gap-2">
            {resource.topics.map((topic) => (
              <li key={topic} className="rounded-full bg-slate-200 px-3 py-0.5 text-xs text-slate-800">
                {topic}
              </li>
            ))}
          </ul>
        </Field>
      </dl>
    </article>
  )
}

function Field({ label, children }) {
  return (
    <div className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd className="mt-1 text-slate-900 sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  )
}
