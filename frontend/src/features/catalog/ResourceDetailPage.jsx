import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { buttonClasses } from '../../components/ui/button.js'
import NodePath from '../../components/ui/NodePath.jsx'
import Notice from '../../components/ui/Notice.jsx'
import Tabs from '../../components/ui/Tabs.jsx'
import Tag from '../../components/ui/Tag.jsx'
import { getResource, republishResource, retireResource } from './api.js'
import { formatDurationText, formatPublishedAt, formatResourceType } from './format.js'
import ResourcePlayer from './ResourcePlayer.jsx'
import { RetiredNotice, RetireAction } from './ResourceRetirement.jsx'
import { describeRetirementFailure, RETIREMENT_ACTION } from './retirement.js'
import { getYouTubeVideoId, isWebUrl, sourceLinkLabel } from './sourcePlatform.js'

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
  // Al volver de corregirlo (HU311), la ficha confirma que se guardó.
  const corrected = useLocation().state?.resourceCorrected === true
  return <ResourceDetail key={resourceId} resourceId={resourceId} corrected={corrected} />
}

function ResourceDetail({ resourceId, corrected }) {
  const [resource, setResource] = useState(null)
  const [error, setError] = useState(null)
  // Lo último que hizo quien ve la ficha (HU307): retirarlo o volver a
  // publicarlo. Mientras la petición está en curso, `busy` lo dice.
  const [outcome, setOutcome] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionFailure, setActionFailure] = useState(null)

  async function changeAvailability(action) {
    if (busy) return
    setBusy(true)
    setActionFailure(null)
    try {
      const call = action === RETIREMENT_ACTION.RETIRE ? retireResource : republishResource
      setResource(await call(resource.id))
      setOutcome(action)
    } catch (err) {
      console.error('No se pudo cambiar la disponibilidad del recurso', err)
      const failure = describeRetirementFailure(err, action)
      setActionFailure(failure)
      setOutcome(null)
      // Otra cuenta lo cambió entretanto: se muestra su estado real.
      if (failure.reload) {
        getResource(resource.id)
          .then(setResource)
          .catch((reloadError) => console.error('No se pudo recargar el recurso', reloadError))
      }
    } finally {
      setBusy(false)
    }
  }

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
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      {error && <LoadError error={error} />}

      {!error && resource === null && (
        <p className="text-body text-content-muted" role="status">
          Cargando recurso…
        </p>
      )}

      {!error && actionFailure && (
        <div className="mb-8">
          <Notice role="alert" title={actionFailure.title}>
            {actionFailure.message}
          </Notice>
        </div>
      )}

      {!error && resource !== null && (
        <Availability
          resource={resource}
          corrected={corrected}
          outcome={outcome}
          busy={busy}
          onChange={changeAvailability}
        />
      )}
    </main>
  )
}

// Un recurso retirado solo muestra el aviso de que no está disponible (HU307);
// uno publicado, su ficha, con la confirmación de lo último que se hizo.
function Availability({ resource, corrected, outcome, busy, onChange }) {
  if (resource.retired) {
    return (
      <RetiredNotice
        resource={resource}
        justRetired={outcome === RETIREMENT_ACTION.RETIRE}
        busy={busy}
        onRepublish={() => onChange(RETIREMENT_ACTION.REPUBLISH)}
      />
    )
  }

  return (
    <>
      {outcome === RETIREMENT_ACTION.REPUBLISH && (
        <div className="mb-8">
          <Notice title="Volviste a publicar el recurso">
            Ya aparece de nuevo en el catálogo, en la página de su curso, en la búsqueda y en la portada.
          </Notice>
        </div>
      )}

      {outcome === null && corrected && (
        <div className="mb-8">
          <Notice title="Guardaste los cambios">Ya se ven en el catálogo, en los filtros y en la búsqueda.</Notice>
        </div>
      )}

      <ResourceSheet resource={resource} busy={busy} onRetire={() => onChange(RETIREMENT_ACTION.RETIRE)} />
    </>
  )
}

function LoadError({ error }) {
  const backToCatalog = (
    <Link to="/catalogo" className={buttonClasses('secondary')}>
      Volver al catálogo
    </Link>
  )

  if (isNotFound(error)) {
    return (
      <Notice title="Recurso no encontrado" action={backToCatalog}>
        Este recurso no existe o ya no está en el catálogo.
      </Notice>
    )
  }

  return (
    <Notice title="No se pudo cargar el recurso" role="alert">
      Recarga la página para reintentar.
    </Notice>
  )
}

