import { formatDurationText } from './format.js'

function byCountThenName(a, b) {
  return b.count - a.count || a.name.localeCompare(b.name, 'es')
}

/**
 * Una tarjeta por curso para el índice del catálogo, calculada con el listado
 * completo: así cuenta justo los recursos que se ven al entrar al curso. El
 * listado trae el curso por nombre y `courses` su id; se cruzan por nombre,
 * que es único en la base. Los temas y los cursos van de más a menos
 * recursos.
 */
export function summarizeCourses(resources, courses) {
  const summaries = new Map(
    courses.map((course) => [
      course.name,
      { id: course.id, name: course.name, count: 0, videoCount: 0, documentCount: 0, videoSeconds: 0, topics: new Map() },
    ]),
  )

  for (const resource of resources) {
    const summary = summaries.get(resource.course)
    if (!summary) continue

    summary.count += 1
    if (resource.resourceType === 'VIDEO') {
      summary.videoCount += 1
      summary.videoSeconds += resource.durationSeconds ?? 0
    } else {
      summary.documentCount += 1
    }
    for (const topic of resource.topics) {
      summary.topics.set(topic, (summary.topics.get(topic) ?? 0) + 1)
    }
  }

  // El listado y los cursos llegan en dos peticiones: un curso que se quedó
  // sin recursos entre una y otra no debe pintar una tarjeta vacía.
  return [...summaries.values()]
    .filter((summary) => summary.count > 0)
    .map((summary) => ({
      ...summary,
      topics: [...summary.topics].map(([name, count]) => ({ name, count })).sort(byCountThenName),
    }))
    .sort(byCountThenName)
}

function countText(count, singular, plural) {
  return `${count}\u00a0${count === 1 ? singular : plural}`
}

/**
 * "5 videos · 2 apuntes · 9 h de video", sin las partes que valen cero. Las
 * horas se redondean: es una idea del tamaño del curso, no una medida. Los
 * espacios duros evitan que una parte se parta entre dos líneas.
 */
export function formatCourseSummary({ videoCount, documentCount, videoSeconds }) {
  const parts = []
  if (videoCount > 0) parts.push(countText(videoCount, 'video', 'videos'))
  if (documentCount > 0) parts.push(countText(documentCount, 'apunte', 'apuntes'))
  if (videoSeconds > 0) {
    const time = videoSeconds >= 3600 ? `${Math.round(videoSeconds / 3600)} h` : formatDurationText(videoSeconds)
    parts.push(`${time} de video`.replaceAll(' ', '\u00a0'))
  }
  return parts.join(' · ')
}
