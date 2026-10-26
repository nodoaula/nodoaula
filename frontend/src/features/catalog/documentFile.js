/**
 * Lo que el navegador comprueba de un apunte antes de enviarlo, para avisar
 * sin esperar al servidor. El backend lo comprueba de nuevo, y además abre el
 * PDF: un archivo que se llama .pdf puede no serlo.
 */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

export function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/**
 * Título propuesto a partir del nombre del archivo. Un nombre sin espacios
 * usa los guiones como espacios (series-y-sucesiones.pdf); si ya tiene
 * espacios, el guion es parte del título y se conserva.
 */
export function titleFromFileName(name) {
  const base = name.replace(/\.pdf$/i, '').replaceAll('_', ' ')
  const words = (base.includes(' ') ? base : base.replaceAll('-', ' ')).replace(/\s+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
