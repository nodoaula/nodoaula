import { describe, expect, it } from 'vitest'

import { summarizeCourses } from '../catalog/courseSummary.js'
import {
  courseResources,
  graphGeometry,
  graphRows,
  pickSample,
  rankResourceSuggestions,
  searchExamples,
  suggestCoursesAndTopics,
} from './landingCatalog.js'

const COURSES = [
  { id: 1, name: 'Física de Campos' },
  { id: 2, name: 'Cálculo Integral' },
  { id: 3, name: 'Gestión de proyectos' },
  { id: 4, name: 'Física Mecánica' },
]

const video = (id, course, topics) => ({ id, title: `Video ${id}`, course, resourceType: 'VIDEO', durationSeconds: 600, topics })
const note = (id, course, topics) => ({ id, title: `Apunte ${id}`, course, resourceType: 'DOCUMENT', pageCount: 4, topics })

// Física de Campos 4, Cálculo Integral 3, Gestión de proyectos 2, Física Mecánica 1.
const RESOURCES = [
  video(1, 'Física de Campos', ['Electroestática', 'Mecánica cuántica']),
  note(2, 'Física de Campos', ['Circuitos RC', 'Ley de Ohm']),
  video(3, 'Física de Campos', ['Capacitancia']),
  note(4, 'Física de Campos', ['Circuitos RC']),
  video(5, 'Cálculo Integral', ['Integral definida']),
  video(6, 'Cálculo Integral', ['Series']),
  video(7, 'Cálculo Integral', ['Integral definida', 'Métodos de integración']),
  video(8, 'Gestión de proyectos', ['Scrum']),
  video(9, 'Gestión de proyectos', ['Scrum']),
  video(10, 'Física Mecánica', ['Cinemática', 'Mecánica clásica']),
]

const SUMMARIES = summarizeCourses(RESOURCES, COURSES)
const ids = (resources) => resources.map((resource) => resource.id)

describe('pickSample', () => {
  it('empieza por un apunte y sigue con un recurso de cada uno de los demás cursos', () => {
    expect(ids(pickSample(SUMMARIES, RESOURCES))).toEqual([2, 5, 8, 10])
  })

  it('trae el apunte aunque su curso no esté entre los primeros', () => {
    const resources = [...RESOURCES.filter((resource) => resource.resourceType === 'VIDEO'), note(11, 'Física Mecánica', ['Torque'])]
    const sample = pickSample(summarizeCourses(resources, COURSES), resources)

    expect(ids(sample)).toEqual([11, 5, 1, 8])
  })

  it('sin apuntes, toma un recurso por curso', () => {
    const videos = RESOURCES.filter((resource) => resource.resourceType === 'VIDEO')

    expect(ids(pickSample(summarizeCourses(videos, COURSES), videos))).toEqual([5, 1, 8, 10])
  })

  it('no pasa del tamaño pedido', () => {
    expect(pickSample(SUMMARIES, RESOURCES, 2)).toHaveLength(2)
  })
})

describe('courseResources', () => {
  it('sin tema, alterna apuntes y videos del curso empezando por un apunte', () => {
    expect(ids(courseResources(RESOURCES, 'Física de Campos', null))).toEqual([2, 1, 4, 3])
  })

  it('con tema, deja los recursos del curso que lo tienen, en el orden del listado', () => {
    expect(ids(courseResources(RESOURCES, 'Cálculo Integral', 'Integral definida'))).toEqual([5, 7])
  })
})

describe('graphRows', () => {
  it('con todos los cursos, la gráfica lleva los cursos', () => {
    expect(graphRows(SUMMARIES, null)).toEqual({
      items: [
        { name: 'Física de Campos', count: 4, courseId: 1 },
        { name: 'Cálculo Integral', count: 3, courseId: 2 },
        { name: 'Gestión de proyectos', count: 2, courseId: 3 },
        { name: 'Física Mecánica', count: 1, courseId: 4 },
      ],
      more: 0,
    })
  })

  it('con un curso, lleva sus temas', () => {
    expect(graphRows(SUMMARIES, 2).items.map((item) => item.name)).toEqual(['Integral definida', 'Métodos de integración', 'Series'])
  })

  it('con más de siete filas, enseña seis y cuenta las demás', () => {
    const topics = Array.from({ length: 9 }, (_, index) => `Tema ${index + 1}`)
    const resources = topics.map((topic, index) => video(100 + index, 'Física de Campos', [topic]))
    const rows = graphRows(summarizeCourses(resources, COURSES), 1)

    expect(rows.items).toHaveLength(6)
    expect(rows.more).toBe(3)
  })

  it('si el tema escogido no cabe, ocupa la última fila visible', () => {
    const topics = Array.from({ length: 9 }, (_, index) => `Tema ${index + 1}`)
    const resources = topics.map((topic, index) => video(100 + index, 'Física de Campos', [topic]))
    const summaries = summarizeCourses(resources, COURSES)
    const all = graphRows(summaries, 1).items.map((item) => item.name)
    const hidden = summaries[0].topics.map((topic) => topic.name).find((name) => !all.includes(name))
    const rows = graphRows(summaries, 1, hidden)

    expect(rows.items.map((item) => item.name)).toEqual([...all.slice(0, 5), hidden])
    expect(rows.more).toBe(3)
  })
})

