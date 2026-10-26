/**
 * Forma de comparar nombres de cursos y temas: dos que solo se diferencian en
 * mayúsculas, tildes o espacios de sobra son el mismo.
 */
export function normalizeText(text) {
  return tidyText(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** El texto tal como se guarda: sin espacios al principio, al final ni repetidos. */
export function tidyText(text) {
  return text.replace(/\s+/g, ' ').trim()
}
