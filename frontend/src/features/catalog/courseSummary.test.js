import { describe, expect, it } from 'vitest'

import { formatCourseSummary, summarizeCourses } from './courseSummary.js'

function resource(course, resourceType, topics, durationSeconds = null) {
  return { course, resourceType, topics, durationSeconds }
}

const COURSES = [
  { id: 1, name: 'Cálculo Integral' },
  { id: 2, name: 'Física Mecánica' },
  { id: 3, name: 'Arquitectura de Software' },
]

describe('summarizeCourses', () => {
  it('cuenta videos, apuntes y segundos de video de cada curso, con el id del curso', () => {
    const [summary] = summarizeCourses(
      [
        resource('Física Mecánica', 'VIDEO', ['Cinemática'], 600),
        resource('Física Mecánica', 'VIDEO', ['Torque'], 300),
        resource('Física Mecánica', 'DOCUMENT', ['Torque']),
      ],
      COURSES,
    )

    expect(summary).toMatchObject({ id: 2, name: 'Física Mecánica', count: 3, videoCount: 2, documentCount: 1, videoSeconds: 900 })
  })

  it('suma como cero la duración de un video que no la tiene', () => {
    const [summary] = summarizeCourses([resource('Cálculo Integral', 'VIDEO', ['Series'], null)], COURSES)

    expect(summary.videoSeconds).toBe(0)
  })

  it('ordena los cursos de más a menos recursos y, si empatan, por nombre', () => {
    const summaries = summarizeCourses(
      [
        resource('Física Mecánica', 'VIDEO', ['Torque']),
        resource('Cálculo Integral', 'VIDEO', ['Series']),
        resource('Arquitectura de Software', 'VIDEO', ['Git']),
        resource('Arquitectura de Software', 'VIDEO', ['Git']),
      ],
      COURSES,
    )

    expect(summaries.map((summary) => summary.name)).toEqual([
      'Arquitectura de Software',
      'Cálculo Integral',
      'Física Mecánica',
    ])
  })

  it('ordena los temas de un curso de más a menos recursos y, si empatan, por nombre', () => {
    const [summary] = summarizeCourses(
      [
        resource('Cálculo Integral', 'VIDEO', ['Sucesiones', 'Series']),
        resource('Cálculo Integral', 'VIDEO', ['Series']),
        resource('Cálculo Integral', 'VIDEO', ['Convergencia']),
      ],
      COURSES,
    )

    expect(summary.topics).toEqual([
      { name: 'Series', count: 2 },
      { name: 'Convergencia', count: 1 },
      { name: 'Sucesiones', count: 1 },
    ])
  })

  it('no pinta tarjeta para un curso sin recursos', () => {
    const summaries = summarizeCourses([resource('Cálculo Integral', 'VIDEO', ['Series'])], COURSES)

    expect(summaries.map((summary) => summary.name)).toEqual(['Cálculo Integral'])
  })

  it('deja fuera un recurso cuyo curso no llegó en la lista, sin afectar a las demás tarjetas', () => {
    const summaries = summarizeCourses(
      [resource('Curso creado entre las dos peticiones', 'VIDEO', ['Tema'], 600), resource('Cálculo Integral', 'VIDEO', ['Series'], 300)],
      COURSES,
    )

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ name: 'Cálculo Integral', count: 1, videoSeconds: 300 })
  })
})

describe('formatCourseSummary', () => {
  it('une las tres partes con espacios duros dentro de cada una', () => {
    expect(formatCourseSummary({ videoCount: 5, documentCount: 2, videoSeconds: 9 * 3600 })).toBe(
      '5\u00a0videos · 2\u00a0apuntes · 9\u00a0h\u00a0de\u00a0video',
    )
  })

  it('usa el singular con uno', () => {
    expect(formatCourseSummary({ videoCount: 1, documentCount: 1, videoSeconds: 3600 })).toBe(
      '1\u00a0video · 1\u00a0apunte · 1\u00a0h\u00a0de\u00a0video',
    )
  })

  it('omite las partes que valen cero', () => {
    expect(formatCourseSummary({ videoCount: 0, documentCount: 3, videoSeconds: 0 })).toBe('3\u00a0apuntes')
  })

  it('redondea las horas y, por debajo de una hora, da los minutos', () => {
    expect(formatCourseSummary({ videoCount: 1, documentCount: 0, videoSeconds: 5400 })).toBe(
      '1\u00a0video · 2\u00a0h\u00a0de\u00a0video',
    )
    expect(formatCourseSummary({ videoCount: 1, documentCount: 0, videoSeconds: 3599 })).toBe(
      '1\u00a0video · 59\u00a0min\u00a0de\u00a0video',
    )
  })
})