describe('graphGeometry', () => {
  it('en computador abre las filas en abanico desde el nodo del curso, a 80 px como mucho', () => {
    const geometry = graphGeometry(3, false)

    expect(geometry.ys).toEqual([210, 290, 370])
    expect(geometry.paths[0]).toBe('M24 290 L175.5 290 C212 290 212 210 248.4 210')
    expect(geometry.height).toBe(580)
  })

  it('en computador, las siete filas como mucho caben en el alto de la gráfica', () => {
    const { ys } = graphGeometry(7, false)

    expect([ys[0], ys[6]]).toEqual([50, 530])
  })

  it('en una columna cuelga las filas del nodo, cada 48 px', () => {
    const geometry = graphGeometry(2, true)

    expect(geometry.ys).toEqual([80, 128])
    expect(geometry.paths[0]).toBe('M14 22 L14 66 Q14 80 28 80 L40 80')
    expect(geometry.height).toBe(152)
  })
})

describe('suggestCoursesAndTopics', () => {
  it('encuentra cursos y temas con todas las palabras en cualquier orden, sin tildes', () => {
    expect(suggestCoursesAndTopics(SUMMARIES, 'integral CALCULO')).toEqual({
      courses: [SUMMARIES[1]],
      topics: [],
    })
    expect(suggestCoursesAndTopics(SUMMARIES, 'definida').topics).toEqual([{ name: 'Integral definida', course: SUMMARIES[1] }])
  })

  it('no busca «apuntes», «pdf» ni «videos» en los nombres: son el tipo, como en el catálogo', () => {
    expect(suggestCoursesAndTopics(SUMMARIES, 'apuntes calculo').courses).toEqual([SUMMARIES[1]])
    expect(suggestCoursesAndTopics(SUMMARIES, 'definida videos').topics).toEqual([{ name: 'Integral definida', course: SUMMARIES[1] }])
    expect(suggestCoursesAndTopics(SUMMARIES, 'pdf')).toEqual({ courses: [], topics: [] })
  })

  it('da los cursos en su orden de más a menos recursos', () => {
    const { courses } = suggestCoursesAndTopics(SUMMARIES, 'fisica')

    expect(courses.map((course) => course.name)).toEqual(['Física de Campos', 'Física Mecánica'])
  })

  it('pone primero los temas de los cursos que coinciden', () => {
    // «Mecánica cuántica» es de Física de Campos, que va antes en el catálogo.
    const { topics } = suggestCoursesAndTopics(SUMMARIES, 'mecanica')

    expect(topics.map((topic) => `${topic.name} · ${topic.course.name}`)).toEqual(['Mecánica clásica · Física Mecánica', 'Mecánica cuántica · Física de Campos'])
  })

  it('da dos de cada uno como mucho', () => {
    const { topics } = suggestCoursesAndTopics(SUMMARIES, 'i')

    expect(topics).toHaveLength(2)
  })

  it('sin texto no sugiere nada', () => {
    expect(suggestCoursesAndTopics(SUMMARIES, '   ')).toEqual({ courses: [], topics: [] })
  })
})

describe('rankResourceSuggestions', () => {
  it('pone primero, sin desordenar lo demás, los recursos de los cursos sugeridos', () => {
    expect(ids(rankResourceSuggestions(RESOURCES.slice(0, 7), ['Cálculo Integral']))).toEqual([5, 6, 7, 1, 2, 3, 4])
  })
})

describe('searchExamples', () => {
  it('propone el tema con más recursos de cada uno de los tres primeros cursos', () => {
    expect(searchExamples(SUMMARIES)).toEqual(['Circuitos RC', 'Integral definida', 'Scrum'])
  })
})
