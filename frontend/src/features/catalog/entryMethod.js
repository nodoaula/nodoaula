/**
 * Vía por la que un recurso entra al catálogo (historia HU202): por la
 * indexación automática de un video de YouTube o por el formulario manual.
 */

export const ENTRY_METHOD = {
  MANUAL: 'MANUAL',
  AUTOMATIC: 'AUTOMATIC',
}

/** Campos que la indexación puede llenar. Curso y temas nunca los llena. */
export const AUTOFILLABLE_FIELDS = ['title', 'description', 'publishedAt', 'durationSeconds', 'channel']

/**
 * Decide la vía al publicar. `snapshot` son los campos que la última
 * inserción llenó con valor (los que YouTube no trajo no forman parte de
 * ella), o null si no hubo inserción. Si todos fueron borrados o editados, el
 * registro vuelve a ser manual; si al menos uno conserva el valor insertado,
 * es automático. Se compara recortando espacios, como se envía el formulario.
 */
export function resolveEntryMethod(snapshot, form) {
  const fields = Object.keys(snapshot ?? {})
  if (fields.length === 0) return ENTRY_METHOD.MANUAL

  const keepsAnInsertedValue = fields.some(
    (field) => String(form[field] ?? '').trim() === String(snapshot[field]).trim(),
  )
  return keepsAnInsertedValue ? ENTRY_METHOD.AUTOMATIC : ENTRY_METHOD.MANUAL
}
