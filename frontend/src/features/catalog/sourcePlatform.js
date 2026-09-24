/**
 * Lo que la ficha necesita saber del enlace de un recurso: si es un video de
 * YouTube que puede incrustarse y cómo nombrar la plataforma de origen.
 * NodoAula nunca descarga ni aloja el archivo: solo enlaza o incrusta el
 * reproductor oficial.
 */

// Los identificadores de video de YouTube tienen once caracteres de este
// alfabeto. Comprobarlo evita incrustar un reproductor con un id inventado.
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'])

// Formas de enlace en las que el id va en la ruta: /embed/<id>, /shorts/<id>...
const ID_IN_PATH_SECTIONS = new Set(['embed', 'shorts', 'live'])

function parseUrl(url) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function hostnameWithoutWww(parsed) {
  return parsed.hostname.replace(/^www\./, '')
}

/**
 * Solo se enlazan direcciones http o https. El backend ya valida el enlace al
 * registrarlo, pero un esquema como javascript: en un href ejecutaría código
 * al pulsarlo, y la ficha no debe depender de que nadie lo haya colado.
 */
export function isWebUrl(url) {
  const parsed = parseUrl(url)
  return parsed !== null && (parsed.protocol === 'https:' || parsed.protocol === 'http:')
}

/**
 * Devuelve el identificador del video si el enlace es de YouTube, o null si
 * no lo es. Admite las formas habituales: watch?v=, youtu.be/, embed/,
 * shorts/ y live/.
 */
export function getYouTubeVideoId(url) {
  if (!isWebUrl(url)) return null

  const parsed = parseUrl(url)
  const host = hostnameWithoutWww(parsed)
  let candidate = null

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/')[1]
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, section, id] = parsed.pathname.split('/')
    if (section === 'watch') candidate = parsed.searchParams.get('v')
    else if (ID_IN_PATH_SECTIONS.has(section)) candidate = id
  }

  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null
}

/** Texto del botón que abre el recurso en su plataforma de origen. */
export function sourceLinkLabel(url) {
  if (getYouTubeVideoId(url) !== null) return 'Ver en YouTube'

  const parsed = parseUrl(url)
  return parsed === null ? 'Abrir en su plataforma de origen' : `Abrir en ${hostnameWithoutWww(parsed)}`
}
