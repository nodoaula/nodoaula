import { normalizeText } from '../../lib/text.js'

/**
 * Lo que la página de entrada calcula con el catálogo: la muestra, los
 * recursos de un curso o un tema, las filas y la forma de la gráfica, y las
 * sugerencias del buscador. Sale del listado y de su resumen por curso
 * (`summarizeCourses`), con los cursos y sus temas de más a menos recursos.
 */

/**
 * La muestra de la entrada: el primer apunte del catálogo y, después, un
 * recurso de cada uno de los demás cursos, para que se vean cursos distintos
 * y al menos un apunte.
 */
export function pickSample(summaries, resources, size = 4) {
  const byCourse = (name) => resources.filter((resource) => resource.course === name)
  const firstNote = summaries
    .map((summary) => byCourse(summary.name).find((resource) => resource.resourceType === 'DOCUMENT'))
    .find(Boolean)

  const sample = firstNote ? [firstNote] : []
  for (const summary of summaries) {
    if (sample.length >= size) break
    if (summary.name !== firstNote?.course) sample.push(byCourse(summary.name)[0])
  }
  return sample
}

/**
 * Los recursos de un curso o de uno de sus temas. Sin tema se alternan
 * apuntes y videos, empezando por un apunte, para que se vean los dos tipos.
 */
export function courseResources(resources, courseName, topic) {
  const inCourse = resources.filter((resource) => resource.course === courseName)
  if (topic) return inCourse.filter((resource) => resource.topics.includes(topic))

  const notes = inCourse.filter((resource) => resource.resourceType === 'DOCUMENT')
  const videos = inCourse.filter((resource) => resource.resourceType !== 'DOCUMENT')
  const mixed = []
  for (let index = 0; index < Math.max(notes.length, videos.length); index++) {
    if (notes[index]) mixed.push(notes[index])
    if (videos[index]) mixed.push(videos[index])
  }
  return mixed
}

const MAX_GRAPH_ROWS = 7

/**
 * Las filas de la gráfica: los cursos o, con un curso escogido, sus temas.
 * Si no caben, la última fila cuenta las que faltan (`more`).
 */
export function graphRows(summaries, courseId) {
  const course = summaries.find((summary) => summary.id === courseId)
  const items = course
    ? course.topics.map((topic) => ({ name: topic.name, count: topic.count }))
    : summaries.map((summary) => ({ name: summary.name, count: summary.count, courseId: summary.id }))

  if (items.length <= MAX_GRAPH_ROWS) return { items, more: 0 }
  return { items: items.slice(0, MAX_GRAPH_ROWS - 1), more: items.length - (MAX_GRAPH_ROWS - 1) }
}

/**
 * Dónde va cada fila de la gráfica, en píxeles de su propio dibujo. En
 * computador, las filas se abren en abanico a la derecha del nodo del curso,
 * centradas en él; en una sola columna, cuelgan de él una debajo de otra.
 * `paths[i]` es la arista del nodo a la fila i.
 */
export function graphGeometry(rows, tree) {
  if (tree) {
    const node = { x: 14, y: 22 }
    const ys = Array.from({ length: rows }, (_, index) => 80 + index * 48)
    return {
      node,
      rowX: 40,
      ys,
      paths: ys.map((y) => `M${node.x} ${node.y} L${node.x} ${y - 14} Q${node.x} ${y} ${node.x + 14} ${y} L40 ${y}`),
      height: ys[ys.length - 1] + 24,
    }
  }

  const node = { x: 24, y: 290 }
  const ys = Array.from({ length: rows }, (_, index) => node.y - (80 * (rows - 1)) / 2 + index * 80)
  return {
    node,
    rowX: 248.4,
    ys,
    paths: ys.map((y) => `M24 ${node.y} L175.5 ${node.y} C212 ${node.y} 212 ${y} 248.4 ${y}`),
    height: 580,
  }
}

const words = (text) => normalizeText(text).split(' ').filter(Boolean)

function matchesAll(name, queryWords) {
  const normalized = normalizeText(name)
  return queryWords.every((word) => normalized.includes(word))
}

/**
 * Cursos y temas cuyo nombre lleva todas las palabras buscadas, en cualquier
 * orden: dos de cada uno como mucho. Los temas de los cursos sugeridos van
 * primero.
 */
export function suggestCoursesAndTopics(summaries, text) {
  const queryWords = words(text)
  if (queryWords.length === 0) return { courses: [], topics: [] }

  const courses = summaries.filter((summary) => matchesAll(summary.name, queryWords)).slice(0, 2)
  const inCourses = (course) => courses.includes(course)
  const topics = summaries
    .flatMap((course) => course.topics.filter((topic) => matchesAll(topic.name, queryWords)).map((topic) => ({ name: topic.name, course })))
    .sort((a, b) => inCourses(b.course) - inCourses(a.course))
    .slice(0, 2)

  return { courses, topics }
}

/** Los resultados de la búsqueda, con los de los cursos sugeridos primero. */
export function rankResourceSuggestions(resources, courseNames) {
  const inCourses = (resource) => courseNames.includes(resource.course)
  return [...resources].sort((a, b) => inCourses(b) - inCourses(a))
}

/** Temas reales que el buscador propone mientras está vacío. */
export function searchExamples(summaries) {
  return summaries
    .slice(0, 3)
    .map((summary) => summary.topics[0]?.name)
    .filter(Boolean)
}
