/**
 * "Sin miembros", "1 miembro" o "N miembros": cuántos miembros tiene un
 * grupo, que ve cualquiera (HU405). Un grupo puede quedarse sin miembros y
 * sigue abierto.
 */
export function formatMemberCount(count) {
  if (count === 0) return 'Sin miembros'
  return count === 1 ? '1 miembro' : `${count} miembros`
}
