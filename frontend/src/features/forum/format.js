/** "27 de oct de 2026": la fecha de una pregunta o una respuesta, como en la ficha de un recurso. */
export function formatForumDate(isoInstant) {
  return new Date(isoInstant).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "1 respuesta" o "N respuestas". Cada pantalla dice a su manera que no hay ninguna. */
export function formatAnswerCount(count) {
  return count === 1 ? '1 respuesta' : `${count} respuestas`
}
