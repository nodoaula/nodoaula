/** Cómo se muestran los datos de un recurso: los comparten el listado y la ficha. */

export const RESOURCE_TYPE_LABELS = {
  VIDEO: 'Video',
  DOCUMENT: 'Apunte',
}

export function formatResourceType(resourceType) {
  return RESOURCE_TYPE_LABELS[resourceType] ?? resourceType
}

export function formatDuration(totalSeconds) {
  if (totalSeconds == null) return '—'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(seconds).padStart(2, '0')

  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`
}

/** Duración para leer, no para medir: "1 h 40 min", "13 min" o "45 s". */
export function formatDurationText(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
  if (minutes > 0) return `${minutes} min`
  return `${totalSeconds} s`
}

/**
 * La API envía la fecha como "2026-09-06", sin hora. Se arma con la fecha
 * local y no con `new Date("2026-09-06")`, que la interpreta como medianoche
 * UTC: en Colombia eso cae el día anterior.
 */
export function formatPublishedAt(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', { dateStyle: 'long' })
}
