import { Link } from 'react-router'

import { formatDurationText, formatPageCount, formatResourceType } from './format.js'

/** Fila de un recurso en las listas del catálogo. `detail` es la línea bajo el título. */
export default function ResourceRow({ resource, detail }) {
  const isVideo = resource.resourceType === 'VIDEO'
  // Donde un video dice su duración, un apunte dice sus páginas.
  let meta = null
  if (isVideo && resource.durationSeconds != null) meta = formatDurationText(resource.durationSeconds)
  if (!isVideo && resource.pageCount != null) meta = `PDF · ${formatPageCount(resource.pageCount)}`

  return (
    <Link
      to={`/recursos/${resource.id}`}
      className="grid gap-2 px-1 py-4 hover:bg-surface-raised sm:grid-cols-[5.75rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
    >
      <span
        className={`justify-self-start rounded-full border px-2.5 py-0.5 font-mono text-xs ${
          isVideo ? 'border-accent/40 text-accent' : 'border-document/40 text-document'
        }`}
      >
        {formatResourceType(resource.resourceType)}
      </span>
      <span>
        <span className="block text-base leading-snug font-medium text-content">{resource.title}</span>
        <span className="mt-1 block text-label text-content-muted">{detail}</span>
      </span>
      {meta && <span className="font-mono text-label whitespace-nowrap text-content-muted sm:text-right">{meta}</span>}
    </Link>
  )
}