function ResourceSheet({ resource, busy, onRetire }) {
  const type = formatResourceType(resource.resourceType)
  const summary = [
    type,
    resource.durationSeconds != null && formatDurationText(resource.durationSeconds),
    getYouTubeVideoId(resource.url) !== null && 'YouTube',
  ].filter(Boolean)

  return (
    <article>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <NodePath label="Ubicación" items={pathItems(resource)} current={type} />
        {/* Solo para quien puede corregirlo o retirarlo: quien lo aportó o el
            equipo (HU311 y HU307). */}
        {(resource.canEdit || resource.canRetire) && (
          <div className="flex flex-wrap gap-3">
            {resource.canEdit && (
              <Link to={`/recursos/${resource.id}/corregir`} className={buttonClasses('secondary')}>
                Corregir datos
              </Link>
            )}
            {resource.canRetire && <RetireAction busy={busy} onConfirm={onRetire} />}
          </div>
        )}
      </div>

      <h1 className="mt-5 max-w-[24ch] text-[1.75rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
        {resource.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {resource.topics.map((topic) => (
          <Tag key={topic}>{topic}</Tag>
        ))}
        <span className="ml-1.5 font-mono text-label text-content-muted tabular-nums">{summary.join(' · ')}</span>
      </div>

      <div className="mt-8">
        <Tabs
          label="Contenido del recurso"
          tabs={[
            { id: 'content', label: type, content: <ContentPanel resource={resource} /> },
            { id: 'details', label: 'Detalles', content: <DetailsPanel resource={resource} /> },
          ]}
        />
      </div>
    </article>
  )
}

// La firma de la identidad: curso → tema → recurso. El tema es el primero del
// recurso, que llegan ordenados por nombre, y lleva a su curso con ese tema
// filtrado.
function pathItems(resource) {
  const course = `/catalogo/cursos/${resource.courseId}`
  const [topic] = resource.topics
  const items = [{ label: resource.course, to: course }]
  if (topic) items.push({ label: topic, to: `${course}?${new URLSearchParams({ topic })}` })
  return items
}

function ContentPanel({ resource }) {
  if (resource.resourceType === 'DOCUMENT') return <DocumentPending />

  const source = [resource.channel, resource.publishedAt && formatPublishedAt(resource.publishedAt)].filter(Boolean)

  return (
    <div>
      <ResourcePlayer url={resource.url} title={resource.title} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-label text-content-muted">{source.join(' · ')}</p>
        {/* Siempre visible, se pueda incrustar o no: el objetivo de la ficha
            es llevar al recurso en su plataforma de origen. */}
        {isWebUrl(resource.url) && (
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className={buttonClasses('secondary')}>
            {sourceLinkLabel(resource.url)}{' '}
            <span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
        )}
      </div>
    </div>
  )
}

// Un apunte no tiene enlace ni reproductor: se leerá con el visor de la
// historia HU411, que reemplaza este aviso.
function DocumentPending() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-raised px-6 py-14 text-center">
      <svg viewBox="0 0 20 24" fill="none" aria-hidden="true" className="h-9 w-8 text-content-muted">
        <path d="M2 1.5h10.5L18 7v15.5H2z M12.5 1.5V7H18" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <p className="text-body text-content">Este apunte es un PDF.</p>
      <p className="text-label text-content-muted">Pronto podrás leerlo y descargarlo aquí mismo.</p>
    </div>
  )
}

function DetailsPanel({ resource }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className="text-body font-semibold text-content">Descripción</h2>
        <p className="mt-3 max-w-[65ch] text-base leading-relaxed whitespace-pre-line text-content-muted">
          {resource.description || 'Este recurso no tiene descripción.'}
        </p>
      </div>

      {/* Los campos opcionales solo aparecen cuando el recurso los tiene. */}
      <dl className="border-t border-border text-sm">
        <Field label="Curso">{resource.course}</Field>
        <Field label="Temas">
          <span className="flex flex-wrap gap-1.5">
            {resource.topics.map((topic) => (
              <Tag key={topic}>{topic}</Tag>
            ))}
          </span>
        </Field>
        <Field label="Tipo">{formatResourceType(resource.resourceType)}</Field>
        {resource.durationSeconds != null && (
          <Field label="Duración">{formatDurationText(resource.durationSeconds)}</Field>
        )}
        {resource.channel && <Field label="Canal">{resource.channel}</Field>}
        {resource.publishedAt && <Field label="Publicado">{formatPublishedAt(resource.publishedAt)}</Field>}
        {isWebUrl(resource.url) && (
          <Field label="Enlace">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline decoration-border-strong underline-offset-4 hover:text-accent"
            >
              {resource.url}
            </a>
          </Field>
        )}
      </dl>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b border-border py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <dt className="pt-0.5 font-mono text-xs tracking-wider text-content-muted uppercase">{label}</dt>
      <dd className="text-content">{children}</dd>
    </div>
  )
}
